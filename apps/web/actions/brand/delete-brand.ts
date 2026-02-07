"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { checkAuth } from "@/utils/auth";
import { db } from "@/db/config";
import { brand } from "@/db/schema/brand";

export default async function deleteBrand(brandId: number) {
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
      .where(eq(brand.id, brandId))
      .limit(1);

    if (existingBrand.length === 0) {
      return {
        success: false,
        status: 404,
        error: "Brand not found",
      };
    }

    await db.delete(brand).where(eq(brand.id, brandId));

    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: "Brand deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting brand:", error);
    return {
      success: false,
      status: 500,
      error: "Failed to delete brand",
    };
  }
}
