"use server";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
} from "drizzle-orm";
import { db } from "@/db/config";
import { product } from "@/db/schema";

interface GetProductsParams {
  category?: string;
  subcategory?: string;
  brand?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export interface PaginationData {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface ProductsWithPagination {
  products: Awaited<ReturnType<typeof db.query.product.findMany>>;
  pagination: PaginationData;
}

export async function getProductsWithQuery(
  params: GetProductsParams,
): Promise<ProductsWithPagination> {
  const {
    category,
    subcategory,
    brand: brandSlug,
    sort = "newest",
    minPrice,
    maxPrice,
    inStock,
    search,
    page: pageStr = "1",
    limit: limitStr = "12",
  } = params;

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(limitStr, 10) || 12));
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];

  if (category) {
    const categorySlugs = category.split(",").filter(Boolean);
    const categoryData = await db.query.category.findMany({
      where: (cat, { inArray }) => inArray(cat.slug, categorySlugs),
    });
    if (categoryData.length > 0) {
      conditions.push(
        inArray(
          product.categoryId,
          categoryData.map((c) => c.id),
        ),
      );
    }
  }

  if (subcategory) {
    const subCategorySlugs = subcategory.split(",").filter(Boolean);
    const subCategoryData = await db.query.subCategory.findMany({
      where: (subCat, { inArray }) => inArray(subCat.slug, subCategorySlugs),
    });
    if (subCategoryData.length > 0) {
      conditions.push(
        inArray(
          product.subCategoryId,
          subCategoryData.map((s) => s.id),
        ),
      );
    }
  }

  if (brandSlug) {
    const brandSlugs = brandSlug.split(",").filter(Boolean);
    const brandData = await db.query.brand.findMany({
      where: (b, { inArray }) => inArray(b.slug, brandSlugs),
    });
    if (brandData.length > 0) {
      conditions.push(
        inArray(
          product.brandId,
          brandData.map((b) => b.id),
        ),
      );
    }
  }

  if (minPrice) {
    conditions.push(gte(product.price, minPrice));
  }

  if (maxPrice) {
    conditions.push(lte(product.price, maxPrice));
  }

  if (inStock === "true") {
    conditions.push(eq(product.inStock, true));
  }

  if (search) {
    conditions.push(ilike(product.name, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build order by
  let orderBy;
  switch (sort) {
    case "price-asc":
      orderBy = [asc(product.price)];
      break;
    case "price-desc":
      orderBy = [desc(product.price)];
      break;
    case "name-asc":
      orderBy = [asc(product.name)];
      break;
    case "name-desc":
      orderBy = [desc(product.name)];
      break;
    case "newest":
    default:
      orderBy = [desc(product.createdAt)];
      break;
  }

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(product)
    .where(whereClause);

  const totalCount = countResult?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Get paginated products
  const products = await db.query.product.findMany({
    where: whereClause,
    with: {
      category: {
        columns: {
          slug: true,
          name: true,
        },
      },
      subCategory: {
        columns: {
          name: true,
        },
      },
      brand: true,
    },
    orderBy,
    limit,
    offset,
  });

  return {
    products,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
    },
  };
}
