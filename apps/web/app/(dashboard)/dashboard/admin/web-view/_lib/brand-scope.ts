/**
 * Brand scoping for the admin web-view screens.
 *
 * A single `product` row can hold several brands (`productBrands`) and their
 * per-brand variant prices (`variantPrices[].brandId`). Every web-view screen is
 * per-brand, so it must filter that shared data down to one brand. This module
 * is the single source of truth for that rule — the listing and the detail page
 * both import it so the scoping logic can never drift apart.
 */

export type BrandSummary = {
  id: number;
  name: string;
  slug?: string | null;
};

type BrandLinkLike = {
  brandId?: number | null;
  brand?: { id?: number | null; name?: string | null; slug?: string | null } | null;
};

type BrandOwnerLike = {
  brand?: { id?: number | null; name?: string | null; slug?: string | null } | null;
  productBrands?: BrandLinkLike[] | null;
};

type BrandScopedLike = {
  brandId?: number | null;
};

type ActiveScopedLike = BrandScopedLike & {
  isActive?: boolean | null;
};

/**
 * Distinct brands configured on a product, in configuration order. Falls back to
 * the product's legacy single `brand` relation when no `productBrands` exist.
 */
export function getProductBrands(product: BrandOwnerLike): BrandSummary[] {
  const brands = new Map<number, BrandSummary>();

  for (const link of product.productBrands ?? []) {
    const brandId = link.brand?.id ?? link.brandId;
    if (!brandId) continue;
    brands.set(brandId, {
      id: brandId,
      name: link.brand?.name ?? `Brand #${brandId}`,
      slug: link.brand?.slug,
    });
  }

  if (brands.size === 0 && product.brand?.id) {
    brands.set(product.brand.id, {
      id: product.brand.id,
      name: product.brand.name ?? `Brand #${product.brand.id}`,
      slug: product.brand.slug,
    });
  }

  return Array.from(brands.values());
}

/**
 * Resolve the brand context for a product: its brands, whether it is a
 * single-brand product, and the brand to fall back to when none is specified.
 */
export function resolveBrandScope(product: BrandOwnerLike) {
  const brands = getProductBrands(product);
  return {
    brands,
    hasSingleBrand: brands.length === 1,
    defaultBrandId: brands[0]?.id ?? null,
  };
}

/**
 * Filter brand-tagged rows down to a single brand.
 *
 * - `brandId == null` → no brand context, return everything.
 * - Otherwise return the rows tagged with that brand.
 * - Single-brand products fall back to untagged (legacy) rows when the brand has
 *   no tagged rows of its own.
 */
export function scopeByBrand<T extends BrandScopedLike>(
  items: readonly T[],
  brandId: number | null,
  hasSingleBrand: boolean,
): T[] {
  if (brandId == null) return [...items];

  const exactMatches = items.filter((item) => item.brandId === brandId);
  if (exactMatches.length > 0 || !hasSingleBrand) return exactMatches;

  return items.filter((item) => item.brandId == null);
}

/**
 * Active variant prices scoped to a single brand. Combines the active filter
 * with {@link scopeByBrand} so both callers apply an identical rule.
 */
export function scopeVariantPrices<T extends ActiveScopedLike>(
  variantPrices: readonly T[],
  brandId: number | null,
  hasSingleBrand: boolean,
): T[] {
  const active = variantPrices.filter(
    (variantPrice) => variantPrice.isActive !== false,
  );
  return scopeByBrand(active, brandId, hasSingleBrand);
}
