import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBreakdown,
  formatTotalStock,
  matchesStockSearch,
  narrowToScannedSize,
  type RealtimeStockProduct,
  type RealtimeStockVariant,
  soldTrend,
  stockLevelName,
  stockTrend,
  variantSizeLabel,
} from "./realtime-stock-model";

const product: RealtimeStockProduct = {
  productId: 9,
  productCode: "02020117",
  name: "Omera LPG Cylinder",
  typeId: 4,
  typeName: "Gas",
  categoryId: 8,
  categoryName: "LPG",
  subCategoryId: 5,
  subCategoryName: "Cylinder",
  lowStockLevel: 0,
  effectiveLowStockLevel: 5,
  breakdown: { counted: [{ unit: "Cylinder", quantity: 120 }], loose: [], empty: 30 },
  totalStock: 120,
  soldThisMonth: 0,
  expired: false,
  status: "in_stock",
  variants: [],
};

test("breakdown text follows the client's table", () => {
  assert.equal(formatBreakdown(product.breakdown), "120 Cylinder (30 Empty)");
  assert.equal(
    formatBreakdown({
      counted: [{ unit: "Pack", quantity: 120 }],
      loose: [{ unit: "KG", quantity: 900 }],
      empty: 0,
    }),
    "120 Pack + 900 KG Loose",
  );
  assert.equal(formatBreakdown({ counted: [], loose: [], empty: 0 }), "0");
});

test("search finds a product by name, Product ID or 13-digit code", () => {
  assert.equal(matchesStockSearch(product, "omera"), true);
  assert.equal(matchesStockSearch(product, "0202 0117"), true);
  assert.equal(matchesStockSearch(product, "rice"), false);
});

test("a full 13-digit code finds the exact size", () => {
  const twoSizes: RealtimeStockProduct = {
    ...product,
    variants: [
      size({ variantId: 1, label: "12 KG", codes: ["0202011700101", "0202011700102"] }),
      size({ variantId: 2, label: "35 KG", codes: ["0202011700301", "0202011700302"] }),
    ],
  };
  assert.equal(matchesStockSearch(twoSizes, "0202011700302"), true);
  assert.equal(matchesStockSearch(twoSizes, "0202 0117 0030 2"), true);
  assert.equal(matchesStockSearch(twoSizes, "0202011700402"), false);
  assert.deepEqual(
    narrowToScannedSize(twoSizes, "0202011700302").variants.map((v) => v.label),
    ["35 KG"],
  );
  assert.equal(narrowToScannedSize(twoSizes, "omera").variants.length, 2);
});

const size = (patch: Partial<RealtimeStockVariant>): RealtimeStockVariant => ({
  variantId: 1,
  label: "12 KG",
  brandName: "Omera",
  entryType: "pack",
  unit: "cylinder",
  availableQty: 25,
  emptyQty: 0,
  soldThisMonth: 0,
  soldLastMonth: 0,
  receivedThisMonth: 0,
  ...patch,
});

test("stock goes down when more sold this month than came in", () => {
  assert.equal(stockTrend(size({ soldThisMonth: 20, receivedThisMonth: 5 })), "down");
  assert.equal(stockTrend(size({ soldThisMonth: 5, receivedThisMonth: 20 })), "up");
  assert.equal(stockTrend(size({})), "flat");
});

test("sold compares this month with the same days last month", () => {
  assert.equal(soldTrend(size({ soldThisMonth: 9, soldLastMonth: 12 })), "down");
  assert.equal(soldTrend(size({ soldThisMonth: 12, soldLastMonth: 9 })), "up");
  assert.equal(soldTrend(size({ soldThisMonth: 3, soldLastMonth: 3 })), "flat");
});

test("the panel counts cylinders and leaves empties out of the total", () => {
  const withSizes = { ...product, variants: [size({}), size({ variantId: 2, label: "35 KG" })] };
  assert.equal(stockLevelName(withSizes), "Cylinder");
  assert.equal(formatTotalStock(product), "120 Cylinder");
});

test("the Size column shows the size without the unit word", () => {
  assert.equal(variantSizeLabel(size({ label: "12 KG cylinder" })), "12 KG");
  assert.equal(variantSizeLabel(size({ label: "12 KG Cylinders" })), "12 KG");
  assert.equal(variantSizeLabel(size({ label: "35 KG" })), "35 KG");
  assert.equal(variantSizeLabel(size({ label: "cylinder" })), "cylinder");
});
