export function asNumber(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isConsumerVisibleVariant(variant: any): boolean {
  const isRetailType =
    variant.variantType === "retail" || variant.variantType == null;
  const isConsumerRole =
    variant.visibilityRole === "consumer" ||
    variant.visibilityRole === "all" ||
    variant.visibilityRole == null;

  return variant.isActive !== false && isRetailType && isConsumerRole;
}

export function getVariantOptionLabel(option: any): string {
  if (!option) return "Variant";
  return (
    option.name ||
    [option.size, option.unit].filter(Boolean).join(" ") ||
    "Variant"
  );
}

export function getVariantUnitLabel(option: any): string {
  if (!option) return "";
  if (option.size && option.unit) return `${option.size}${option.unit}`;
  return option.unit || option.name || "";
}

export type ReferencePriceEntry = {
  productRow: any;
  row: any;
  price: number;
};

function getActiveReferencePrices(productRow: any) {
  const activeConsumerVariants = (productRow.variants ?? []).filter(
    isConsumerVisibleVariant,
  );
  const variantPriceIds = new Set(
    activeConsumerVariants
      .map((variant: any) => variant.sourceVariantPriceId)
      .filter((id: number | null | undefined): id is number => id != null),
  );

  return (productRow.variantPrices ?? []).filter((priceRow: any) => {
    if (priceRow.isActive === false) return false;
    if (variantPriceIds.size === 0) return true;
    return variantPriceIds.has(priceRow.id);
  });
}

function getProductReferencePriceEntries(productRows: any[]): ReferencePriceEntry[] {
  return productRows.flatMap((productRow) =>
    getActiveReferencePrices(productRow).map((row: any) => ({
      productRow,
      row,
      price: asNumber(row.consumerPrice),
    })),
  );
}

function getLowestReferencePriceFromRows(productRows: any[]) {
  const priced = getProductReferencePriceEntries(productRows)
    .filter((entry) => entry.price > 0)
    .sort((a, b) => a.price - b.price);

  if (priced[0]) return priced[0];

  return (
    productRows
      .map((productRow) => ({
        productRow,
        row: null,
        price: asNumber(productRow.price),
      }))
      .filter((entry) => entry.price > 0)
      .sort((a, b) => a.price - b.price)[0] ?? null
  );
}

export function getPrimaryWebViewProduct(productRows: any[]) {
  return (
    productRows.find((productRow) => productRow.createdByWarehouseId == null) ??
    productRows[0] ??
    null
  );
}

export function getScopedWebViewProductRows(productRows: any[]) {
  const adminRows = productRows.filter(
    (productRow) => productRow.createdByWarehouseId == null,
  );

  return adminRows.length > 0 ? adminRows : productRows;
}

export function serializeWebViewCoreProduct(
  coreProduct: any,
  productRows: any[],
  reviewStatsMap: Record<
    number,
    { averageRating: number; totalReviews: number }
  >,
  sellerCountMap: Record<number, number>,
) {
  const primaryProduct = getPrimaryWebViewProduct(productRows);
  const lowest = getLowestReferencePriceFromRows(productRows);
  const fallbackPrice = asNumber(primaryProduct?.price);
  const displayPrice = lowest?.price ?? fallbackPrice;
  const referenceRow = lowest?.row;
  const identityDescription =
    coreProduct.description ||
    primaryProduct?.shortDescription ||
    primaryProduct?.description ||
    "";

  return {
    id: coreProduct.id,
    name: coreProduct.name,
    slug: coreProduct.slug,
    shortDescription:
      primaryProduct?.shortDescription ?? coreProduct.description ?? null,
    coreIdentity: {
      id: coreProduct.id,
      name: coreProduct.name,
      sku: coreProduct.sku ?? primaryProduct?.sku ?? null,
      description: identityDescription,
    },
    image: coreProduct.image || primaryProduct?.image || null,
    price: displayPrice,
    unitLabel: referenceRow
      ? getVariantUnitLabel(referenceRow.variantOption)
      : primaryProduct?.size,
    variantLabel: referenceRow
      ? getVariantOptionLabel(referenceRow.variantOption)
      : primaryProduct?.size,
    inStock: productRows.some((productRow) => productRow.inStock),
    category: coreProduct.category,
    subCategory: coreProduct.subCategory,
    reviewStats: reviewStatsMap[coreProduct.id] ?? {
      averageRating: 0,
      totalReviews: 0,
    },
    sellerCount: sellerCountMap[coreProduct.id] ?? 0,
  };
}

function isBetterReferencePriceEntry(
  next: ReferencePriceEntry,
  current: ReferencePriceEntry,
) {
  const nextPrice = asNumber(next.row.consumerPrice);
  const currentPrice = asNumber(current.row.consumerPrice);

  if (nextPrice > 0 && currentPrice <= 0) return true;
  if (nextPrice <= 0 && currentPrice > 0) return false;
  if (nextPrice !== currentPrice) return nextPrice < currentPrice;
  return (next.row.sortOrder ?? 0) < (current.row.sortOrder ?? 0);
}

export function getUniqueReferencePriceEntries(productRows: any[]) {
  const selected = new Map<string, ReferencePriceEntry>();

  for (const entry of getProductReferencePriceEntries(productRows)) {
    const key = `${entry.row.brandId ?? "default"}:${entry.row.variantOptionId}`;
    const current = selected.get(key);
    if (!current || isBetterReferencePriceEntry(entry, current)) {
      selected.set(key, entry);
    }
  }

  return Array.from(selected.values()).sort((a, b) => {
    if (a.price > 0 && b.price <= 0) return -1;
    if (a.price <= 0 && b.price > 0) return 1;
    const priceDiff = a.price - b.price;
    if (priceDiff !== 0) return priceDiff;
    return getVariantOptionLabel(a.row.variantOption).localeCompare(
      getVariantOptionLabel(b.row.variantOption),
    );
  });
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => !!value?.trim())),
  );
}
