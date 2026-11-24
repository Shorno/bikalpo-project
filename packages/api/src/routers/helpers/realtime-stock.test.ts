import assert from "node:assert/strict";
import test from "node:test";
import { stockBreakdown, stockStatus, totalStock } from "./realtime-stock";

test("cylinders add up, with their empties", () => {
  const breakdown = stockBreakdown([
    { entryType: "pack", unit: "cylinder", availableQty: 70, emptyQty: 20 },
    { entryType: "pack", unit: "cylinder", availableQty: 50, emptyQty: 10 },
  ]);
  assert.deepEqual(breakdown, {
    counted: [{ unit: "Cylinder", quantity: 120 }],
    loose: [],
    empty: 30,
  });
  assert.equal(totalStock(breakdown), 120);
});

test("packs and loose stock are kept apart", () => {
  const breakdown = stockBreakdown([
    { entryType: "pack", unit: "pack", availableQty: 120, emptyQty: 0 },
    { entryType: "loose", unit: "kg", availableQty: 900.5, emptyQty: 0 },
  ]);
  assert.deepEqual(breakdown.counted, [{ unit: "Pack", quantity: 120 }]);
  assert.deepEqual(breakdown.loose, [{ unit: "KG", quantity: 900.5 }]);
  assert.equal(totalStock(breakdown), 120);
});

test("loose-only products count their loose stock", () => {
  const breakdown = stockBreakdown([
    { entryType: "loose", unit: "kg", availableQty: 40, emptyQty: 0 },
  ]);
  assert.equal(totalStock(breakdown), 40);
  assert.equal(
    stockStatus({ breakdown, lowStockLevel: 50, expired: false }),
    "low_stock",
  );
});

test("status: out, expired, low, then in stock", () => {
  const empty = stockBreakdown([
    { entryType: "pack", unit: "pack", availableQty: 0, emptyQty: 4 },
  ]);
  assert.equal(
    stockStatus({ breakdown: empty, lowStockLevel: 5, expired: true }),
    "out_of_stock",
  );
  const some = stockBreakdown([
    { entryType: "pack", unit: "pack", availableQty: 5, emptyQty: 0 },
  ]);
  assert.equal(
    stockStatus({ breakdown: some, lowStockLevel: 5, expired: true }),
    "expired",
  );
  assert.equal(
    stockStatus({ breakdown: some, lowStockLevel: 5, expired: false }),
    "low_stock",
  );
  assert.equal(
    stockStatus({ breakdown: some, lowStockLevel: 4, expired: false }),
    "in_stock",
  );
});
