import assert from "node:assert/strict";
import test from "node:test";
import {
  getCustomerCartStockSource,
  getRetailerCartDecision,
} from "./retailer-cart-inventory";

const inventorySnapshot = {
  shopId: "shop-shorno",
  productId: 8,
  variantId: 19,
  variantIsActive: true,
  productStatus: "active",
  productVisibility: "public",
  referenceProductInStock: false,
  availableQty: "2.00",
  retailPrice: "4550.00",
  orderMin: "1.00",
  orderMax: null,
  orderIncrement: "1.00",
};

test("selects retailer inventory instead of the false reference stock flag", () => {
  assert.deepEqual(
    getCustomerCartStockSource({
      shopId: "shop-shorno",
      referenceProductInStock: false,
    }),
    { source: "retailer", shopId: "shop-shorno" },
  );
  assert.deepEqual(
    getCustomerCartStockSource({ referenceProductInStock: false }),
    { source: "reference", inStock: false },
  );
});

test("accepts exact retailer inventory even when the reference product stock flag is false", () => {
  assert.deepEqual(
    getRetailerCartDecision(inventorySnapshot, {
      shopId: "shop-shorno",
      productId: 8,
      variantId: 19,
      requestedQuantity: 1,
      existingQuantity: 0,
    }),
    {
      ok: true,
      availableQuantity: 2,
      totalQuantity: 1,
      retailPrice: "4550.00",
    },
  );
});

test("rejects mismatched variants and quantities above retailer availability", () => {
  assert.deepEqual(
    getRetailerCartDecision(inventorySnapshot, {
      shopId: "shop-shorno",
      productId: 8,
      variantId: 20,
      requestedQuantity: 1,
      existingQuantity: 0,
    }),
    { ok: false, reason: "not_sellable", availableQuantity: 0 },
  );

  assert.deepEqual(
    getRetailerCartDecision(inventorySnapshot, {
      shopId: "shop-shorno",
      productId: 8,
      variantId: 19,
      requestedQuantity: 1,
      existingQuantity: 2,
    }),
    {
      ok: false,
      reason: "insufficient_stock",
      availableQuantity: 2,
    },
  );
});

test("rejects inactive, unpriced, and depleted retailer inventory", () => {
  for (const snapshot of [
    { ...inventorySnapshot, variantIsActive: false },
    { ...inventorySnapshot, productStatus: "inactive" },
    { ...inventorySnapshot, productVisibility: "private" },
    { ...inventorySnapshot, retailPrice: "0.00" },
  ]) {
    assert.deepEqual(
      getRetailerCartDecision(snapshot, {
        shopId: "shop-shorno",
        productId: 8,
        variantId: 19,
        requestedQuantity: 1,
        existingQuantity: 0,
      }),
      { ok: false, reason: "not_sellable", availableQuantity: 0 },
    );
  }

  assert.deepEqual(
    getRetailerCartDecision(
      { ...inventorySnapshot, availableQty: "0.00" },
      {
        shopId: "shop-shorno",
        productId: 8,
        variantId: 19,
        requestedQuantity: 1,
        existingQuantity: 0,
      },
    ),
    { ok: false, reason: "insufficient_stock", availableQuantity: 0 },
  );
});

test("enforces the selected retailer variant's minimum and increment", () => {
  const constrainedSnapshot = {
    ...inventorySnapshot,
    availableQty: "8.00",
    orderMin: "2.00",
    orderIncrement: "2.00",
  };

  assert.deepEqual(
    getRetailerCartDecision(constrainedSnapshot, {
      shopId: "shop-shorno",
      productId: 8,
      variantId: 19,
      requestedQuantity: 1,
      existingQuantity: 0,
    }),
    { ok: false, reason: "invalid_quantity", availableQuantity: 8 },
  );
  assert.equal(
    getRetailerCartDecision(constrainedSnapshot, {
      shopId: "shop-shorno",
      productId: 8,
      variantId: 19,
      requestedQuantity: 4,
      existingQuantity: 0,
    }).ok,
    true,
  );
});
