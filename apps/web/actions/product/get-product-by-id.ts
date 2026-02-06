"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/config";
import { product } from "@/db/schema/product";

export default async function getProductById(id: number) {
  return await db.query.product.findFirst({
    where: eq(product.id, id),
    with: {
      category: true,
      subCategory: true,
      brand: true,
      images: true,
      variants: true,
    },
  });
}
