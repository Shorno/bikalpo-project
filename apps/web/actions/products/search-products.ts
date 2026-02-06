"use server";
import { ilike } from "drizzle-orm";
import { db } from "@/db/config";
import { product } from "@/db/schema/product";

export async function searchProducts(query: string) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  return await db.query.product.findMany({
    where: ilike(product.name, `%${query}%`),
    with: {
      category: {
        columns: {
          name: true,
          slug: true,
        },
      },
    },
    limit: 10,
  });
}
