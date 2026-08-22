import assert from "node:assert/strict";
import test from "node:test";
import {
  anyListedVariantAllowsExchange,
  getReferenceCylinderPricing,
  getReferenceProductEffectivePrice,
  getReferenceSellerKey,
  isOpenOrderReferenceSelectionEligible,
  referenceProductCanExchange,
  sortReferenceProducts,
} from "./reference-product-catalog";

test("canonical Open Order eligibility ignores the legacy channel type", () => {
  const product = {
    brandId: 16,
    coreProductId: 1,
    creatorSource: "admin",
    id: 2,
    scheduledAt: null,
    status: "active",
    visibility: "public",
  } as const;
  const canonicalVariant = {
    catalogVariant: {
      brandId: 16,
      configurationState: "configured",
      coreProductId: 1,
      isActive: true,
    },
    catalogVariantId: 5,
    isActive: true,
    productId: 2,
    visibilityRole: "all",
  } as const;

  assert.equal(
    isOpenOrderReferenceSelectionEligible({
      product,
      variant: { ...canonicalVariant, variantType: null },
    }),
    true,
  );
  assert.equal(
    isOpenOrderReferenceSelectionEligible({
      product,
      variant: { ...canonicalVariant, variantType: "trade" },
    }),
    true,
  );
});

test("canonical Open Order eligibility rejects a mismatched owner variant", () => {
  assert.equal(
    isOpenOrderReferenceSelectionEligible({
      product: {
        brandId: 16,
        coreProductId: 1,
        creatorSource: "admin",
        id: 2,
        scheduledAt: null,
        status: "active",
        visibility: "public",
      },
      variant: {
        catalogVariant: {
          brandId: 16,
          configurationState: "configured",
          coreProductId: 1,
          isActive: true,
        },
        catalogVariantId: 5,
        isActive: true,
        productId: 9,
        visibilityRole: "all",
      },
    }),
    false,
  );
});

test("canonical Open Order eligibility rejects unpublished or broken references", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  const product = {
    brandId: 16,
    coreProductId: 1,
    creatorSource: "admin",
    id: 2,
    scheduledAt: null,
    status: "active",
    visibility: "public",
  } as const;
  const variant = {
    catalogVariant: {
      brandId: 16,
      configurationState: "configured",
      coreProductId: 1,
      isActive: true,
    },
    catalogVariantId: 5,
    isActive: true,
    productId: 2,
    visibilityRole: "consumer",
  } as const;

  const candidates = [
    { product: { ...product, status: "inactive" }, variant },
    { product: { ...product, visibility: "private" }, variant },
    {
      product: { ...product, scheduledAt: "2026-07-23T12:00:00.000Z" },
      variant,
    },
    { product, variant: { ...variant, catalogVariantId: null } },
    { product, variant: { ...variant, isActive: false } },
    {
      product,
      variant: {
        ...variant,
        catalogVariant: { ...variant.catalogVariant, isActive: false },
      },
    },
    {
      product,
      variant: {
        ...variant,
        catalogVariant: {
          ...variant.catalogVariant,
          configurationState: "draft",
        },
      },
    },
    {
      product,
      variant: {
        ...variant,
        catalogVariant: { ...variant.catalogVariant, brandId: 99 },
      },
    },
  ];

  for (const candidate of candidates) {
    assert.equal(
      isOpenOrderReferenceSelectionEligible({ ...candidate, now }),
      false,
    );
  }
});

test("reference pricing follows canonical variants instead of legacy channel type", () => {
  assert.equal(
    getReferenceProductEffectivePrice({
      price: "1900.00",
      variantPrices: [
        { id: 1, consumerPrice: "1500.00", isActive: true },
        { id: 2, consumerPrice: "900.00", isActive: true },
      ],
      variants: [
        {
          catalogVariant: {
            configurationState: "configured",
            isActive: true,
          },
          catalogVariantId: 5,
          isActive: true,
          price: "1450.00",
          sourceVariantPriceId: 1,
          variantType: "trade",
          visibilityRole: "all",
        },
      ],
    }),
    1500,
  );
});

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
        catalogVariant: {
          configurationState: "configured",
          isActive: true,
        },
        catalogVariantId: 1,
        isActive: true,
        price: "1450.00",
        sourceVariantPriceId: 1,
        variantType: "retail",
        visibilityRole: "consumer",
      },
      {
        catalogVariant: {
          configurationState: "configured",
          isActive: true,
        },
        catalogVariantId: 2,
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

test("falls back to a canonical variant, then the product base price", () => {
  assert.equal(
    getReferenceProductEffectivePrice({
      price: "1900.00",
      variants: [
        {
          catalogVariant: {
            configurationState: "configured",
            isActive: true,
          },
          catalogVariantId: 1,
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

test("public cards show Type when any listed variant allows exchange", () => {
  assert.equal(anyListedVariantAllowsExchange([]), false);
  assert.equal(
    anyListedVariantAllowsExchange([
      { isActive: true, exchangeEnabled: false },
      { isActive: false, exchangeEnabled: true },
    ]),
    false,
  );
  assert.equal(
    anyListedVariantAllowsExchange([
      { isActive: true, exchangeEnabled: false },
      { isActive: true, exchangeEnabled: true },
    ]),
    true,
  );
});

test("reference products only count eligible catalog variants for exchange", () => {
  const product = {
    brandId: 16,
    coreProductId: 1,
    creatorSource: "admin",
    id: 2,
    price: "1900.00",
    scheduledAt: null,
    status: "active",
    visibility: "public",
  } as const;
  const eligibleVariant = {
    catalogVariant: {
      brandId: 16,
      configurationState: "configured",
      coreProductId: 1,
      isActive: true,
    },
    catalogVariantId: 5,
    exchangeEnabled: true,
    isActive: true,
    price: "1500.00",
    productId: 2,
    visibilityRole: "all",
  } as const;

  assert.equal(
    referenceProductCanExchange({
      ...product,
      variants: [{ ...eligibleVariant, exchangeEnabled: false }],
    }),
    false,
  );
  assert.equal(
    referenceProductCanExchange({
      ...product,
      variants: [eligibleVariant],
    }),
    true,
  );
  assert.equal(
    referenceProductCanExchange({
      ...product,
      variants: [{ ...eligibleVariant, productId: 9 }],
    }),
    false,
  );
});

test("reference cylinder pricing exposes New and Exchange from prices", () => {
  const product = {
    brandId: 16,
    coreProductId: 1,
    creatorSource: "admin",
    id: 2,
    price: "1900.00",
    scheduledAt: null,
    status: "active",
    visibility: "public",
    variants: [
      {
        catalogVariant: {
          brandId: 16,
          configurationState: "configured",
          coreProductId: 1,
          isActive: true,
        },
        catalogVariantId: 5,
        exchangeEnabled: true,
        exchangeCreditAmount: "300",
        isActive: true,
        price: "1500",
        productId: 2,
      },
      {
        catalogVariant: {
          brandId: 16,
          configurationState: "configured",
          coreProductId: 1,
          isActive: true,
        },
        catalogVariantId: 6,
        exchangeEnabled: false,
        exchangeCreditAmount: "0",
        isActive: true,
        price: "1200",
        productId: 2,
      },
    ],
  } as const;

  assert.deepEqual(getReferenceCylinderPricing(product), {
    supportsNew: true,
    exchangeAvailable: true,
    newFrom: 1200,
    exchangeFrom: 1200,
  });
});
