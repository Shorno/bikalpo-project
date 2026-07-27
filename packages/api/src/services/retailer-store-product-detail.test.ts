import assert from "node:assert/strict";
import test from "node:test";
import { buildStoreProductDetail } from "./retailer-store-product-detail";

test("store details preserve a retailer-only product without an admin identity", () => {
  const result = buildStoreProductDetail({
    shop: {
      id: "shop-1",
      name: "Retailer owner",
      shopName: "Independent Store",
      shopSlug: "independent-store",
      shopAddress: "Dhaka",
      businessType: "retail",
      image: null,
      shopLat: null,
      shopLng: null,
    },
    product: {
      id: 99,
      coreProductId: null,
      name: "Retailer-only product",
      slug: "retailer-only-product",
      description: "<p>Retailer-owned description</p>",
      shortDescription: "Retailer summary",
      image: "/retailer-product.png",
      size: "Unit",
      features: [
        { title: "Details", items: [{ key: "Source", value: "Shop" }] },
      ],
      creatorSource: "shop",
      createdById: "shop-1",
      category: { name: "Local", slug: "local" },
      subCategory: null,
      brand: { id: 8, name: "Local Brand", slug: "local-brand" },
      images: [{ imageUrl: "/retailer-product-2.png" }],
    },
    variants: [
      {
        id: 501,
        sku: "LOCAL-1",
        unitLabel: "Single unit",
        quantitySelectorLabel: null,
        price: "50",
        weightKg: "1",
        packagingType: "unit",
        origin: null,
        shelfLife: null,
        orderMin: "1",
        orderMax: null,
        orderIncrement: "1",
        orderUnit: "unit",
        quantitySelectorOptions: [],
        sortOrder: 0,
        variantType: null,
        packType: null,
        isActive: true,
        inventory: { availableQty: "3", retailPrice: "55" },
      },
      {
        id: 502,
        sku: "LOCAL-2",
        unitLabel: "Case",
        quantitySelectorLabel: null,
        price: "65",
        weightKg: "5",
        packagingType: "case",
        origin: null,
        shelfLife: null,
        orderMin: "1",
        orderMax: null,
        orderIncrement: "1",
        orderUnit: "case",
        quantitySelectorOptions: [],
        sortOrder: 1,
        variantType: null,
        packType: null,
        isActive: true,
        inventory: { availableQty: "0", retailPrice: "70" },
      },
      {
        id: 503,
        sku: "INACTIVE",
        unitLabel: "Inactive",
        quantitySelectorLabel: null,
        price: "40",
        weightKg: "1",
        packagingType: "unit",
        origin: null,
        shelfLife: null,
        orderMin: "1",
        orderMax: null,
        orderIncrement: "1",
        orderUnit: "unit",
        quantitySelectorOptions: [],
        sortOrder: 2,
        variantType: null,
        packType: null,
        isActive: false,
        inventory: { availableQty: "9", retailPrice: "40" },
      },
    ],
  });

  assert.ok(result);
  assert.equal(result.product.id, 99);
  assert.equal(result.product.coreProductId, null);
  assert.equal(result.product.description, "<p>Retailer-owned description</p>");
  assert.equal(result.product.lowestRetailPrice, 55);
  assert.equal(result.product.totalAvailableQty, 3);
  assert.equal(result.product.inStock, true);
  assert.deepEqual(
    result.product.variants.map((variant) => variant.id),
    [501, 502],
  );
});
