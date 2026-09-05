import assert from "node:assert/strict";
import test from "node:test";
import {
  collectAvailableRetailerBrands,
  isAvailableRetailerStock,
  type RetailerStockRow,
} from "./retailer-stock-availability";

const now = new Date("2026-09-05T00:00:00Z");
function stockedBrand(id: number, name = `Brand ${id}`): RetailerStockRow {
  return {
    availableQty: "2",
    retailPrice: "120",
    variant: {
      isActive: true,
      product: {
        status: "active",
        visibility: "public",
        creatorSource: "shop",
        createdById: "store-a",
        scheduledAt: null,
        brand: { id, name, slug: `brand-${id}`, logo: null },
      },
    },
  };
}

test("collects the full stock list, deduplicates repeated variants and preserves brand identity/logo", () => {
  const rows = Array.from({ length: 18 }, (_, i) => stockedBrand(i + 1));
  rows.push(stockedBrand(1));
  rows[17].variant!.product!.brand!.logo = "/logos/brand-18.png";
  const result = collectAvailableRetailerBrands(rows, "store-a", now);
  assert.equal(result.length, 18);
  assert.deepEqual(
    result.find((b) => b.id === 18),
    { id: 18, name: "Brand 18", slug: "brand-18", logo: "/logos/brand-18.png" },
  );
  assert.deepEqual(
    collectAvailableRetailerBrands(
      [stockedBrand(1, "Zeta"), stockedBrand(2, "Alpha")],
      "store-a",
      now,
    ).map((b) => b.name),
    ["Alpha", "Zeta"],
  );
});

test("brands and products exclude unavailable, private, unpublished and foreign inventory", () => {
  const mutations: Array<(row: RetailerStockRow) => void> = [
    (row) => {
      row.availableQty = "0";
    },
    (row) => {
      row.availableQty = "-1";
    },
    (row) => {
      row.retailPrice = "0";
    },
    (row) => {
      row.variant!.isActive = false;
    },
    (row) => {
      row.variant!.product!.status = "draft";
    },
    (row) => {
      row.variant!.product!.visibility = "private";
    },
    (row) => {
      row.variant!.product!.creatorSource = "warehouse";
    },
    (row) => {
      row.variant!.product!.createdById = "store-b";
    },
    (row) => {
      row.variant!.product!.scheduledAt = new Date("2026-09-06T00:00:00Z");
    },
    (row) => {
      row.variant!.product = null;
    },
    (row) => {
      row.variant = null;
    },
  ];
  for (const mutate of mutations) {
    const row = stockedBrand(1);
    mutate(row);
    assert.equal(isAvailableRetailerStock(row, "store-a", now), false);
    assert.deepEqual(collectAvailableRetailerBrands([row], "store-a", now), []);
  }
});

test("an unbranded product stays available but produces no brand; publishing at the current time is available", () => {
  const row = stockedBrand(1);
  row.variant!.product!.scheduledAt = now;
  row.variant!.product!.brand = null;
  assert.equal(isAvailableRetailerStock(row, "store-a", now), true);
  assert.deepEqual(collectAvailableRetailerBrands([row], "store-a", now), []);
  assert.deepEqual(collectAvailableRetailerBrands([], "store-a", now), []);
});
