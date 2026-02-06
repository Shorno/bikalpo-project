"use server";

import { and, eq, gt, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/config";
import { product } from "@/db/schema/product";

export type StockStatusFilter = "all" | "in" | "out" | "low";
export type StockSort = "newest" | "oldest" | "popular";

export type GetProductsForStockParams = {
  search?: string;
  categoryId?: string; // optional, from dropdown
  stockStatus?: StockStatusFilter;
  sort?: StockSort;
  page?: number;
  limit?: number;
};

export async function getProductsForStock(
  params: GetProductsForStockParams = {},
) {
  const {
    search = "",
    categoryId,
    stockStatus = "all",
    sort = "newest",
    page = 1,
    limit = 10,
  } = params;

  const conditions: ReturnType<typeof and>[] = [];

  if (search.trim()) {
    const s = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(product.name, s),
        ilike(product.sku, s),
        sql`EXISTS (SELECT 1 FROM "category" c WHERE c.id = ${product.categoryId} AND c.name ILIKE ${s})`,
      )!,
    );
  }

  if (categoryId) {
    const cid = parseInt(categoryId, 10);
    if (!Number.isNaN(cid)) conditions.push(eq(product.categoryId, cid));
  }

  if (stockStatus === "in") {
    conditions.push(eq(product.inStock, true));
    conditions.push(gt(product.stockQuantity, 0));
  } else if (stockStatus === "out") {
    conditions.push(
      or(eq(product.inStock, false), eq(product.stockQuantity, 0))!,
    );
  } else if (stockStatus === "low") {
    conditions.push(gt(product.reorderLevel, 0));
    conditions.push(sql`${product.stockQuantity} <= ${product.reorderLevel}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
  const take = Math.max(1, Math.min(limit, 100));

  const [rows, countResult] = await Promise.all([
    db.query.product.findMany({
      where,
      orderBy: (p, { asc, desc }) =>
        sort === "oldest"
          ? [asc(p.createdAt)]
          : sort === "popular"
            ? [desc(p.stockQuantity)]
            : [desc(p.createdAt)],
      offset,
      limit: take,
      columns: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        stockQuantity: true,
        inStock: true,
        reorderLevel: true,
        supplier: true,
        lastRestockedAt: true,
        categoryId: true,
        subCategoryId: true,
      },
      with: {
        category: { columns: { name: true, slug: true } },
        subCategory: { columns: { name: true } },
      },
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(product).where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  return { products: rows, total };
}
