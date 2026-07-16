export type ReferenceCatalogVariant = {
  isActive?: boolean | null;
  price: string | number;
  sourceVariantPriceId?: number | null;
  variantType?: string | null;
  visibilityRole?: string | null;
};

export type ReferenceCatalogVariantPrice = {
  consumerPrice: string | number;
  id: number;
  isActive?: boolean | null;
};

export type ReferenceCatalogPriceSource = {
  price: string | number;
  variantPrices?: ReferenceCatalogVariantPrice[] | null;
  variants?: ReferenceCatalogVariant[] | null;
};

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

function isConsumerVisibleVariant(variant: ReferenceCatalogVariant): boolean {
  const isRetailType =
    variant.variantType === "retail" || variant.variantType == null;
  const isConsumerRole =
    variant.visibilityRole === "consumer" ||
    variant.visibilityRole === "all" ||
    variant.visibilityRole == null;

  return variant.isActive !== false && isRetailType && isConsumerRole;
}

export function getReferenceProductEffectivePrice(
  product: ReferenceCatalogPriceSource,
): number {
  const consumerVariants = (product.variants ?? []).filter(
    isConsumerVisibleVariant,
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
