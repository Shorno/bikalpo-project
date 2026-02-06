"use server";

import { desc } from "drizzle-orm";
import { db } from "@/db/config";
import { announcement } from "@/db/schema/announcement";

export async function getAllAnnouncements() {
  try {
    const data = await db
      .select()
      .from(announcement)
      .orderBy(desc(announcement.createdAt));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch all announcements:", error);
    return { success: false, data: [] };
  }
}
