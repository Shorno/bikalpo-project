"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db/config";
import { announcement } from "@/db/schema/announcement";

export async function getAnnouncements() {
  try {
    const data = await db
      .select()
      .from(announcement)
      .where(eq(announcement.active, true))
      .orderBy(desc(announcement.createdAt));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    return { success: false, data: [] };
  }
}
