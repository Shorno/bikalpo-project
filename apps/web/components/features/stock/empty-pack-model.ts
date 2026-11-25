/**
 * Empty Pack page (client, 2026-11-25): rows as the API sends them and
 * the filters. Shared by the retailer and warehouse pages.
 */

export type InMarketOrder = { orderNumber: string; quantity: number };

export type EmptyPackVariant = {
  variantId: number;
  label: string;
  totalQty: number;
  inMarketQty: number;
  inMarketOrders: InMarketOrder[];
};

export type EmptyPackProduct = {
  productId: number;
  productCode: string | null;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  totalQty: number;
  inMarketQty: number;
  inMarketOrders: InMarketOrder[];
  variants: EmptyPackVariant[];
};

export const ALL = "all";

export type EmptyPackFilters = {
  search: string;
  categoryId: string;
  subCategoryId: string;
  variant: string;
};

export function emptyPackProductId(product: EmptyPackProduct) {
  return product.productCode || `#${product.productId}`;
}

/**
 * The products to list and, for each, the sizes to show. A Variant
 * filter keeps only that size; the product's figures are then that size's.
 */
export function filterEmptyPacks(
  products: EmptyPackProduct[],
  filters: EmptyPackFilters,
): EmptyPackProduct[] {
  const text = filters.search.trim().toLowerCase();
  const rows: EmptyPackProduct[] = [];
  for (const product of products) {
    if (filters.categoryId !== ALL && String(product.categoryId) !== filters.categoryId) {
      continue;
    }
    if (
      filters.subCategoryId !== ALL &&
      String(product.subCategoryId) !== filters.subCategoryId
    ) {
      continue;
    }
    const variants =
      filters.variant === ALL
        ? product.variants
        : product.variants.filter((variant) => variant.label === filters.variant);
    if (variants.length === 0) continue;
    if (
      text &&
      ![
        product.name,
        emptyPackProductId(product),
        product.categoryName,
        product.subCategoryName,
        ...variants.map((variant) => variant.label),
        ...variants.flatMap((variant) =>
          variant.inMarketOrders.map((entry) => entry.orderNumber),
        ),
      ].some((field) => (field ?? "").toLowerCase().includes(text))
    ) {
      continue;
    }
    if (variants === product.variants) {
      rows.push(product);
      continue;
    }
    const orders = new Map<string, number>();
    for (const variant of variants) {
      for (const entry of variant.inMarketOrders) {
        orders.set(entry.orderNumber, (orders.get(entry.orderNumber) ?? 0) + entry.quantity);
      }
    }
    rows.push({
      ...product,
      variants,
      totalQty: variants.reduce((sum, variant) => sum + variant.totalQty, 0),
      inMarketQty: variants.reduce((sum, variant) => sum + variant.inMarketQty, 0),
      inMarketOrders: [...orders].map(([orderNumber, quantity]) => ({
        orderNumber,
        quantity,
      })),
    });
  }
  return rows;
}
