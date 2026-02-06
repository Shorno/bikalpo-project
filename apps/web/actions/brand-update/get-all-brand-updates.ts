"use server";

import { desc } from "drizzle-orm";
import { db } from "@/db/config";
import { brandUpdate } from "@/db/schema/brand-update";

export async function getAllBrandUpdates() {
  try {
    const data = await db
      .select()
      .from(brandUpdate)
      .orderBy(desc(brandUpdate.createdAt));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch all brand updates:", error);
    return { success: false, data: [] };
  }
}
