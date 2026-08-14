import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";

dotenv.config({ path: "apps/server/.env" });

const runDatabaseIntegration = process.env.RUN_WAREHOUSE_EXPIRY_DB_TEST === "1";

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
  "warehouse expiry metadata is required, persisted, listed, and reduced to current FIFO balance",
  { skip: !runDatabaseIntegration, timeout: 30_000 },
  async () => {
    const [{ db }, schema, drizzle, variantDefinition, routerModule] =
      await Promise.all([
        import("@bikalpo-project/db"),
        import("@bikalpo-project/db/schema"),
        import("drizzle-orm"),
        import("@bikalpo-project/db/variant-definition"),
        import("./warehouse"),
      ]);
    const {
      inventory,
      product,
      productVariant,
      stockEntry,
      stockReceipt,
      user,
    } = schema;
    const { and, eq, inArray, isNotNull } = drizzle;
    const { resolveVariantOperations } = variantDefinition;
    const { warehouseRouter } = routerModule;
    const suffix = randomUUID();
    const warehouseId = `expiry-warehouse-${suffix}`;
    const createdProductIds: number[] = [];

    const candidates = await db.query.productVariant.findMany({
      where: isNotNull(productVariant.sourceVariantOptionId),
      with: { product: true, sourceVariantOption: true },
      limit: 200,
    });
    const directCandidate = candidates.find(
      (candidate) =>
        candidate.sourceVariantOption &&
        resolveVariantOperations(candidate.sourceVariantOption)
          .receivingMode === "direct",
    );
    const nonDirectCandidate = candidates.find((candidate) => {
      if (!candidate.sourceVariantOption) return false;
      return (
        resolveVariantOperations(candidate.sourceVariantOption)
          .receivingMode !== "direct"
      );
    });
    assert.ok(directCandidate?.sourceVariantOption);

    const warehouseContext = {
      session: {
        user: {
          id: warehouseId,
          role: "warehouse",
          name: "Expiry Test Warehouse",
        },
      },
    };

    const createFixture = async (
      candidate: typeof directCandidate,
      label: string,
    ) => {
      assert.ok(candidate?.product && candidate.sourceVariantOptionId);
      const [ownedProduct] = await db
        .insert(product)
        .values({
          name: `Expiry Integration ${label} ${suffix.slice(0, 8)}`,
          slug: `expiry-integration-${label.toLowerCase()}-${suffix}`,
          categoryId: candidate.product.categoryId,
          size: candidate.product.size,
          price: candidate.price,
          image: candidate.product.image,
          trackingType: "batch",
          expiryEnabled: true,
          creatorSource: "warehouse",
          createdById: warehouseId,
          createdByWarehouseId: warehouseId,
        })
        .returning();
      assert.ok(ownedProduct);
      createdProductIds.push(ownedProduct.id);
      const [ownedVariant] = await db
        .insert(productVariant)
        .values({
          productId: ownedProduct.id,
          sku: `EXP-${label}-${suffix.slice(0, 8)}`,
          unitLabel: candidate.unitLabel,
          packagingType: candidate.packagingType,
          weightKg: candidate.weightKg,
          price: candidate.price,
          sourceVariantOptionId: candidate.sourceVariantOptionId,
          isActive: true,
        })
        .returning();
      assert.ok(ownedVariant);
      return { product: ownedProduct, variant: ownedVariant };
    };

    try {
      await db.insert(user).values({
        id: warehouseId,
        name: "Expiry Test Warehouse",
        email: `${warehouseId}@example.test`,
        role: "warehouse",
      });
      const direct = await createFixture(directCandidate, "DIRECT");
      const nonDirect = nonDirectCandidate?.sourceVariantOption
        ? await createFixture(nonDirectCandidate, "PACK")
        : null;

      const directInput = {
        idempotencyKey: randomUUID(),
        receiptDate: "2026-08-14",
        paymentMethod: "cash" as const,
        lines: [
          {
            variantId: direct.variant.id,
            quantity: 4,
            purchaseUnitCost: "15",
            batchNo: "DIRECT-LOT-1",
          },
        ],
      };
      await assert.rejects(
        invokeProcedure(
          warehouseRouter.createStockReceipt,
          warehouseContext,
          directInput,
        ),
        /requires an expiry date/i,
      );
      await invokeProcedure(
        warehouseRouter.createStockReceipt,
        warehouseContext,
        {
          ...directInput,
          idempotencyKey: randomUUID(),
          lines: [
            {
              ...directInput.lines[0],
              manufactureDate: "2024-01-01",
              expiryDate: "2025-01-01",
            },
          ],
        },
      );

      if (nonDirectCandidate?.sourceVariantOption && nonDirect) {
        const nonDirectOperations = resolveVariantOperations(
          nonDirectCandidate.sourceVariantOption,
        );
        const nonDirectInput = {
          variantId: nonDirect.variant.id,
          entryType: nonDirectOperations.receivingMode as "loose" | "pack",
          quantity: "5",
          costType: "per_unit" as const,
          purchasePrice: "12",
          batchNo: "PACK-LOT-1",
        };
        await assert.rejects(
          invokeProcedure(
            warehouseRouter.addStockEntry,
            warehouseContext,
            nonDirectInput,
          ),
          /requires an expiry date/i,
        );
        await invokeProcedure(warehouseRouter.addStockEntry, warehouseContext, {
          ...nonDirectInput,
          manufactureDate: "2024-01-01",
          expiryDate: "2025-01-01",
        });
      }

      const directEntry = await db.query.stockEntry.findFirst({
        where: and(
          eq(stockEntry.warehouseId, warehouseId),
          eq(stockEntry.variantId, direct.variant.id),
        ),
      });
      assert.equal(directEntry?.batchNo, "DIRECT-LOT-1");
      assert.equal(directEntry?.expiryDate, "2025-01-01");

      const firstList = await invokeProcedure<{
        items: Array<{ stockEntryId: number; quantity: string }>;
      }>(warehouseRouter.getExpiredProducts, warehouseContext, {
        status: "tracked",
        search: direct.product.name,
      });
      assert.equal(firstList.items[0]?.stockEntryId, directEntry?.id);
      assert.equal(firstList.items[0]?.quantity, "4.00");

      await db
        .update(inventory)
        .set({ availableQty: "2" })
        .where(
          and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
            eq(inventory.variantId, direct.variant.id),
          ),
        );
      const reducedList = await invokeProcedure<{
        items: Array<{ stockEntryId: number; quantity: string }>;
      }>(warehouseRouter.getExpiredProducts, warehouseContext, {
        status: "tracked",
        search: direct.product.name,
      });
      assert.equal(reducedList.items[0]?.quantity, "2.00");
    } finally {
      await db
        .delete(stockEntry)
        .where(eq(stockEntry.warehouseId, warehouseId));
      await db
        .delete(stockReceipt)
        .where(eq(stockReceipt.warehouseId, warehouseId));
      await db
        .delete(inventory)
        .where(
          and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
          ),
        );
      if (createdProductIds.length) {
        await db.delete(product).where(inArray(product.id, createdProductIds));
      }
      await db.delete(user).where(eq(user.id, warehouseId));
    }
  },
);
