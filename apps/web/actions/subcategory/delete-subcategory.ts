"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { subCategory } from "@/db/schema/category";

export default async function deleteSubcategory(subcategoryId: number) {
  try {
    const existingSubcategory = await db
      .select()
      .from(subCategory)
      .where(eq(subCategory.id, subcategoryId))
      .limit(1);

    if (existingSubcategory.length === 0) {
      return {
        success: false,
        status: 404,
        error: "Subcategory not found",
      };
    }

    await db.delete(subCategory).where(eq(subCategory.id, subcategoryId));

    // Revalidate only client-facing routes (not admin dashboard)
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Subcategory deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return {
      success: false,
      status: 500,
      error: "Failed to delete subcategory",
    };
  }
}
