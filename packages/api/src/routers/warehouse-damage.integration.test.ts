import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";

dotenv.config({ path: "apps/server/.env" });

const runDatabaseIntegration = process.env.RUN_WAREHOUSE_DAMAGE_DB_TEST === "1";

type ProcedureLike = {
  "~orpc": {
    handler(args: { context: unknown; input: unknown }): Promise<unknown>;
  };
};

async function invokeProcedure<Result>(
  procedure: unknown,
  context: unknown,
  input: unknown,
) {
  return (procedure as ProcedureLike)["~orpc"].handler({
    context,
    input,
  }) as Promise<Result>;
}

test(
  "warehouse damage keeps drafts non-mutating and posts, retries, scopes, and reverses atomically",
  { skip: !runDatabaseIntegration, timeout: 30_000 },
  async () => {
    const [{ db }, schema, drizzle, variantDefinition, routerModule] =
      await Promise.all([
        import("@bikalpo-project/db"),
        import("@bikalpo-project/db/schema"),
        import("drizzle-orm"),
        import("@bikalpo-project/db/variant-definition"),
        import("./warehouse-damage"),
      ]);
    const {
      inventory,
      carton,
      product,
      productVariant,
      stockEntry,
      user,
      warehouseDamageEntry,
      warehouseDamageItem,
      warehouseDamageMovement,
    } = schema;
    const { and, eq, inArray, isNotNull } = drizzle;
    const { resolveVariantOperations } = variantDefinition;
    const { warehouseDamageRouter } = routerModule;
    const suffix = randomUUID();
    const warehouseId = `damage-warehouse-${suffix}`;
    const otherWarehouseId = `damage-other-${suffix}`;
    const requestKey = randomUUID();
    const createdEntryIds: number[] = [];
    const createdCartonIds: number[] = [];
    let createdProductId: number | null = null;

    const variant = await db.query.productVariant.findFirst({
      where: isNotNull(productVariant.sourceVariantOptionId),
      with: { product: true, sourceVariantOption: true },
    });
    assert.ok(
      variant?.sourceVariantOption,
      "A structured product variant is required for this integration test",
    );
    const operations = resolveVariantOperations(variant.sourceVariantOption);
    assert.notEqual(
      operations.receivingMode,
      "carton",
      "The test fixture must use loose, pack, or direct receiving",
    );
    const warehouseContext = {
      session: {
        user: {
          id: warehouseId,
          role: "warehouse",
          name: "Damage Test Warehouse",
        },
      },
    };
    const otherWarehouseContext = {
      session: {
        user: {
          id: otherWarehouseId,
          role: "warehouse",
          name: "Other Damage Warehouse",
        },
      },
    };

    try {
      await db.insert(user).values([
        {
          id: warehouseId,
          name: "Damage Test Warehouse",
          email: `${warehouseId}@example.test`,
          role: "warehouse",
        },
        {
          id: otherWarehouseId,
          name: "Other Damage Warehouse",
          email: `${otherWarehouseId}@example.test`,
          role: "warehouse",
        },
      ]);
      const [ownedProduct] = await db
        .insert(product)
        .values({
          name: `Damage Integration Product ${suffix.slice(0, 8)}`,
          slug: `damage-integration-${suffix}`,
          categoryId: variant.product.categoryId,
          size: variant.product.size,
          price: variant.price,
          image: variant.product.image,
          creatorSource: "warehouse",
          createdById: warehouseId,
          createdByWarehouseId: warehouseId,
        })
        .returning();
      assert.ok(ownedProduct);
      createdProductId = ownedProduct.id;
      const [ownedVariant] = await db
        .insert(productVariant)
        .values({
          productId: ownedProduct.id,
          sku: `DMG-${suffix.slice(0, 8)}`,
          unitLabel: variant.unitLabel,
          packagingType: variant.packagingType,
          weightKg: variant.weightKg,
          price: variant.price,
          sourceVariantOptionId: variant.sourceVariantOptionId,
          isActive: true,
        })
        .returning();
      assert.ok(ownedVariant);
      const [inventoryRow] = await db
        .insert(inventory)
        .values({
          ownerType: "warehouse",
          ownerId: warehouseId,
          variantId: ownedVariant.id,
          availableQty: "10",
          inCartonQty: "0",
          activeCartonCount: 0,
        })
        .returning();
      assert.ok(inventoryRow);
      const costType =
        operations.receivingMode === "loose"
          ? "per_kg"
          : operations.receivingMode === "direct"
            ? "per_unit"
            : "per_pack";
      const [expiredReceipt, freshReceipt] = await db
        .insert(stockEntry)
        .values([
          {
            warehouseId,
            variantId: ownedVariant.id,
            entryType: operations.receivingMode,
            quantity: "4",
            quantityUnit: operations.operationalUnit,
            inventoryDelta: "4",
            inventoryUnit: operations.operationalUnit,
            costType,
            purchasePrice: "10",
            totalCost: "40",
            expiryDate: "2025-01-01",
            createdAt: new Date("2025-01-01T00:00:00Z"),
            updatedAt: new Date("2025-01-01T00:00:00Z"),
          },
          {
            warehouseId,
            variantId: ownedVariant.id,
            entryType: operations.receivingMode,
            quantity: "6",
            quantityUnit: operations.operationalUnit,
            inventoryDelta: "6",
            inventoryUnit: operations.operationalUnit,
            costType,
            purchasePrice: "20",
            totalCost: "120",
            expiryDate: "2099-01-01",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ])
        .returning();
      assert.ok(expiredReceipt && freshReceipt);
      const payload = {
        requestKey,
        damageType: "physical" as const,
        damageMode: operations.receivingMode,
        description: "Integration test damage",
        proofImages: [],
        entryDate: new Date().toISOString().slice(0, 10),
        items: [{ inventoryId: inventoryRow.id, quantity: 2 }],
      };
      const draft = await invokeProcedure<{
        entryId: number;
        entryNo: string;
      }>(warehouseDamageRouter.saveDraft, warehouseContext, payload);
      createdEntryIds.push(draft.entryId);
      const afterDraft = await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryRow.id),
      });
      assert.equal(afterDraft?.availableQty, "10.00");
      await assert.rejects(
        invokeProcedure(warehouseDamageRouter.getById, otherWarehouseContext, {
          id: draft.entryId,
        }),
        /not found/i,
      );

      const posted = await invokeProcedure<{ duplicate: boolean }>(
        warehouseDamageRouter.post,
        warehouseContext,
        { ...payload, draftId: draft.entryId },
      );
      assert.equal(posted.duplicate, false);
      const afterPost = await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryRow.id),
      });
      assert.equal(afterPost?.availableQty, "8.00");
      const item = await db.query.warehouseDamageItem.findFirst({
        where: eq(warehouseDamageItem.damageEntryId, draft.entryId),
      });
      assert.equal(item?.unitCost, "16.0000");
      assert.equal(item?.totalValue, "32.00");
      assert.equal(item?.costingMethod, "weighted_current_acquisition_cost");

      const retry = await invokeProcedure<{ duplicate: boolean }>(
        warehouseDamageRouter.post,
        warehouseContext,
        { ...payload, draftId: draft.entryId },
      );
      assert.equal(retry.duplicate, true);
      const afterRetry = await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryRow.id),
      });
      assert.equal(afterRetry?.availableQty, "8.00");

      await invokeProcedure(warehouseDamageRouter.reverse, warehouseContext, {
        id: draft.entryId,
        reason: "Integration reversal",
      });
      const afterReverse = await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryRow.id),
      });
      assert.equal(afterReverse?.availableQty, "10.00");
      const movements = await db.query.warehouseDamageMovement.findMany({
        where: eq(warehouseDamageMovement.damageEntryId, draft.entryId),
      });
      assert.deepEqual(
        movements.map((movement) => movement.quantityDelta).sort(),
        ["-2.00", "2.00"],
      );

      await db
        .update(inventory)
        .set({ availableQty: "6" })
        .where(eq(inventory.id, inventoryRow.id));
      const fullyConsumedExpiredLot = await invokeProcedure<{
        sources: Array<{ stockEntryId: number | null; availableQty: number }>;
      }>(warehouseDamageRouter.searchSources, warehouseContext, {
        mode: operations.receivingMode,
        damageType: "expired",
        limit: 50,
      });
      assert.equal(
        fullyConsumedExpiredLot.sources.some(
          (source) => source.stockEntryId === expiredReceipt.id,
        ),
        false,
      );

      await db
        .update(inventory)
        .set({ availableQty: "8" })
        .where(eq(inventory.id, inventoryRow.id));
      const partlyRemainingExpiredLot = await invokeProcedure<{
        sources: Array<{ stockEntryId: number | null; availableQty: number }>;
      }>(warehouseDamageRouter.searchSources, warehouseContext, {
        mode: operations.receivingMode,
        damageType: "expired",
        limit: 50,
      });
      assert.equal(
        partlyRemainingExpiredLot.sources.find(
          (source) => source.stockEntryId === expiredReceipt.id,
        )?.availableQty,
        2,
      );
      const expiredPayload = {
        requestKey: randomUUID(),
        damageType: "expired" as const,
        damageMode: operations.receivingMode,
        proofImages: [],
        entryDate: new Date().toISOString().slice(0, 10),
        items: [
          {
            inventoryId: inventoryRow.id,
            stockEntryId: expiredReceipt.id,
            quantity: 3,
          },
        ],
      };
      await assert.rejects(
        invokeProcedure(
          warehouseDamageRouter.post,
          warehouseContext,
          expiredPayload,
        ),
        /only 2 remains/i,
      );
      const competingExpiredPosts = await Promise.allSettled([
        invokeProcedure<{ entryId: number }>(
          warehouseDamageRouter.post,
          warehouseContext,
          {
            ...expiredPayload,
            requestKey: randomUUID(),
            items: [{ ...expiredPayload.items[0], quantity: 2 }],
          },
        ),
        invokeProcedure<{ entryId: number }>(
          warehouseDamageRouter.post,
          warehouseContext,
          {
            ...expiredPayload,
            requestKey: randomUUID(),
            items: [{ ...expiredPayload.items[0], quantity: 2 }],
          },
        ),
      ]);
      const fulfilledExpiredPosts = competingExpiredPosts.filter(
        (result) => result.status === "fulfilled",
      );
      const rejectedExpiredPosts = competingExpiredPosts.filter(
        (result) => result.status === "rejected",
      );
      assert.equal(fulfilledExpiredPosts.length, 1);
      assert.equal(rejectedExpiredPosts.length, 1);
      const expiredPost = fulfilledExpiredPosts[0];
      assert.equal(expiredPost?.status, "fulfilled");
      if (expiredPost?.status !== "fulfilled") {
        throw new Error("One competing expired post should succeed");
      }
      createdEntryIds.push(expiredPost.value.entryId);
      const afterExpiredPost = await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryRow.id),
      });
      assert.equal(afterExpiredPost?.availableQty, "6.00");
      await invokeProcedure(warehouseDamageRouter.reverse, warehouseContext, {
        id: expiredPost.value.entryId,
        reason: "Expired allocation reversal",
      });

      await db
        .update(inventory)
        .set({
          availableQty: "10",
          inCartonQty: "2",
          activeCartonCount: 1,
        })
        .where(eq(inventory.id, inventoryRow.id));
      const [cartonRow] = await db
        .insert(carton)
        .values({
          cartonId: `CTN-DMG-${suffix.slice(0, 12)}`,
          warehouseId,
          variantId: ownedVariant.id,
          totalPacks: 2,
          totalWeightKg: "2",
        })
        .returning();
      assert.ok(cartonRow);
      createdCartonIds.push(cartonRow.id);
      await assert.rejects(
        invokeProcedure(warehouseDamageRouter.post, warehouseContext, {
          requestKey: randomUUID(),
          damageType: "expired",
          damageMode: "carton",
          proofImages: [],
          entryDate: new Date().toISOString().slice(0, 10),
          items: [{ inventoryId: inventoryRow.id, cartonId: cartonRow.id }],
        }),
        /batch provenance/i,
      );
      const cartonPost = await invokeProcedure<{ entryId: number }>(
        warehouseDamageRouter.post,
        warehouseContext,
        {
          requestKey: randomUUID(),
          damageType: "physical",
          damageMode: "carton",
          proofImages: [],
          entryDate: new Date().toISOString().slice(0, 10),
          items: [{ inventoryId: inventoryRow.id, cartonId: cartonRow.id }],
        },
      );
      createdEntryIds.push(cartonPost.entryId);
      const damagedCarton = await db.query.carton.findFirst({
        where: eq(carton.id, cartonRow.id),
      });
      const afterCartonPost = await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryRow.id),
      });
      assert.equal(damagedCarton?.status, "damaged");
      assert.equal(afterCartonPost?.availableQty, "8.00");
      assert.equal(afterCartonPost?.inCartonQty, "0.00");
      assert.equal(afterCartonPost?.activeCartonCount, 0);
      await invokeProcedure(warehouseDamageRouter.reverse, warehouseContext, {
        id: cartonPost.entryId,
        reason: "Carton reversal",
      });
      const restoredCarton = await db.query.carton.findFirst({
        where: eq(carton.id, cartonRow.id),
      });
      assert.equal(restoredCarton?.status, "active");
    } finally {
      if (createdEntryIds.length) {
        await db
          .delete(warehouseDamageMovement)
          .where(
            inArray(warehouseDamageMovement.damageEntryId, createdEntryIds),
          );
        await db
          .delete(warehouseDamageItem)
          .where(inArray(warehouseDamageItem.damageEntryId, createdEntryIds));
        await db
          .delete(warehouseDamageEntry)
          .where(inArray(warehouseDamageEntry.id, createdEntryIds));
      }
      if (createdCartonIds.length) {
        await db.delete(carton).where(inArray(carton.id, createdCartonIds));
      }
      await db
        .delete(stockEntry)
        .where(eq(stockEntry.warehouseId, warehouseId));
      await db
        .delete(inventory)
        .where(
          and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
          ),
        );
      if (createdProductId) {
        await db.delete(product).where(eq(product.id, createdProductId));
      }
      await db
        .delete(user)
        .where(inArray(user.id, [warehouseId, otherWarehouseId]));
    }
  },
);
