import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBreakdown,
  matchesStockSearch,
  type RealtimeStockProduct,
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
  assert.equal(matchesStockSearch(product, "0202011700302"), true);
  assert.equal(matchesStockSearch(product, "0202011800302"), false);
  assert.equal(matchesStockSearch(product, "rice"), false);
});
