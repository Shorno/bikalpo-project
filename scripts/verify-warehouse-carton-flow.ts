import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: "apps/server/.env" });

const requireFromDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url),
);
const { and, count, eq, inArray, ne, sql } = requireFromDb("drizzle-orm");
const { db } = await import("../packages/db/src/index.ts");
const {
  carton,
  inventory,
  order,
  orderItem,
  productVariant,
} = await import("../packages/db/src/schema/index.ts");
const {
  convertB2bOrderToRetailInventory,
} = await import("../packages/api/src/routers/helpers/b2b-conversion.ts");

const TEST_AVAILABLE_QTY = 80;
const TEST_PACKS_PER_CARTON = 20;
const TEST_CARTON_COUNT = 2;
const ROLLBACK_MARKER = "VERIFY_CARTON_FLOW_ROLLBACK";

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const candidates = await db.query.inventory.findMany({
  where: and(
    eq(inventory.ownerType, "warehouse"),
    sql`${inventory.availableQty}::numeric > 0`,
  ),
  limit: 100,
  with: {
    variant: {
      columns: {
        id: true,
        productId: true,
        unitLabel: true,
        weightKg: true,
        packType: true,
        packagingType: true,
      },
      with: {
        product: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    },
  },
});

let candidate:
  | (typeof candidates)[number]
  | null = null;

for (const row of candidates) {
  const packType = (
    row.variant?.packType ||
    row.variant?.packagingType ||
    ""
  ).toLowerCase();

  if (packType === "loose") {
    continue;
  }

  if (toNumber(row.variant?.weightKg) <= 0 || !row.variant?.product) {
    continue;
  }

  const [activeCartonRow] = await db
    .select({ count: count() })
    .from(carton)
    .where(
      and(
        eq(carton.warehouseId, row.ownerId),
        eq(carton.variantId, row.variantId),
        eq(carton.status, "active"),
      ),
    );

  if (Number(activeCartonRow?.count || 0) === 0) {
    candidate = row;
    break;
  }
}

assert(candidate, "No warehouse pack variant without active cartons was found for verification.");

const variantId = candidate.variantId;
const warehouseId = candidate.ownerId;
const productId = candidate.variant!.productId;
const packWeightKg = toNumber(candidate.variant!.weightKg);
const unitLabel = candidate.variant!.unitLabel || `${packWeightKg}KG`;
const productName = candidate.variant!.product!.name;
const productImage = candidate.variant!.product!.image || "";
const testCartonIds = Array.from({ length: TEST_CARTON_COUNT }, (_, index) =>
  `TST-${Date.now()}-${index + 1}`,
);

let verificationResult: Record<string, unknown> | null = null;

try {
  await db.transaction(async (tx) => {
    await tx
      .update(inventory)
      .set({
        availableQty: TEST_AVAILABLE_QTY.toFixed(2),
        reservedQty: "0.00",
        inCartonQty: "0.00",
        activeCartonCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, candidate!.id));

    let runningInCartonQty = 0;
    let runningCartonCount = 0;

    for (const [index, cartonIdValue] of testCartonIds.entries()) {
      runningInCartonQty += TEST_PACKS_PER_CARTON;
      runningCartonCount += 1;

      await tx.insert(carton).values({
        cartonId: cartonIdValue,
        warehouseId,
        variantId,
        totalPacks: TEST_PACKS_PER_CARTON,
        totalWeightKg: (TEST_PACKS_PER_CARTON * packWeightKg).toFixed(2),
        status: "active",
        barcode: cartonIdValue,
        createdAt: new Date(Date.now() + index),
        updatedAt: new Date(Date.now() + index),
      });

      await tx
        .update(inventory)
        .set({
          inCartonQty: runningInCartonQty.toFixed(2),
          activeCartonCount: runningCartonCount,
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, candidate!.id));
    }

    const createdInventory = await tx.query.inventory.findFirst({
      where: eq(inventory.id, candidate!.id),
    });

    assert(createdInventory, "Inventory row disappeared during verification.");
    assert.equal(toNumber(createdInventory.availableQty), TEST_AVAILABLE_QTY);
    assert.equal(
      toNumber(createdInventory.inCartonQty),
      TEST_PACKS_PER_CARTON * TEST_CARTON_COUNT,
    );
    assert.equal(toNumber(createdInventory.activeCartonCount), TEST_CARTON_COUNT);

    const availableForCartonAfterCreate =
      toNumber(createdInventory.availableQty) - toNumber(createdInventory.inCartonQty);

    assert.equal(availableForCartonAfterCreate, 40);

    const orderNumber = `VERIFY-CTN-${Date.now()}`;
    const [createdOrder] = await tx
      .insert(order)
      .values({
        orderNumber,
        userId: warehouseId,
        orderType: "b2b",
        warehouseId,
        subtotal: "200.00",
        total: "200.00",
        shippingName: "Carton Flow Verification",
        shippingPhone: "01700000000",
        shippingAddress: "Rollback Test Address",
        shippingCity: "Dhaka",
      })
      .returning({ id: order.id });

    await tx.insert(orderItem).values({
      orderId: createdOrder.id,
      productId,
      variantId,
      targetVariantId: variantId,
      supplyMode: "pack",
      productName,
      productImage,
      productSize: unitLabel,
      quantity: TEST_CARTON_COUNT,
      unitPrice: "100.00",
      totalPrice: "200.00",
    });

    await convertB2bOrderToRetailInventory(tx, createdOrder.id);

    const deliveredInventory = await tx.query.inventory.findFirst({
      where: eq(inventory.id, candidate!.id),
    });

    assert(deliveredInventory, "Inventory row disappeared after delivery verification.");
    assert.equal(toNumber(deliveredInventory.availableQty), 40);
    assert.equal(toNumber(deliveredInventory.inCartonQty), 0);
    assert.equal(toNumber(deliveredInventory.activeCartonCount), 0);

    const soldTestCartons = await tx.query.carton.findMany({
      where: and(
        eq(carton.warehouseId, warehouseId),
        eq(carton.variantId, variantId),
        eq(carton.status, "sold"),
        inArray(carton.cartonId, testCartonIds),
      ),
    });

    const activeTestCartons = await tx.query.carton.findMany({
      where: and(
        eq(carton.warehouseId, warehouseId),
        eq(carton.variantId, variantId),
        eq(carton.status, "active"),
        inArray(carton.cartonId, testCartonIds),
      ),
    });

    assert.equal(soldTestCartons.length, TEST_CARTON_COUNT);
    assert.equal(activeTestCartons.length, 0);

    const [visibleTrackingRow] = await tx
      .select({ count: count() })
      .from(carton)
      .where(
        and(
          eq(carton.warehouseId, warehouseId),
          eq(carton.variantId, variantId),
          inArray(carton.cartonId, testCartonIds),
          ne(carton.status, "sold"),
        ),
      );

    const [activeProductTrackingRow] = await tx
      .select({ count: count() })
      .from(carton)
      .innerJoin(productVariant, eq(carton.variantId, productVariant.id))
      .where(
        and(
          eq(carton.warehouseId, warehouseId),
          eq(productVariant.productId, productId),
          eq(carton.status, "active"),
          inArray(carton.cartonId, testCartonIds),
        ),
      );

    assert.equal(Number(visibleTrackingRow?.count || 0), 0);
    assert.equal(Number(activeProductTrackingRow?.count || 0), 0);

    verificationResult = {
      variantId,
      productId,
      productName,
      warehouseId,
      afterCartonCreate: {
        totalPacks: toNumber(createdInventory.availableQty),
        packedIntoCartons: toNumber(createdInventory.inCartonQty),
        availableForCartonGeneration: availableForCartonAfterCreate,
        activeCartonCount: toNumber(createdInventory.activeCartonCount),
      },
      afterOrderDelivered: {
        totalPacks: toNumber(deliveredInventory.availableQty),
        packedIntoCartons: toNumber(deliveredInventory.inCartonQty),
        activeCartonCount: toNumber(deliveredInventory.activeCartonCount),
        soldCartonIds: soldTestCartons.map((entry) => entry.cartonId),
        visibleTrackingCartons: Number(visibleTrackingRow?.count || 0),
      },
    };

    throw new Error(ROLLBACK_MARKER);
  });
} catch (error) {
  if (!(error instanceof Error) || error.message !== ROLLBACK_MARKER) {
    throw error;
  }
}

console.log(JSON.stringify(verificationResult, null, 2));
