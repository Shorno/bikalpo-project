"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { productVariant } from "@/db/schema/product-variant";

export async function deleteVariant(id: number) {
  await db.delete(productVariant).where(eq(productVariant.id, id));
  revalidatePath("/dashboard/admin/products");
}
