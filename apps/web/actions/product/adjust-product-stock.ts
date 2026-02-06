"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { db } from "@/db/config";
import { product } from "@/db/schema/product";

export async function adjustProductStock(
  productId: number,
  newQuantity: number,
) {
  const session = await checkAuth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  if (newQuantity < 0) {
    return { success: false, error: "Quantity cannot be negative" };
  }

  try {
    const [updated] = await db
      .update(product)
      .set({
        stockQuantity: newQuantity,
        inStock: newQuantity > 0,
      })
      .where(eq(product.id, productId))
      .returning();

    if (!updated) {
      return { success: false, error: "Product not found" };
    }

    revalidatePath("/dashboard/admin/stock");
    revalidatePath("/dashboard/admin/products");
    revalidatePath("/");

    return { success: true, data: updated };
  } catch (err) {
    console.error("adjustProductStock:", err);
    return { success: false, error: "Failed to update stock" };
  }
}
