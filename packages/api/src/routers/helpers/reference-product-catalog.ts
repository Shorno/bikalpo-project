export type ReferenceCatalogVariant = {
  catalogVariant?: {
    brandId?: number | null;
    configurationState?: string | null;
    coreProductId?: number | null;
    isActive?: boolean | null;
  } | null;
  catalogVariantId?: number | null;
  exchangeEnabled?: boolean | null;
  exchangeCreditAmount?: string | number | null;
  isActive?: boolean | null;
  price: string | number;
  productId?: number | null;
  sourceVariantPriceId?: number | null;
  variantType?: string | null;
  visibilityRole?: string | null;
};

export type ReferenceCatalogVariantPrice = {
  consumerPrice: string | number;
  id: number;
  isActive?: boolean | null;
};

export type ReferenceCatalogPriceSource = OpenOrderReferenceProduct & {
  price: string | number;
  variantPrices?: ReferenceCatalogVariantPrice[] | null;
  variants?: ReferenceCatalogVariant[] | null;
};

export type OpenOrderReferenceProduct = {
  brandId?: number | null;
  coreProductId?: number | null;
  creatorSource?: string | null;
  id?: number | null;
  scheduledAt?: Date | string | null;
  status?: string | null;
  visibility?: string | null;
};

export type OpenOrderReferenceVariant = {
  catalogVariant?: {
    brandId?: number | null;
    configurationState?: string | null;
    coreProductId?: number | null;
    isActive?: boolean | null;
  } | null;
  catalogVariantId?: number | null;
  exchangeEnabled?: boolean | null;
  isActive?: boolean | null;
  productId?: number | null;
  variantType?: string | null;
  visibilityRole?: string | null;
};

export function isOpenOrderReferenceSelectionEligible(input: {
  product: OpenOrderReferenceProduct;
  variant: OpenOrderReferenceVariant;
  now?: Date;
}): boolean {
  const { product, variant } = input;
  const now = input.now ?? new Date();
  const scheduledAt = product.scheduledAt
    ? new Date(product.scheduledAt)
    : null;
  const isPublished =
    scheduledAt === null ||
    (Number.isFinite(scheduledAt.getTime()) && scheduledAt <= now);
  return (
    product.creatorSource === "admin" &&
    product.status === "active" &&
    product.visibility === "public" &&
    product.coreProductId != null &&
    product.brandId != null &&
    isPublished &&
    variant.isActive === true &&
    variant.productId === product.id &&
    variant.catalogVariantId != null &&
    variant.catalogVariant?.isActive === true &&
    variant.catalogVariant.configurationState === "configured" &&
    variant.catalogVariant.coreProductId === product.coreProductId &&
    variant.catalogVariant.brandId === product.brandId
  );
}

type SortableReferenceProduct = {
  createdAt: Date | string;
  name: string;
  price: string | number;
};

function asNumber(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCanonicalReferenceVariant(
  variant: ReferenceCatalogVariant,
): boolean {
  return (
    variant.isActive === true &&
    variant.catalogVariantId != null &&
    variant.catalogVariant?.isActive === true &&
    variant.catalogVariant.configurationState === "configured"
  );
}

export function anyListedVariantAllowsExchange(
  variants:
    | Array<{ exchangeEnabled?: boolean | null; isActive?: boolean | null }>
    | null
    | undefined,
): boolean {
  return (variants ?? []).some(
    (variant) => variant.isActive !== false && Boolean(variant.exchangeEnabled),
  );
}

export function referenceProductCanExchange(
  product: ReferenceCatalogPriceSource,
): boolean {
  return (product.variants ?? []).some((variant) => {
    const listed =
      product.creatorSource === "admin"
        ? isOpenOrderReferenceSelectionEligible({ product, variant })
        : isCanonicalReferenceVariant(variant);
    return listed && Boolean(variant.exchangeEnabled);
  });
}

export function getReferenceCylinderPricing(
  product: ReferenceCatalogPriceSource,
) {
  const listedVariants = (product.variants ?? []).filter((variant) =>
    product.creatorSource === "admin"
      ? isOpenOrderReferenceSelectionEligible({ product, variant })
      : isCanonicalReferenceVariant(variant),
  );
  const newPrices = listedVariants
    .map((variant) => asNumber(variant.price))
    .filter((price) => price > 0);
  const exchangePrices = listedVariants
    .filter((variant) => Boolean(variant.exchangeEnabled))
    .map((variant) =>
      Math.max(
        0,
        asNumber(variant.price) - asNumber(variant.exchangeCreditAmount),
      ),
    );

  return {
    supportsNew: listedVariants.length > 0,
    exchangeAvailable: exchangePrices.length > 0,
    newFrom:
      newPrices.length > 0
        ? Math.min(...newPrices)
        : getReferenceProductEffectivePrice(product),
    exchangeFrom:
      exchangePrices.length > 0 ? Math.min(...exchangePrices) : null,
  };
}

export function getReferenceProductEffectivePrice(
  product: ReferenceCatalogPriceSource,
): number {
  const consumerVariants = (product.variants ?? []).filter((variant) =>
    product.creatorSource === "admin"
      ? isOpenOrderReferenceSelectionEligible({ product, variant })
      : isCanonicalReferenceVariant(variant),
  );
  const linkedPriceIds = new Set(
    consumerVariants
      .map((variant) => variant.sourceVariantPriceId)
      .filter((id): id is number => id != null),
  );
  const referencePrices = (product.variantPrices ?? [])
    .filter((price) => price.isActive !== false)
    .filter(
      (price) => linkedPriceIds.size === 0 || linkedPriceIds.has(price.id),
    )
    .map((price) => asNumber(price.consumerPrice))
    .filter((price) => price > 0);

  if (referencePrices.length > 0) return Math.min(...referencePrices);

  const retailVariantPrices = consumerVariants
    .map((variant) => asNumber(variant.price))
    .filter((price) => price > 0);

  if (retailVariantPrices.length > 0) return Math.min(...retailVariantPrices);

  return asNumber(product.price);
}

export function getReferenceSellerKey(
  coreProductId: number,
  brandId: number | null,
): string {
  return `${coreProductId}:${brandId ?? "unbranded"}`;
}

export function sortReferenceProducts<T extends SortableReferenceProduct>(
  products: T[],
  sort: string | null | undefined,
): T[] {
  return [...products].sort((a, b) => {
    switch (sort) {
      case "price-asc":
      case "price_asc":
        return asNumber(a.price) - asNumber(b.price);
      case "price-desc":
      case "price_desc":
        return asNumber(b.price) - asNumber(a.price);
      case "name-asc":
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "newest":
      default:
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  });
}
