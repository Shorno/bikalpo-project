import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProductCode,
  resolveSellerProductSelection,
} from "./seller-product-details";

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

test("seller details use one stable PRD code format", () => {
  assert.equal(formatProductCode(405218), "PRD-405218");
  assert.equal(formatProductCode(27), "PRD-000027");
});

test("seller details resolve the exact active variant and exchange price", () => {
  const selection = resolveSellerProductSelection({
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

test("seller policy can force New without changing the selected variant", () => {
  const selection = resolveSellerProductSelection({
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
