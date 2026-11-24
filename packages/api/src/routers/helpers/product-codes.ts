import {
  type ProductCode,
  type ProductCodeVariant,
  productCodesFor,
} from "@bikalpo-project/db/product-code";

/**
 * Adds `productCodes` (the 13-digit code of every active size and Type) to a
 * product loaded with its core product and variant prices. Variant prices
 * need `exchangeEnabled` (see attachExchangeSettingsToVariantPrices) for
 * cylinders saved before the Variant Table.
 */
export function withProductCodes<
  T extends {
    status?: string | null;
    coreProduct?: { catalogCode?: string | null } | null;
    variantPrices?: ProductCodeVariant[] | null;
  },
>(product: T): T & { productCodes: ProductCode[] } {
  const inactiveProduct = product.status === "inactive";
  return {
    ...product,
    productCodes: productCodesFor(
      product.coreProduct?.catalogCode,
      (product.variantPrices ?? []).map((price) =>
        // An inactive product keeps showing the sizes it was saved with.
        inactiveProduct ? { ...price, isActive: true } : price,
      ),
    ),
  };
}
