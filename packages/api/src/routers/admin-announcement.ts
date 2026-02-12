import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { announcement } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const announcementInput = z.object({
    title: z.string().min(3),
    description: z.string().optional().default(""),
    type: z.enum(["info", "warning", "success", "alert"]).default("info"),
});

export const adminAnnouncementRouter = {
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/admin/announcements",
            tags: ["Admin Announcements"],
            summary: "Get all announcements",
            description: "Get all announcements for admin management",
        })
        .handler(async () => {
            return db
                .select()
                .from(announcement)
                .orderBy(desc(announcement.createdAt));
        }),

    create: adminProcedure
        .route({
            method: "POST",
            path: "/admin/announcements",
            tags: ["Admin Announcements"],
            summary: "Create announcement",
            description: "Create a new announcement",
        })
        .input(announcementInput)
        .handler(async ({ input }) => {
            await db.insert(announcement).values(input);
            return { message: "Announcement created" };
        }),

    update: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/announcements/update",
            tags: ["Admin Announcements"],
            summary: "Update announcement",
            description: "Update an existing announcement",
        })
        .input(
            z.object({
                id: z.number().int(),
                data: announcementInput.partial(),
            }),
        )
        .handler(async ({ input }) => {
            await db
                .update(announcement)
                .set({ ...input.data, updatedAt: new Date() })
                .where(eq(announcement.id, input.id));
            return { message: "Announcement updated" };
        }),

    toggleActive: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/announcements/toggle-active",
            tags: ["Admin Announcements"],
            summary: "Toggle announcement active status",
            description: "Activate or deactivate an announcement",
        })
        .input(z.object({ id: z.number().int(), active: z.boolean() }))
        .handler(async ({ input }) => {
            await db
                .update(announcement)
                .set({ active: input.active, updatedAt: new Date() })
                .where(eq(announcement.id, input.id));
            return {
                message: `Announcement ${input.active ? "activated" : "deactivated"}`,
            };
        }),

    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/announcements/delete",
            tags: ["Admin Announcements"],
            summary: "Delete announcement",
            description: "Delete an announcement",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            await db
                .delete(announcement)
                .where(eq(announcement.id, input.id));
            return { message: "Announcement deleted" };
        }),
};
