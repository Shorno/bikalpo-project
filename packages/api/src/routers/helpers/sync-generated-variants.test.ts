import assert from "node:assert/strict";
import test from "node:test";
import { attachExchangeSettingsToVariantPrices } from "./sync-generated-variants";

test("attaches per-variant exchange flags onto matching variant prices", () => {
  const product = attachExchangeSettingsToVariantPrices({
    variantPrices: [
      { brandId: 16, variantOptionId: 1 },
      { brandId: 16, variantOptionId: 2 },
    ],
    variants: [
      {
        brandId: 16,
        exchangeCreditAmount: "120.00",
        exchangeEnabled: true,
        sourceVariantOptionId: 1,
      },
      {
        brandId: 16,
        exchangeCreditAmount: "0",
        exchangeEnabled: false,
        sourceVariantOptionId: 2,
      },
    ],
  });

  assert.deepEqual(
    product.variantPrices.map((price) => ({
      exchangeCreditAmount: price.exchangeCreditAmount,
      exchangeEnabled: price.exchangeEnabled,
      variantOptionId: price.variantOptionId,
    })),
    [
      {
        exchangeCreditAmount: "120.00",
        exchangeEnabled: true,
        variantOptionId: 1,
      },
      {
        exchangeCreditAmount: "0",
        exchangeEnabled: false,
        variantOptionId: 2,
      },
    ],
  );
});
