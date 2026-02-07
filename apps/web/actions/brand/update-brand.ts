"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth } from "@/utils/auth";
import { db } from "@/db/config";
import { brand } from "@/db/schema/brand";
import type { UpdateBrandFormValues } from "@/schema/brand.schema";

export default async function updateBrand(data: UpdateBrandFormValues) {
  const session = await checkAuth();

  if (!session?.user || session?.user.role !== "admin") {
    return {
      success: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  try {
    const existingBrand = await db
      .select()
      .from(brand)
      .where(eq(brand.id, data.id))
      .limit(1);

    if (existingBrand.length === 0) {
      return {
        success: false,
        status: 404,
        error: "Brand not found",
      };
    }

    await db
      .update(brand)
      .set({
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
        updatedAt: new Date(),
      })
      .where(eq(brand.id, data.id));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Brand updated successfully",
    };
  } catch (error) {
    console.error("Error updating brand:", error);
    return {
      success: false,
      status: 500,
      error: "Failed to update brand",
    };
  }
}
