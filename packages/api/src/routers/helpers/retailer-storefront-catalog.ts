import { isSellableRetailerInventory } from "./retailer-inventory-sellability";

export const retailerStorefrontSortValues = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
] as const;

export type RetailerStorefrontSort =
  (typeof retailerStorefrontSortValues)[number];

export interface RetailerStorefrontVariant {
  sku?: string | null;
}

export interface RetailerStorefrontProduct {
  id: number;
  name: string;
  createdAt: Date | string;
  lowestRetailPrice: number;
  category?: { name: string; slug: string } | null;
  subCategory?: { name: string; slug: string } | null;
  variants: RetailerStorefrontVariant[];
}

export interface RetailerStorefrontFacet {
  name: string;
  slug: string;
  count: number;
  subcategories: Array<{ name: string; slug: string; count: number }>;
}

export interface RetailerInventoryVariantRow<
  TVariant extends {
    productId: number;
    isActive: boolean | null;
    sortOrder: number | null;
  },
> {
  ownerId: string;
  retailPrice: string | null;
  availableQty: string;
  variant: TVariant;
}

export function selectSellableRetailerVariants<
  TRow extends RetailerInventoryVariantRow<{
    productId: number;
    isActive: boolean | null;
    sortOrder: number | null;
  }>,
>(rows: TRow[], input: { shopId: string; productId: number }): TRow[] {
  return rows
    .filter(
      (row) =>
        isSellableRetailerInventory(
          {
            shopId: row.ownerId,
            productId: row.variant.productId,
            variantIsActive: row.variant.isActive,
            retailPrice: row.retailPrice,
          },
          input,
        ) && Number(row.availableQty) > 0,
    )
    .sort(
      (left, right) =>
        (left.variant.sortOrder ?? 0) - (right.variant.sortOrder ?? 0),
    );
}

export function buildRetailerStorefrontFacets(
  products: RetailerStorefrontProduct[],
): RetailerStorefrontFacet[] {
  const categories = new Map<string, RetailerStorefrontFacet>();

  for (const product of products) {
    if (!product.category) continue;

    const category = categories.get(product.category.slug) ?? {
      ...product.category,
      count: 0,
      subcategories: [],
    };
    category.count += 1;

    if (product.subCategory) {
      const existingSubcategory = category.subcategories.find(
        (subcategory) => subcategory.slug === product.subCategory?.slug,
      );
      if (existingSubcategory) {
        existingSubcategory.count += 1;
      } else {
        category.subcategories.push({ ...product.subCategory, count: 1 });
      }
    }

    categories.set(product.category.slug, category);
  }

  return [...categories.values()]
    .map((category) => ({
      ...category,
      subcategories: category.subcategories.sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSearchScore(product: RetailerStorefrontProduct, query: string) {
  const name = product.name.toLocaleLowerCase();
  const skus = product.variants
    .map((variant) => variant.sku?.toLocaleLowerCase())
    .filter((sku): sku is string => !!sku);

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (skus.some((sku) => sku === query)) return 3;
  if (skus.some((sku) => sku.startsWith(query))) return 4;
  if (skus.some((sku) => sku.includes(query))) return 5;
  return Number.POSITIVE_INFINITY;
}

export function filterAndSortRetailerStorefrontProducts<
  T extends RetailerStorefrontProduct,
>(
  products: T[],
  options: {
    search?: string | null;
    category?: string | null;
    subcategory?: string | null;
    sort: RetailerStorefrontSort;
  },
): T[] {
  const query = options.search?.trim().toLocaleLowerCase() ?? "";
  const filtered = products.filter((product) => {
    if (options.category && product.category?.slug !== options.category) {
      return false;
    }
    if (
      options.subcategory &&
      product.subCategory?.slug !== options.subcategory
    ) {
      return false;
    }
    return !query || Number.isFinite(getSearchScore(product, query));
  });

  return filtered.sort((a, b) => {
    switch (options.sort) {
      case "price_asc":
        return (
          a.lowestRetailPrice - b.lowestRetailPrice ||
          a.name.localeCompare(b.name)
        );
      case "price_desc":
        return (
          b.lowestRetailPrice - a.lowestRetailPrice ||
          a.name.localeCompare(b.name)
        );
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "recommended":
        if (query) {
          return (
            getSearchScore(a, query) - getSearchScore(b, query) ||
            a.name.localeCompare(b.name)
          );
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          a.name.localeCompare(b.name)
        );
      case "newest":
      default:
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          a.name.localeCompare(b.name)
        );
    }
  });
}
