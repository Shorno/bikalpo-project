"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { category } from "@/db/schema/category";
import type { UpdateCategoryFormValues } from "@/schema/category.scheam";

export default async function updateCategory(data: UpdateCategoryFormValues) {
  try {
    // Check if categories exists
    const existingCategory = await db
      .select()
      .from(category)
      .where(eq(category.id, data.id))
      .limit(1);

    if (existingCategory.length === 0) {
      return {
        success: false,
        status: 404,
        error: "Category not found",
      };
    }

    await db
      .update(category)
      .set({
        name: data.name,
        slug: data.slug,
        image: data.image,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        updatedAt: new Date(),
      })
      .where(eq(category.id, data.id));

    // Revalidate only client-facing routes (not admin dashboard)
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Category updated successfully",
    };
  } catch (error) {
    console.error("Error updating categories:", error);
    return {
      success: false,
      status: 500,
      error: "Failed to update categories",
    };
  }
}
