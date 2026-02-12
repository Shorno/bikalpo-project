import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { brandUpdate } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const brandUpdateInput = z.object({
    title: z.string().min(3),
    description: z.string().optional().default(""),
    type: z.enum(["info", "warning", "new", "offer"]).default("info"),
});

export const adminBrandUpdateRouter = {
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/admin/brand-updates",
            tags: ["Admin Brand Updates"],
            summary: "Get all brand updates",
            description: "Get all brand updates for admin management",
        })
        .handler(async () => {
            return db
                .select()
                .from(brandUpdate)
                .orderBy(desc(brandUpdate.createdAt));
        }),

    create: adminProcedure
        .route({
            method: "POST",
            path: "/admin/brand-updates",
            tags: ["Admin Brand Updates"],
            summary: "Create brand update",
            description: "Create a new brand update",
        })
        .input(brandUpdateInput)
        .handler(async ({ input }) => {
            await db.insert(brandUpdate).values(input);
            return { message: "Brand update created" };
        }),

    update: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/brand-updates/update",
            tags: ["Admin Brand Updates"],
            summary: "Update brand update",
            description: "Update an existing brand update",
        })
        .input(
            z.object({
                id: z.number().int(),
                data: brandUpdateInput.partial(),
            }),
        )
        .handler(async ({ input }) => {
            await db
                .update(brandUpdate)
                .set({ ...input.data, updatedAt: new Date() })
                .where(eq(brandUpdate.id, input.id));
            return { message: "Brand update saved" };
        }),

    toggleActive: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/brand-updates/toggle-active",
            tags: ["Admin Brand Updates"],
            summary: "Toggle brand update active status",
            description: "Activate or deactivate a brand update",
        })
        .input(z.object({ id: z.number().int(), active: z.boolean() }))
        .handler(async ({ input }) => {
            await db
                .update(brandUpdate)
                .set({ active: input.active, updatedAt: new Date() })
                .where(eq(brandUpdate.id, input.id));
            return {
                message: `Brand update ${input.active ? "activated" : "deactivated"}`,
            };
        }),

    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/brand-updates/delete",
            tags: ["Admin Brand Updates"],
            summary: "Delete brand update",
            description: "Delete a brand update",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            await db.delete(brandUpdate).where(eq(brandUpdate.id, input.id));
            return { message: "Brand update deleted" };
        }),
};
