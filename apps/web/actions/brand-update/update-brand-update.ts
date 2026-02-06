"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { brandUpdate, type NewBrandUpdate } from "@/db/schema/brand-update";

export async function updateBrandUpdate(
  id: number,
  data: Partial<Omit<NewBrandUpdate, "id">>,
) {
  try {
    await db
      .update(brandUpdate)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(brandUpdate.id, id));

    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/brand-updates");
    return { success: true, message: "Brand update saved" };
  } catch (error) {
    console.error("Failed to update brand update:", error);
    return { success: false, error: "Failed to update brand update" };
  }
}

export async function toggleBrandUpdateActive(id: number, active: boolean) {
  try {
    await db
      .update(brandUpdate)
      .set({ active, updatedAt: new Date() })
      .where(eq(brandUpdate.id, id));

    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/brand-updates");
    return {
      success: true,
      message: `Brand update ${active ? "activated" : "deactivated"}`,
    };
  } catch (error) {
    console.error("Failed to toggle brand update status:", error);
    return { success: false, error: "Failed to update brand update status" };
  }
}
