"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { announcement } from "@/db/schema/announcement";

export async function deleteAnnouncement(id: number) {
  try {
    await db.delete(announcement).where(eq(announcement.id, id));
    revalidatePath("/customer");
    revalidatePath("/dashboard/admin/announcements");
    return { success: true, message: "Announcement deleted" };
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return { success: false, error: "Failed to delete announcement" };
  }
}
