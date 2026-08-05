import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProductTypeSellerRole,
  compareProductTypeSellers,
  type ProductTypeSellerRankingRow,
  resolveProductTypePagination,
} from "./product-type-sellers";

test("classifies documented business roles and applies account fallbacks", () => {
  assert.equal(classifyProductTypeSellerRole("Retail Shop", false), "retailer");
  assert.equal(
    classifyProductTypeSellerRole("Wholesale Distributor", false),
    "distributor",
  );
  assert.equal(
    classifyProductTypeSellerRole("Local Manufacturer", false),
    "manufacturer",
  );
  assert.equal(classifyProductTypeSellerRole("Importer", false), "importer");
  assert.equal(classifyProductTypeSellerRole(null, false), "retailer");
  assert.equal(classifyProductTypeSellerRole(null, true), "wholesaler");
});

test("ranks sellers by delivered orders, rating, then user ID", () => {
  const rows: ProductTypeSellerRankingRow[] = [
    {
      userId: "USR-3",
      displayName: "Third",
      deliveredOrderCount: 10,
      averageRating: 4.8,
    },
    {
      userId: "USR-2",
      displayName: "Second",
      deliveredOrderCount: 11,
      averageRating: 4.1,
    },
    {
      userId: "USR-1",
      displayName: "First",
      deliveredOrderCount: 10,
      averageRating: 4.8,
    },
    {
      userId: "USR-4",
      displayName: "Fourth",
      deliveredOrderCount: 10,
      averageRating: 4.9,
    },
  ];

  assert.deepEqual(
    rows.sort(compareProductTypeSellers).map((row) => row.userId),
    ["USR-2", "USR-4", "USR-1", "USR-3"],
  );
});

test("clamps requested pages and preserves empty-list pagination", () => {
  assert.deepEqual(resolveProductTypePagination(95, 99, 20), {
    page: 5,
    pageSize: 20,
    total: 95,
    totalPages: 5,
    offset: 80,
  });
  assert.deepEqual(resolveProductTypePagination(0, 4, 10), {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    offset: 0,
  });
});
