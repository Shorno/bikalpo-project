"use server";
import { eq } from "drizzle-orm";
import { db } from "@/db/config";
import { product } from "@/db/schema/product";

export default async function getProductBySlug(slug: string) {
  try {
    const productData = await db.query.product.findFirst({
      where: eq(product.slug, slug),
      with: {
        category: {
          columns: {
            name: true,
            slug: true,
          },
        },
        subCategory: {
          columns: {
            name: true,
          },
        },
        brand: {
          columns: {
            name: true,
          },
        },
        images: true,
        variants: true,
      },
    });

    if (!productData) {
      return null;
    }

    return productData;
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    return null;
  }
}
