"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { announcement, type NewAnnouncement } from "@/db/schema/announcement";

export async function createAnnouncement(data: NewAnnouncement) {
  try {
    await db.insert(announcement).values(data);
    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/announcements");
    return { success: true, message: "Announcement created" };
  } catch (error) {
    console.error("Failed to create announcement:", error);
    return { success: false, error: "Failed to create announcement" };
  }
}
