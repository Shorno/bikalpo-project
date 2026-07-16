import assert from "node:assert/strict";
import test from "node:test";
import {
  getReferenceProductEffectivePrice,
  getReferenceSellerKey,
  sortReferenceProducts,
} from "./reference-product-catalog";

test("uses the lowest active linked consumer reference price", () => {
  const price = getReferenceProductEffectivePrice({
    price: "1900.00",
    variantPrices: [
      { id: 1, consumerPrice: "1500.00", isActive: true },
      { id: 2, consumerPrice: "1400.00", isActive: true },
      { id: 3, consumerPrice: "1000.00", isActive: false },
    ],
    variants: [
      {
        isActive: true,
        price: "1450.00",
        sourceVariantPriceId: 1,
        variantType: "retail",
        visibilityRole: "consumer",
      },
      {
        isActive: true,
        price: "1350.00",
        sourceVariantPriceId: 2,
        variantType: "retail",
        visibilityRole: "all",
      },
    ],
  });

  assert.equal(price, 1400);
});

test("falls back to a retail variant, then the product base price", () => {
  assert.equal(
    getReferenceProductEffectivePrice({
      price: "1900.00",
      variants: [
        {
          isActive: true,
          price: "1700.00",
          variantType: "retail",
          visibilityRole: "consumer",
        },
        {
          isActive: true,
          price: "1200.00",
          variantType: "trade",
          visibilityRole: "shop_owner",
        },
      ],
    }),
    1700,
  );
  assert.equal(getReferenceProductEffectivePrice({ price: "1900.00" }), 1900);
});

test("builds brand-specific seller keys", () => {
  assert.equal(getReferenceSellerKey(1, 20), "1:20");
  assert.equal(getReferenceSellerKey(1, null), "1:unbranded");
});

test("sorts reference products by configured price, name, and recency", () => {
  const products = [
    { createdAt: "2026-07-14", name: "Omera", price: 1528 },
    { createdAt: "2026-07-16", name: "Bashundhara", price: 1400 },
    { createdAt: "2026-07-15", name: "Fresh", price: 1940 },
  ];

  assert.deepEqual(
    sortReferenceProducts(products, "price-asc").map((product) => product.name),
    ["Bashundhara", "Omera", "Fresh"],
  );
  assert.deepEqual(
    sortReferenceProducts(products, "name-desc").map((product) => product.name),
    ["Omera", "Fresh", "Bashundhara"],
  );
  assert.deepEqual(
    sortReferenceProducts(products, "newest").map((product) => product.name),
    ["Bashundhara", "Fresh", "Omera"],
  );
});
