import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextRetailerQuantity,
  getRetailerPurchaseBounds,
} from "./retailer-purchase";

test("caps retailer purchase quantities by stock and the configured order maximum", () => {
  assert.deepEqual(
    getRetailerPurchaseBounds({
      availableQuantity: 8,
      orderMin: 2,
      orderMax: 5,
      orderIncrement: 2,
    }),
    {
      minimum: 2,
      maximum: 5,
      increment: 2,
      initialQuantity: 2,
      canPurchase: true,
    },
  );

  assert.deepEqual(
    getRetailerPurchaseBounds({
      availableQuantity: 3,
      orderMin: 1,
      orderMax: 20,
      orderIncrement: 1,
    }),
    {
      minimum: 1,
      maximum: 3,
      increment: 1,
      initialQuantity: 1,
      canPurchase: true,
    },
  );
});

test("disables purchase when available stock cannot satisfy the minimum", () => {
  assert.deepEqual(
    getRetailerPurchaseBounds({
      availableQuantity: 2,
      orderMin: 4,
      orderMax: 10,
      orderIncrement: 0,
    }),
    {
      minimum: 4,
      maximum: 2,
      increment: 1,
      initialQuantity: 0,
      canPurchase: false,
    },
  );
});

test("moves through valid retailer quantities without crossing increment boundaries", () => {
  const bounds = getRetailerPurchaseBounds({
    availableQuantity: 5,
    orderMin: 2,
    orderMax: 5,
    orderIncrement: 2,
  });

  assert.equal(getNextRetailerQuantity(2, "increase", bounds), 4);
  assert.equal(getNextRetailerQuantity(4, "increase", bounds), 4);
  assert.equal(getNextRetailerQuantity(4, "decrease", bounds), 2);
  assert.equal(getNextRetailerQuantity(2, "decrease", bounds), 2);
});
