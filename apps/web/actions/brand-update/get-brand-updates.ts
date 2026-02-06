"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/config";
import { brandUpdate } from "@/db/schema/brand-update";

export async function getBrandUpdates() {
  try {
    const data = await db
      .select()
      .from(brandUpdate)
      .where(eq(brandUpdate.active, true))
      .orderBy(desc(brandUpdate.createdAt));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch brand updates:", error);
    return { success: false, data: [] };
  }
}
