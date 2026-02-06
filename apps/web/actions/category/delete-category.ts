"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { category } from "@/db/schema/category";

export default async function deleteCategory(categoryId: number) {
  try {
    // Check if categories exists
    const existingCategory = await db
      .select()
      .from(category)
      .where(eq(category.id, categoryId))
      .limit(1);

    if (existingCategory.length === 0) {
      return {
        success: false,
        status: 404,
        error: "Category not found",
      };
    }

    await db.delete(category).where(eq(category.id, categoryId));

    // Revalidate only client-facing routes (not admin dashboard)
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Category and all subcategories deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting categories:", error);
    return {
      success: false,
      status: 500,
      error: "Failed to delete categories",
    };
  }
}
