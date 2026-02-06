"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { brandUpdate, type NewBrandUpdate } from "@/db/schema/brand-update";

export async function createBrandUpdate(data: NewBrandUpdate) {
  try {
    await db.insert(brandUpdate).values(data);
    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/brand-updates");
    return { success: true, message: "Brand update created" };
  } catch (error) {
    console.error("Failed to create brand update:", error);
    return { success: false, error: "Failed to create brand update" };
  }
}
