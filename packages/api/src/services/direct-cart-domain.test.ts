import assert from "node:assert/strict";
import test from "node:test";
import {
  getDirectCartInventoryIssue,
  resolveDirectCartInventorySnapshot,
} from "./direct-cart-domain";

test("retailer inventory is the stock source for direct cart items", () => {
  assert.equal(
    getDirectCartInventoryIssue({
      availableQuantity: 11,
      requestedQuantity: 1,
      retailPrice: 1600,
    }),
    null,
  );
});

test("direct cart presentation uses the exact retailer inventory and price", () => {
  assert.deepEqual(
    resolveDirectCartInventorySnapshot({
      availableQuantity: 10,
      requestedQuantity: 1,
      retailPrice: 5800,
    }),
    {
      currentPrice: 5800,
      inStock: true,
      issue: null,
    },
  );
});

test("direct cart inventory rejects missing stock and invalid prices", () => {
  assert.equal(
    getDirectCartInventoryIssue({
      availableQuantity: 0,
      requestedQuantity: 1,
      retailPrice: 1600,
    }),
    "This retailer does not have enough stock for the selected variant.",
  );
  assert.equal(
    getDirectCartInventoryIssue({
      availableQuantity: 11,
      requestedQuantity: 1,
      retailPrice: 0,
    }),
    "This retailer has not configured a valid price for the selected variant.",
  );
});
