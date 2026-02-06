"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/config";
import { productVariant } from "@/db/schema/product-variant";

export async function getVariantsByProductId(productId: number) {
  return await db.query.productVariant.findMany({
    where: eq(productVariant.productId, productId),
    orderBy: (v, { asc }) => [asc(v.sortOrder), asc(v.id)],
  });
}
