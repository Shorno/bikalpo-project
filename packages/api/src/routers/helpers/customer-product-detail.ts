import {
  FULFILLMENT_MODE_LABELS,
  FULFILLMENT_UNITS,
  PRODUCT_TYPE_FAMILY_LABELS,
  VARIANT_DIMENSION_LABELS,
  buildProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";

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
    ({ productRow, row: priceRow }) => {
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
        productId: productRow.id,
        productName: productRow.name ?? null,
        productSlug: productRow.slug ?? null,
        sku: productRow.sku ?? null,
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
        orderMin:
          generatedVariant?.orderMin != null
            ? asNumber(generatedVariant.orderMin)
            : 1,
        orderMax:
          generatedVariant?.orderMax != null
            ? asNumber(generatedVariant.orderMax)
            : null,
        orderIncrement:
          generatedVariant?.orderIncrement != null
            ? asNumber(generatedVariant.orderIncrement)
            : 1,
        orderUnit:
          generatedVariant?.orderUnit ??
          generatedVariant?.unitLabel ??
          getVariantUnitLabel(variantOption) ??
          null,
        sortOrder:
          generatedVariant?.sortOrder ?? priceRow.sortOrder ?? 0,
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

function getReferenceSku(
  primaryProduct: any,
  summary: ReturnType<typeof serializeWebViewCoreProduct>,
) {
  return primaryProduct?.sku ?? summary.coreIdentity.sku ?? null;
}

function getMinimumOrder(activeConsumerVariants: any[], fallbackUnitLabel: string) {
  const ordered = [...activeConsumerVariants].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const first = ordered[0] ?? null;

  return {
    quantity: first?.orderMin != null ? asNumber(first.orderMin) : 1,
    unit: first?.orderUnit || fallbackUnitLabel || "unit",
    increment: first?.orderIncrement != null ? asNumber(first.orderIncrement) : 1,
    max: first?.orderMax != null ? asNumber(first.orderMax) : null,
  };
}

export function buildPublicProductDetailPayload(args: {
  coreProduct: any;
  productRows: any[];
  primaryProduct: any;
  summary: ReturnType<typeof serializeWebViewCoreProduct>;
  referenceCatalog: ReturnType<typeof buildReferenceCatalogData>;
  stockRows?: Array<{
    productId: number;
    variantId: number;
    variantOptionId: number | null;
    brandId: number | null;
    brandName: string | null;
    color: string | null;
    size: string | null;
    unitLabel: string | null;
    orderUnit: string | null;
    packType: string | null;
    availableQty: number;
    inCartonQty: number;
    activeCartonCount: number;
    sellerCount: number;
  }>;
  cartCount?: number;
  orderMetrics?: {
    totalOrders?: number;
    totalUnitsSold?: number;
    totalSalesValue?: number;
    lastOrderedAt?: Date | string | null;
  };
}) {
  const {
    coreProduct,
    productRows,
    primaryProduct,
    summary,
    referenceCatalog,
    stockRows = [],
    cartCount = 0,
    orderMetrics,
  } = args;
  const activeConsumerVariants = productRows.flatMap((productRow) =>
    (productRow.variants ?? []).filter(isConsumerVisibleVariant),
  );
  const typeInput = coreProduct.category?.type ?? null;
  const profile = buildProductTypeFulfillmentProfile({
    slug: typeInput?.slug ?? coreProduct.category?.slug ?? coreProduct.slug,
    name: typeInput?.name ?? coreProduct.category?.name ?? coreProduct.name,
    inventoryBehaviour: typeInput?.inventoryBehaviour ?? null,
    trackingType: primaryProduct?.trackingType ?? null,
    isReturnablePack: productRows.some((productRow) => productRow.isReturnablePack),
  });
  const displayUnit = FULFILLMENT_UNITS[profile.displayUnit];
  const orderUnit = FULFILLMENT_UNITS[profile.orderUnit];
  const stockUnit = FULFILLMENT_UNITS[profile.stockUnit];
  const conversionUnit = FULFILLMENT_UNITS[profile.conversionUnit];
  const minimumOrder = getMinimumOrder(activeConsumerVariants, orderUnit.shortLabel);
  const returnableProducts = productRows.filter(
    (productRow) => productRow.isReturnablePack,
  );
  const packDepositAmount =
    returnableProducts
      .map((productRow) => asNumber(productRow.defaultPackDepositAmount))
      .find((value) => value > 0) ?? 0;
  const variantDescriptor = profile.variantDimensions
    .map((dimension) => VARIANT_DIMENSION_LABELS[dimension])
    .join(" / ");
  const pricingRows = referenceCatalog.referencePrices.map((row) => ({
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productSlug: row.productSlug,
    sku: row.sku,
    brandId: row.brandId ?? null,
    brandName: row.brandName ?? null,
    variantOptionId: row.variantOptionId,
    variantId: row.variantId ?? null,
    label: row.variantLabel,
    unitLabel: row.unitLabel,
    color: row.color ?? null,
    size: row.size ?? null,
    packType: row.packType ?? null,
    consumerPrice: row.consumerPrice,
    orderMin: row.orderMin,
    orderMax: row.orderMax,
    orderIncrement: row.orderIncrement,
    orderUnit: row.orderUnit,
    sortOrder: row.sortOrder,
  }));
  const stockTableRows = stockRows.map((row) => ({
    ...row,
    openQty: Math.max(row.availableQty - row.inCartonQty, 0),
  }));
  const selectableBrands = referenceCatalog.brands.filter((brand) => brand.id != null);
  const defaultPriceRow = pricingRows[0] ?? null;

  return {
    summary,
    family: {
      code: profile.family,
      label: PRODUCT_TYPE_FAMILY_LABELS[profile.family],
    },
    fulfillment: {
      family: profile.family,
      familyLabel: PRODUCT_TYPE_FAMILY_LABELS[profile.family],
      inventoryBehaviour: profile.inventoryBehaviour,
      defaultMode: profile.defaultMode,
      defaultModeLabel: FULFILLMENT_MODE_LABELS[profile.defaultMode],
      supportedModes: profile.supportedModes.map((mode) => ({
        code: mode,
        label: FULFILLMENT_MODE_LABELS[mode],
      })),
      supportsModeSwitching: profile.supportsModeSwitching,
      supportsTrackedAssets: profile.supportsTrackedAssets,
      supportsEmptyReturn: profile.supportsEmptyReturn,
      units: {
        order: orderUnit,
        stock: stockUnit,
        conversion: conversionUnit,
        display: displayUnit,
      },
      variantDimensions: profile.variantDimensions.map((dimension) => ({
        key: dimension,
        label: VARIANT_DIMENSION_LABELS[dimension],
      })),
      notes: profile.notes,
    },
    productInformation: {
      productId: primaryProduct?.id ?? null,
      sku: getReferenceSku(primaryProduct, summary),
      status: primaryProduct?.status ?? null,
      category: coreProduct.category?.name ?? null,
      subCategory: coreProduct.subCategory?.name ?? null,
      productName: coreProduct.name,
      brand:
        referenceCatalog.brands.length === 1
          ? referenceCatalog.brands[0]?.name ?? null
          : null,
      variantDescriptor,
      inventoryUnit: displayUnit.shortLabel,
      minimumOrder,
    },
    gallery: {
      coverImage: summary.image,
      videoUrl: primaryProduct?.videoUrl ?? null,
      images: uniqueStrings([
        coreProduct.image,
        ...productRows.flatMap((productRow) => [
          productRow.image,
          ...((productRow.images ?? []).map((image: any) => image.imageUrl) ?? []),
        ]),
      ]),
    },
    content: {
      shortDescription:
        primaryProduct?.shortDescription ?? coreProduct.description ?? null,
      description: primaryProduct?.description ?? coreProduct.description ?? null,
      featureGroups: primaryProduct?.features ?? [],
    },
    rules: {
      trackingType: primaryProduct?.trackingType ?? "none",
      expiryEnabled: Boolean(primaryProduct?.expiryEnabled),
      damageControlEnabled: Boolean(primaryProduct?.damageControlEnabled),
      availableForSale: Boolean(primaryProduct?.availableForSale),
      visibility: primaryProduct?.visibility ?? "public",
      supportsPack: Boolean(coreProduct.supportsPack),
      supportsLoose: Boolean(coreProduct.supportsLoose),
      minimumOrder,
      inventoryUnit: displayUnit.shortLabel,
      stockUnit: stockUnit.shortLabel,
      conversionUnit: conversionUnit.shortLabel,
      conversionEnabled: profile.supportsModeSwitching,
      emptyPackReturn: {
        enabled: returnableProducts.length > 0,
        depositAmount: packDepositAmount,
        companies: uniqueStrings(
          returnableProducts.flatMap(
            (productRow) => productRow.allowedPackBrands ?? [],
          ),
        ),
        packSizes: uniqueStrings(
          returnableProducts.flatMap(
            (productRow) => productRow.allowedPackSizes ?? [],
          ),
        ),
      },
    },
    referenceCatalog,
    selection: {
      defaultPriceRowId: defaultPriceRow?.id ?? null,
      defaultProductId: defaultPriceRow?.productId ?? primaryProduct?.id ?? null,
      defaultVariantId: defaultPriceRow?.variantId ?? null,
      defaultBrandId:
        defaultPriceRow?.brandId ?? selectableBrands[0]?.id ?? null,
      defaultVariantOptionId:
        defaultPriceRow?.variantOptionId ?? referenceCatalog.variants[0]?.id ?? null,
      hasMultipleBrands: selectableBrands.length > 1,
      hasMultipleVariants: referenceCatalog.variants.length > 1,
    },
    pricing: {
      currency: "BDT",
      rows: pricingRows,
    },
    stock: {
      displayUnit: displayUnit.shortLabel,
      quantityKind: displayUnit.quantityKind,
      totalAvailableQty: stockTableRows.reduce(
        (sum, row) => sum + row.availableQty,
        0,
      ),
      totalInsideContainerQty: stockTableRows.reduce(
        (sum, row) => sum + row.inCartonQty,
        0,
      ),
      rows: stockTableRows,
    },
    history: {
      createdAt: coreProduct.createdAt ?? primaryProduct?.createdAt ?? null,
      updatedAt: primaryProduct?.updatedAt ?? null,
      lastOrderedAt: orderMetrics?.lastOrderedAt ?? null,
    },
    performance: {
      averageRating: summary.reviewStats.averageRating,
      totalReviews: summary.reviewStats.totalReviews,
      sellerCount: summary.sellerCount,
      cartCount,
      totalOrders: orderMetrics?.totalOrders ?? 0,
      totalUnitsSold: orderMetrics?.totalUnitsSold ?? 0,
      totalSalesValue: orderMetrics?.totalSalesValue ?? 0,
    },
  };
}
