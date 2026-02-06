"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { brandUpdate } from "@/db/schema/brand-update";

export async function deleteBrandUpdate(id: number) {
  try {
    await db.delete(brandUpdate).where(eq(brandUpdate.id, id));
    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/brand-updates");
    return { success: true, message: "Brand update deleted" };
  } catch (error) {
    console.error("Failed to delete brand update:", error);
    return { success: false, error: "Failed to delete brand update" };
  }
}
