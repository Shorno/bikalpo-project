import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProductCode,
  resolveProductActionsPurchase,
  resolveStorefrontProductSelection,
  supportsEmptyPackReturn,
} from "./storefront-product-details";

const variants = [
  {
    id: 12,
    price: "1940",
    sortOrder: 2,
    isActive: true,
    cylinderSale: {
      exchangeEnabled: true,
      exchangeCreditAmount: 1000,
      defaultMode: "exchange" as const,
      newUnitPrice: 1940,
      effectiveExchangeUnitPrice: 940,
    },
  },
  {
    id: 8,
    price: "1480",
    sortOrder: 1,
    isActive: true,
    cylinderSale: {
      exchangeEnabled: false,
      exchangeCreditAmount: 0,
      defaultMode: "new" as const,
    },
  },
  {
    id: 4,
    price: "500",
    sortOrder: 0,
    isActive: false,
    cylinderSale: null,
  },
];

test("storefront details use one stable PRD code format", () => {
  assert.equal(formatProductCode(405218), "PRD-405218");
  assert.equal(formatProductCode(27), "PRD-000027");
});

test("storefront details resolve the exact active variant and exchange price", () => {
  const selection = resolveStorefrontProductSelection({
    variants,
    selectedVariantId: 12,
    requestedSaleMode: "exchange",
    exchangeAllowed: true,
  });

  assert.equal(
    selection.sortedVariants.map((variant) => variant.id).join(","),
    "8,12",
  );
  assert.equal(selection.selectedVariant?.id, 12);
  assert.equal(selection.effectiveSaleMode, "exchange");
  assert.equal(selection.selectedPrice, 940);
});

test("storefront policy can force New without changing the selected variant", () => {
  const selection = resolveStorefrontProductSelection({
    variants,
    selectedVariantId: 12,
    requestedSaleMode: "exchange",
    exchangeAllowed: false,
  });

  assert.equal(selection.selectedVariant?.id, 12);
  assert.equal(selection.exchangeAvailable, false);
  assert.equal(selection.effectiveSaleMode, "new");
  assert.equal(selection.selectedPrice, 1940);
});

test("returnable variants expose New and Exchange independently of category", () => {
  assert.equal(supportsEmptyPackReturn(variants), true);
  assert.equal(supportsEmptyPackReturn([variants[2]!]), false);
});

test("public and shop storefront actions preserve their order boundaries", () => {
  assert.deepEqual(resolveProductActionsPurchase({ kind: "open_order" }, 0), {
    purchaseMode: "open_order",
    shopId: undefined,
    inStock: true,
    stockQuantity: 999,
  });
  assert.deepEqual(
    resolveProductActionsPurchase({ kind: "direct", shopId: "shop-1" }, 4),
    {
      purchaseMode: "direct",
      shopId: "shop-1",
      inStock: true,
      stockQuantity: 4,
    },
  );
  assert.equal(resolveProductActionsPurchase({ kind: "warehouse" }, 10), null);
});
