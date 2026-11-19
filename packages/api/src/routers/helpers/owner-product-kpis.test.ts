import assert from "node:assert/strict";
import test from "node:test";
import {
  countSlowMoving,
  inventoryValueKpis,
  kpiMonths,
  kpiProducts,
  productCountKpis,
} from "./owner-product-kpis";
import type { OwnerProductVariantRow } from "./owner-product-list";

// 20 Nov 2026, 10:00 in Dhaka.
const now = new Date("2026-11-20T04:00:00Z");

function row(
  overrides: Partial<OwnerProductVariantRow>,
): OwnerProductVariantRow {
  return {
    productId: 1,
    productName: "Fresh Soybean Oil",
    productCode: "0101010101",
    productStatus: "active",
    productCreatedAt: new Date("2026-06-10T00:00:00Z"),
    coreProductName: "Soybean Oil",
    typeId: 1,
    typeName: "Grocery",
    family: null,
    categoryId: 10,
    categoryName: "Oil",
    subCategoryId: null,
    subCategoryName: null,
    variantId: 11,
    variantOption: null,
    variantUnitLabel: "5L",
    availableQty: "10",
    price: "900",
    ...overrides,
  };
}

test("months follow the Bangladesh calendar, oldest first", () => {
  const months = kpiMonths(now);
  assert.deepEqual(
    months.map((month) => month.key),
    ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"],
  );
  assert.equal(months[5]?.label, "Nov 2026");
  // Dhaka midnight on 1 Nov is 18:00 UTC on 31 Oct.
  assert.equal(months[5]?.start.toISOString(), "2026-10-31T18:00:00.000Z");
  // 1 Dec 00:30 in Dhaka is still 30 Nov in UTC but already December.
  assert.equal(kpiMonths(new Date("2026-11-30T18:30:00Z"), 1)[0]?.key, "2026-12");
});

test("products card counts total, new this month, inactive, and month-end totals", () => {
  const months = kpiMonths(now);
  const kpis = productCountKpis(
    [
      { createdAt: new Date("2026-05-01T00:00:00Z"), isActive: true },
      { createdAt: new Date("2026-09-15T00:00:00Z"), isActive: false },
      { createdAt: new Date("2026-11-02T00:00:00Z"), isActive: true },
      { createdAt: new Date("2026-11-19T00:00:00Z"), isActive: true },
    ],
    months,
    now,
  );
  assert.equal(kpis.total, 4);
  assert.equal(kpis.newThisMonth, 2);
  assert.equal(kpis.inactive, 1);
  assert.deepEqual(
    kpis.trend.map((point) => point.value),
    [1, 1, 1, 2, 2, 4],
  );
});

test("kpi products total stock per product and keep the list's value", () => {
  const products = kpiProducts([
    row({}),
    row({ variantId: 12, availableQty: "-3", price: "500" }),
    row({ productId: 2, variantId: null, availableQty: null, price: null }),
  ]);
  assert.equal(products.length, 2);
  assert.deepEqual(products[0]?.variantIds, [11, 12]);
  assert.equal(products[0]?.stockQty, 10);
  assert.equal(products[0]?.value, 9000);
  assert.deepEqual(products[1]?.variantIds, []);
  assert.equal(products[1]?.stockQty, 0);
});

test("slow-moving needs stock, 30 days of age, and no sale of any variant", () => {
  const since = new Date("2026-10-21T04:00:00Z");
  const old = new Date("2026-08-01T00:00:00Z");
  const count = countSlowMoving(
    [
      { createdAt: old, stockQty: 5, variantIds: [1, 2] }, // variant 2 sold
      { createdAt: old, stockQty: 5, variantIds: [3] }, // slow
      { createdAt: old, stockQty: 0, variantIds: [4] }, // no stock
      { createdAt: new Date("2026-11-01T00:00:00Z"), stockQty: 5, variantIds: [5] }, // too new
    ],
    new Set([2]),
    since,
  );
  assert.equal(count, 1);
});

test("inventory value compares with last month's snapshot when one exists", () => {
  const months = kpiMonths(now);
  const withHistory = inventoryValueKpis(
    120_000,
    new Map([
      ["2026-09", 90_000],
      ["2026-10", 100_000],
    ]),
    months,
    2,
  );
  assert.equal(withHistory.previousMonth, 100_000);
  assert.equal(withHistory.changePercent, 20);
  assert.equal(withHistory.slowMoving, 2);
  assert.deepEqual(
    withHistory.trend.map((point) => point.value),
    [null, null, null, 90_000, 100_000, 120_000],
  );

  const firstMonth = inventoryValueKpis(5000, new Map(), months, 0);
  assert.equal(firstMonth.previousMonth, null);
  assert.equal(firstMonth.changePercent, null);
});
