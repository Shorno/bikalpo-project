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

export function buildReferenceCatalogData(productRows: any[]) {
  const activeConsumerVariants = productRows.flatMap((productRow) =>
    (productRow.variants ?? []).filter(isConsumerVisibleVariant),
  );
  const variantByPriceId = new Map<number, any>();
  for (const variant of activeConsumerVariants) {
    if (variant.sourceVariantPriceId != null) {
      variantByPriceId.set(variant.sourceVariantPriceId, variant);
    }
  }

  const brandMap = new Map<
    number,
    { id: number; name: string; slug: string | null; logo: string | null }
  >();

  for (const productRow of productRows) {
    for (const link of productRow.productBrands ?? []) {
      if (link.brand) {
        brandMap.set(link.brand.id, {
          id: link.brand.id,
          name: link.brand.name,
          slug: link.brand.slug,
          logo: link.brand.logo,
        });
      }
    }
  }

  const variantMap = new Map<
    number,
    {
      id: number;
      label: string;
      unitLabel: string;
      unit: string | null;
      size: string | null;
      variantType: string | null;
    }
  >();

  for (const variant of activeConsumerVariants) {
    if (variant.brand) {
      brandMap.set(variant.brand.id, {
        id: variant.brand.id,
        name: variant.brand.name,
        slug: variant.brand.slug,
        logo: variant.brand.logo,
      });
    }

    const variantOption = variant.sourceVariantOption;
    if (variantOption) {
      variantMap.set(variantOption.id, {
        id: variantOption.id,
        label: variant.unitLabel || getVariantOptionLabel(variantOption),
        unitLabel: getVariantUnitLabel(variantOption),
        unit: variantOption.unit,
        size: variantOption.size,
        variantType: variantOption.variantType,
      });
    }
  }

  const referencePrices = getUniqueReferencePriceEntries(productRows).map(
    ({ row: priceRow }) => {
      if (priceRow.brand) {
        brandMap.set(priceRow.brand.id, {
          id: priceRow.brand.id,
          name: priceRow.brand.name,
          slug: priceRow.brand.slug,
          logo: priceRow.brand.logo,
        });
      }

      const generatedVariant = variantByPriceId.get(priceRow.id);
      const variantOption = priceRow.variantOption;
      if (variantOption) {
        variantMap.set(variantOption.id, {
          id: variantOption.id,
          label:
            generatedVariant?.unitLabel || getVariantOptionLabel(variantOption),
          unitLabel: getVariantUnitLabel(variantOption),
          unit: variantOption.unit,
          size: variantOption.size,
          variantType: variantOption.variantType,
        });
      }

      return {
        id: priceRow.id,
        brandId: priceRow.brandId,
        brandName: priceRow.brand?.name ?? null,
        variantOptionId: priceRow.variantOptionId,
        variantId: generatedVariant?.id ?? null,
        variantLabel:
          generatedVariant?.unitLabel || getVariantOptionLabel(variantOption),
        unitLabel: getVariantUnitLabel(variantOption),
        consumerPrice: asNumber(priceRow.consumerPrice),
        color: generatedVariant?.color ?? null,
        size: generatedVariant?.size ?? variantOption?.size ?? null,
        packType: generatedVariant?.packType ?? null,
      };
    },
  );

  const brands = Array.from(brandMap.values());
  return {
    brands:
      brands.length > 0
        ? brands
        : [{ id: null, name: "Default", slug: null, logo: null }],
    variants: Array.from(variantMap.values()),
    referencePrices,
  };
}
