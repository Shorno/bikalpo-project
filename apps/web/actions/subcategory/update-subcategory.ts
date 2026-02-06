"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { subCategory } from "@/db/schema/category";
import type { UpdateSubcategoryFormValues } from "@/schema/category.scheam";

export default async function updateSubcategory(
  data: UpdateSubcategoryFormValues,
) {
  try {
    const existingSubcategory = await db
      .select()
      .from(subCategory)
      .where(eq(subCategory.id, data.id))
      .limit(1);

    if (existingSubcategory.length === 0) {
      return {
        success: false,
        status: 404,
        error: "Subcategory not found",
      };
    }

    await db
      .update(subCategory)
      .set({
        name: data.name,
        slug: data.slug,
        image: data.image,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        updatedAt: new Date(),
      })
      .where(eq(subCategory.id, data.id));

    // Revalidate only client-facing routes (not admin dashboard)
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Subcategory updated successfully",
    };
  } catch (error) {
    console.error("Error updating subcategory:", error);
    return {
      success: false,
      status: 500,
      error: "Failed to update subcategory",
    };
  }
}
