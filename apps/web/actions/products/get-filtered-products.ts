import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db/config";
import { category as categoryTable } from "@/db/schema/category";
import { product } from "@/db/schema/product";

// ─────────────────────────────────────────────────────────────────
// Feature Flag: Brand Filtering
// ─────────────────────────────────────────────────────────────────
// Set to `true` when brands table and product.brandId column are added.
// UI already supports brand selection; this enables server-side filtering.
//
// To activate:
// 1. Add brands table with id, name, slug columns
// 2. Add brandId column to products table
// 3. Set BRAND_FILTER_ENABLED = true
// ─────────────────────────────────────────────────────────────────
const BRAND_FILTER_ENABLED = false;

export interface ProductFilters {
  category?: string | null;
  brand?: string | null; // Forward-compatible: parsed from URL, filtered only when flag is true
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: string | null; // Sort option: newest, price_asc, price_desc, name_asc, name_desc
}

export type FilteredProduct = {
  id: number;
  name: string;
  slug: string;
  price: string;
  size: string;
  image: string;
  categoryId: number;
  inStock: boolean;
  isFeatured: boolean;
  category: {
    name: string;
    slug: string;
  };
};

// ─────────────────────────────────────────────────────────────────
// Helper: Get Order By clause based on sort parameter
// ─────────────────────────────────────────────────────────────────
function getOrderBy(sort: string | null | undefined): SQL {
  switch (sort) {
    case "price_asc":
      return asc(product.price);
    case "price_desc":
      return desc(product.price);
    case "name_asc":
      return asc(product.name);
    case "name_desc":
      return desc(product.name);
    case "newest":
    default:
      return desc(product.createdAt);
  }
}

export async function getProducts(
  filters: ProductFilters,
): Promise<FilteredProduct[]> {
  const { category, brand, minPrice, maxPrice, sort } = filters;

  const conditions: any[] = [];

  // Category filter: resolve slug to ID
  if (category) {
    const matchedCategory = await db.query.category.findFirst({
      where: eq(categoryTable.slug as any, category),
      columns: { id: true },
    });

    if (matchedCategory) {
      conditions.push(eq(product.categoryId as any, matchedCategory.id));
    } else {
      // Category not found - return empty results
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Brand filter: Forward-compatible, currently disabled
  // ─────────────────────────────────────────────────────────────────
  // When BRAND_FILTER_ENABLED is true:
  // 1. Look up brand by slug to get brandId
  // 2. Add eq(product.brandId, brandId) to conditions
  // ─────────────────────────────────────────────────────────────────
  if (BRAND_FILTER_ENABLED && brand) {
    // TODO: Uncomment when brands table exists
    // const matchedBrand = await db.query.brand.findFirst({
    //   where: eq(brandTable.slug, brand),
    //   columns: { id: true },
    // });
    // if (matchedBrand) {
    //   conditions.push(eq(product.brandId, matchedBrand.id));
    // } else {
    //   return [];
    // }
  }

  // Price filters
  if (minPrice != null) {
    conditions.push(gte(product.price as any, minPrice.toString()));
  }

  if (maxPrice != null) {
    conditions.push(lte(product.price as any, maxPrice.toString()));
  }

  // Execute query with dynamic sorting
  const data = await db.query.product.findMany({
    where: conditions.length > 0 ? (and(...conditions) as any) : undefined,
    with: {
      category: {
        columns: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: getOrderBy(sort) as any,
  });

  return data as unknown as FilteredProduct[];
}
