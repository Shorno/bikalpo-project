import assert from "node:assert/strict";
import test from "node:test";
import {
  canAddToCustomerCart,
  getCustomerCartStockSource,
  getCustomerOrderLineDecision,
  getRetailerCartDecision,
  isSameCustomerCartSnapshot,
  retailerCylinderExchangeAvailable,
  resolveCustomerCartSource,
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
  exchangeEnabled: false,
  exchangeCreditAmount: "0",
  isReturnablePack: false,
  typeFamily: null,
  typeName: null,
  typeSlug: null,
};

test("resolves one retailer as the cart and order source", () => {
  assert.deepEqual(resolveCustomerCartSource(["shop-a", "shop-a"]), {
    kind: "retailer",
    shopId: "shop-a",
  });
  assert.deepEqual(resolveCustomerCartSource([null, null]), {
    kind: "reference",
  });
  assert.deepEqual(resolveCustomerCartSource([]), { kind: "empty" });
});

test("rejects mixed retailers and retailer/reference cart mixtures", () => {
  assert.deepEqual(resolveCustomerCartSource(["shop-a", "shop-b"]), {
    kind: "mixed",
  });
  assert.deepEqual(resolveCustomerCartSource(["shop-a", null]), {
    kind: "mixed",
  });

  assert.deepEqual(canAddToCustomerCart(["shop-a"], "shop-a"), {
    ok: true,
  });
  assert.deepEqual(canAddToCustomerCart(["shop-a"], "shop-b"), {
    ok: false,
    reason: "different_retailer",
    shopId: "shop-a",
  });
  assert.deepEqual(canAddToCustomerCart(["shop-a"], undefined), {
    ok: false,
    reason: "mixed_source",
  });
  assert.deepEqual(canAddToCustomerCart([null], "shop-a"), {
    ok: false,
    reason: "mixed_source",
  });
});

test("detects a cart mutation after checkout takes its initial snapshot", () => {
  const expected = [
    {
      id: 1,
      productId: 8,
      variantId: 19,
      shopId: "shop-a",
      quantity: 1,
      price: "4550.00",
    },
  ];

  assert.equal(isSameCustomerCartSnapshot(expected, [...expected]), true);
  assert.equal(
    isSameCustomerCartSnapshot(expected, [
      { ...expected[0]!, quantity: 2 },
    ]),
    false,
  );
  assert.equal(
    isSameCustomerCartSnapshot(expected, [
      ...expected,
      {
        id: 2,
        productId: 9,
        variantId: 21,
        shopId: "shop-a",
        quantity: 1,
        price: "1600.00",
      },
    ]),
    false,
  );
});

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

test("validates a retailer order line without consulting reference stock", () => {
  assert.deepEqual(
    getCustomerOrderLineDecision(inventorySnapshot, {
      shopId: "shop-shorno",
      productId: 8,
      variantId: 19,
      quantity: 1,
      referenceProductInStock: false,
    }),
    {
      ok: true,
      source: "retailer",
      availableQuantity: 2,
      retailPrice: "4550.00",
    },
  );

  assert.deepEqual(
    getCustomerOrderLineDecision(null, {
      productId: 8,
      variantId: null,
      quantity: 1,
      referenceProductInStock: false,
    }),
    { ok: false, source: "reference", reason: "not_sellable" },
  );

  assert.deepEqual(
    getCustomerOrderLineDecision(null, {
      productId: 8,
      variantId: 19,
      quantity: 3,
      referenceProductInStock: true,
      referenceAvailableQuantity: 2,
    }),
    {
      ok: false,
      source: "reference",
      reason: "insufficient_stock",
      availableQuantity: 2,
    },
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
  assert.deepEqual(
    getRetailerCartDecision(
      { ...constrainedSnapshot, orderMax: "4.00" },
      {
        shopId: "shop-shorno",
        productId: 8,
        variantId: 19,
        requestedQuantity: 6,
        existingQuantity: 0,
      },
    ),
    { ok: false, reason: "invalid_quantity", availableQuantity: 8 },
  );
});

test("Exchange follows the exact retailer variant flag", () => {
  assert.equal(
    retailerCylinderExchangeAvailable({
      ...inventorySnapshot,
      isReturnablePack: true,
      typeFamily: "lpg",
      typeName: "LPG",
      typeSlug: "lpg",
      exchangeEnabled: false,
    }),
    false,
  );
  assert.equal(
    retailerCylinderExchangeAvailable({
      ...inventorySnapshot,
      isReturnablePack: false,
      typeFamily: "lpg",
      exchangeEnabled: true,
    }),
    true,
  );
});
