import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRetailerStorefrontFacets,
  filterAndSortRetailerStorefrontProducts,
  selectSellableRetailerVariants,
} from "./retailer-storefront-catalog";

const products = [
  {
    id: 1,
    name: "Omera LPG Cylinder",
    slug: "omera-lpg-cylinder",
    createdAt: "2026-07-14",
    lowestRetailPrice: 1600,
    category: { name: "LPG", slug: "lpg" },
    subCategory: { name: "Industrial LPG", slug: "industrial-lpg" },
    variants: [{ sku: "OM-12" }, { sku: "OM-35" }],
  },
  {
    id: 2,
    name: "Fresh LPG Cylinder",
    slug: "fresh-lpg-cylinder",
    createdAt: "2026-07-16",
    lowestRetailPrice: 2050,
    category: { name: "LPG", slug: "lpg" },
    subCategory: { name: "Household LPG", slug: "household-lpg" },
    variants: [{ sku: "FR-12" }],
  },
  {
    id: 3,
    name: "Safety regulator",
    slug: "safety-regulator",
    createdAt: "2026-07-15",
    lowestRetailPrice: 850,
    category: { name: "Accessories", slug: "accessories" },
    subCategory: null,
    variants: [{ sku: "REG-01" }],
  },
];

test("builds nested facets from the complete sellable catalog", () => {
  assert.deepEqual(buildRetailerStorefrontFacets(products), [
    {
      name: "Accessories",
      slug: "accessories",
      count: 1,
      subcategories: [],
    },
    {
      name: "LPG",
      slug: "lpg",
      count: 2,
      subcategories: [
        { name: "Household LPG", slug: "household-lpg", count: 1 },
        { name: "Industrial LPG", slug: "industrial-lpg", count: 1 },
      ],
    },
  ]);
});

test("searches product names and retailer SKUs case-insensitively", () => {
  assert.deepEqual(
    filterAndSortRetailerStorefrontProducts(products, {
      search: "om-35",
      sort: "recommended",
    }).map((product) => product.id),
    [1],
  );
  assert.deepEqual(
    filterAndSortRetailerStorefrontProducts(products, {
      search: "lpg",
      sort: "recommended",
    }).map((product) => product.name),
    ["Fresh LPG Cylinder", "Omera LPG Cylinder"],
  );
});

test("selects one exact retailer product by slug for direct-order details", () => {
  assert.deepEqual(
    filterAndSortRetailerStorefrontProducts(products, {
      productSlug: "fresh-lpg-cylinder",
      sort: "recommended",
    }).map((product) => product.id),
    [2],
  );
});

test("applies hierarchical filters and every catalog sort", () => {
  assert.deepEqual(
    filterAndSortRetailerStorefrontProducts(products, {
      category: "lpg",
      subcategory: "household-lpg",
      sort: "newest",
    }).map((product) => product.id),
    [2],
  );
  assert.deepEqual(
    filterAndSortRetailerStorefrontProducts(products, {
      sort: "price_asc",
    }).map((product) => product.id),
    [3, 1, 2],
  );
  assert.deepEqual(
    filterAndSortRetailerStorefrontProducts(products, {
      sort: "price_desc",
    }).map((product) => product.id),
    [2, 1, 3],
  );
  assert.deepEqual(
    filterAndSortRetailerStorefrontProducts(products, {
      sort: "name_asc",
    }).map((product) => product.id),
    [2, 1, 3],
  );
});

test("isolates a retailer's sellable variants from other shops and unavailable rows", () => {
  const rows = [
    {
      ownerId: "shop-a",
      retailPrice: "120.00",
      availableQty: "4",
      variant: { id: 2, productId: 10, isActive: true, sortOrder: 2 },
    },
    {
      ownerId: "shop-b",
      retailPrice: "90.00",
      availableQty: "8",
      variant: { id: 3, productId: 10, isActive: true, sortOrder: 1 },
    },
    {
      ownerId: "shop-a",
      retailPrice: "100.00",
      availableQty: "2",
      variant: { id: 1, productId: 10, isActive: true, sortOrder: 1 },
    },
    {
      ownerId: "shop-a",
      retailPrice: "80.00",
      availableQty: "0",
      variant: { id: 4, productId: 10, isActive: true, sortOrder: 3 },
    },
    {
      ownerId: "shop-a",
      retailPrice: "70.00",
      availableQty: "5",
      variant: { id: 5, productId: 10, isActive: false, sortOrder: 4 },
    },
  ];

  assert.deepEqual(
    selectSellableRetailerVariants(rows, {
      shopId: "shop-a",
      productId: 10,
    }).map((row) => row.variant.id),
    [1, 2],
  );
  assert.deepEqual(
    selectSellableRetailerVariants(rows, {
      shopId: "shop-missing",
      productId: 10,
    }),
    [],
  );
});
