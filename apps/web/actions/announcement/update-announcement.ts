"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { announcement, type NewAnnouncement } from "@/db/schema/announcement";

export async function updateAnnouncement(
  id: number,
  data: Partial<Omit<NewAnnouncement, "id">>,
) {
  try {
    await db
      .update(announcement)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(announcement.id, id));

    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/announcements");
    return { success: true, message: "Announcement updated" };
  } catch (error) {
    console.error("Failed to update announcement:", error);
    return { success: false, error: "Failed to update announcement" };
  }
}

export async function toggleAnnouncementActive(id: number, active: boolean) {
  try {
    await db
      .update(announcement)
      .set({ active, updatedAt: new Date() })
      .where(eq(announcement.id, id));

    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/announcements");
    return {
      success: true,
      message: `Announcement ${active ? "activated" : "deactivated"}`,
    };
  } catch (error) {
    console.error("Failed to toggle announcement status:", error);
    return { success: false, error: "Failed to update announcement status" };
  }
}
