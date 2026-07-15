import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCompatibleB2bTargetVariant,
  buildB2bMovementSnapshot,
  getReceivedRetailerQty,
} from "./b2b-inventory-movement";

test("direct cylinders preserve approved order quantities", () => {
  const result = buildB2bMovementSnapshot({
    orderQty: 2,
    mode: "cylinder",
    inventoryBehaviour: "fixed_pack",
    stockUnit: "cylinder",
  });
  assert.equal(result.sourceInventoryQty, 2);
  assert.equal(result.retailerInventoryQty, 2);
  assert.equal(result.conversionFactor, 1);
});

test("container reservations use the exact FIFO carton contents", () => {
  const result = buildB2bMovementSnapshot({
    orderQty: 2,
    mode: "carton",
    inventoryBehaviour: "auto_break",
    stockUnit: "pack",
    cartons: [
      { id: 11, totalPacks: 10, totalWeightKg: 50 },
      { id: 12, totalPacks: 12, totalWeightKg: 60 },
    ],
  });
  assert.equal(result.sourceInventoryQty, 22);
  assert.equal(result.retailerInventoryQty, 22);
  assert.deepEqual(result.cartonIds, [11, 12]);
});

test("short receipt credits only the actual received proportion", () => {
  assert.equal(
    getReceivedRetailerQty({
      receivedOrderQty: 1,
      approvedOrderQty: 2,
      retailerInventoryQty: 20,
    }),
    10,
  );
});

test("target identity rejects cross-brand variants", () => {
  assert.throws(() =>
    assertCompatibleB2bTargetVariant(
      { id: 1, productId: 4, brandId: 20 },
      { id: 2, productId: 4, brandId: 16 },
    ),
  );
});

test("Global SKU identity matches owner-specific variants", () => {
  assert.doesNotThrow(() =>
    assertCompatibleB2bTargetVariant(
      { id: 1, productId: 4, catalogVariantId: 27 },
      { id: 2, productId: 19, catalogVariantId: 27 },
    ),
  );
});

test("Global SKU identity permits only its configured conversion target", () => {
  assert.doesNotThrow(() =>
    assertCompatibleB2bTargetVariant(
      {
        id: 1,
        productId: 4,
        catalogVariantId: 27,
        catalogVariant: { conversionTargetCatalogVariantId: 28 },
      },
      { id: 2, productId: 19, catalogVariantId: 28 },
    ),
  );

  assert.throws(() =>
    assertCompatibleB2bTargetVariant(
      {
        id: 1,
        productId: 4,
        catalogVariantId: 27,
        catalogVariant: { conversionTargetCatalogVariantId: 28 },
      },
      { id: 3, productId: 19, catalogVariantId: 29 },
    ),
  );
});
