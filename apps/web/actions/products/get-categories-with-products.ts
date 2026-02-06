"use server";

import { db } from "@/db/config";

export async function getCategoriesWithProducts(limit: number = 4) {
  const categories = await db.query.category.findMany({
    where: (category, { eq }) => eq(category.isActive, true),
    orderBy: (category, { asc }) => [asc(category.displayOrder)],
  });

  // For each category, get limited products
  const categoriesWithProducts = await Promise.all(
    categories.map(async (cat) => {
      const products = await db.query.product.findMany({
        where: (product, { eq, and }) =>
          and(eq(product.categoryId, cat.id), eq(product.inStock, true)),
        with: {
          category: {
            columns: {
              name: true,
              slug: true,
            },
          },
        },
        limit: limit,
        orderBy: (product, { desc }) => [desc(product.createdAt)],
      });

      return {
        ...cat,
        products,
        totalProducts: products.length,
      };
    }),
  );

  // Filter out categories with no products
  return categoriesWithProducts.filter((cat) => cat.products.length > 0);
}
