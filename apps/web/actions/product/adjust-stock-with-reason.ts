"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { db } from "@/db/config";
import { product } from "@/db/schema/product";
import {
  type StockChangeType,
  stockChangeLog,
} from "@/db/schema/stock-change-log";

export async function adjustStockWithReason(
  productId: number,
  changeType: "add" | "reduce",
  quantity: number,
  reason?: string,
) {
  const session = await checkAuth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be greater than 0" };
  }

  try {
    const [p] = await db
      .select()
      .from(product)
      .where(eq(product.id, productId));
    if (!p) return { success: false, error: "Product not found" };

    const current = p.stockQuantity;
    const newQty =
      changeType === "add"
        ? current + quantity
        : Math.max(0, current - quantity);

    await db
      .update(product)
      .set({
        stockQuantity: newQty,
        inStock: newQty > 0,
        ...(changeType === "add" ? { lastRestockedAt: new Date() } : {}),
      })
      .where(eq(product.id, productId));

    await db.insert(stockChangeLog).values({
      productId,
      changeType: changeType as StockChangeType,
      quantity: changeType === "add" ? quantity : -quantity,
      reason: reason || null,
      createdById: session.user.id,
    });

    revalidatePath("/dashboard/admin/stock");
    revalidatePath("/dashboard/admin/products");
    revalidatePath("/");

    return { success: true, data: { stockQuantity: newQty } };
  } catch (err) {
    console.error("adjustStockWithReason:", err);
    return { success: false, error: "Failed to update stock" };
  }
}
