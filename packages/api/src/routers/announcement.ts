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
    // Public: Get active announcements
    getActive: publicProcedure.handler(async () => {
        return await db
            .select()
            .from(announcement)
            .where(eq(announcement.active, true))
            .orderBy(desc(announcement.createdAt));
    }),

    // Admin: Get all announcements
    getAll: adminProcedure.handler(async () => {
        return await db
            .select()
            .from(announcement)
            .orderBy(desc(announcement.createdAt));
    }),

    // Admin: Create announcement
    create: adminProcedure
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

    // Admin: Update announcement
    update: adminProcedure
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

    // Admin: Delete announcement
    delete: adminProcedure
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
