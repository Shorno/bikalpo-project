import { db } from "@bikalpo-project/db";
import { announcement } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";

// Validation schema
const announcementSchema = z.object({
    title: z.string().min(1).max(255),
    content: z.string().min(1),
    active: z.boolean().default(true),
});

const updateAnnouncementSchema = announcementSchema.extend({
    id: z.number().int(),
});

export const announcementRouter = {
    /**
     * Get active announcements
     * REST: GET /api/announcements
     */
    getActive: publicProcedure
        .route({
            method: "GET",
            path: "/announcements",
            tags: ["Announcements"],
            summary: "Get active announcements",
            description: "Get all active announcements for public display",
        })
        .handler(async () => {
            return await db
                .select()
                .from(announcement)
                .where(eq(announcement.active, true))
                .orderBy(desc(announcement.createdAt));
        }),

    /**
     * Get all announcements (admin)
     * REST: GET /api/announcements/all
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/announcements/all",
            tags: ["Announcements"],
            summary: "Get all announcements",
            description: "Get all announcements including inactive (admin only)",
        })
        .handler(async () => {
            return await db
                .select()
                .from(announcement)
                .orderBy(desc(announcement.createdAt));
        }),

    /**
     * Create an announcement
     * REST: POST /api/announcements
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/announcements",
            tags: ["Announcements"],
            summary: "Create announcement",
            description: "Create a new announcement (admin only)",
        })
        .input(announcementSchema)
        .handler(async ({ input }) => {
            const [newAnnouncement] = await db
                .insert(announcement)
                .values(input)
                .returning();
            return {
                data: newAnnouncement,
                message: "Announcement created successfully",
            };
        }),

    /**
     * Update an announcement
     * REST: PUT /api/announcements/{id}
     */
    update: adminProcedure
        .route({
            method: "PUT",
            path: "/announcements/{id}",
            tags: ["Announcements"],
            summary: "Update announcement",
            description: "Update an existing announcement (admin only)",
        })
        .input(updateAnnouncementSchema)
        .handler(async ({ input }) => {
            const { id, ...data } = input;

            const existing = await db.query.announcement.findFirst({
                where: (a, { eq }) => eq(a.id, id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Announcement not found" });
            }

            await db
                .update(announcement)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(announcement.id, id));

            return { message: "Announcement updated successfully" };
        }),

    /**
     * Delete an announcement
     * REST: DELETE /api/announcements/{id}
     */
    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/announcements/{id}",
            tags: ["Announcements"],
            summary: "Delete announcement",
            description: "Delete an announcement (admin only)",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const existing = await db.query.announcement.findFirst({
                where: (a, { eq }) => eq(a.id, input.id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Announcement not found" });
            }

            await db.delete(announcement).where(eq(announcement.id, input.id));

            return { message: "Announcement deleted successfully" };
        }),
};
