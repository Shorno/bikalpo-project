import { db } from "@bikalpo-project/db";
import { brand } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";

// Validation schemas
const createBrandSchema = z.object({
    name: z
        .string()
        .min(2, "Brand name must be at least 2 characters.")
        .max(100, "Brand name must be at most 100 characters.")
        .trim(),
    slug: z
        .string()
        .min(2, "Slug must be at least 2 characters.")
        .max(100, "Slug must be at most 100 characters.")
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Slug must contain only lowercase letters, numbers, and hyphens",
        )
        .trim(),
    logo: z
        .string()
        .url("Please enter a valid logo URL.")
        .max(255, "Logo URL must be at most 255 characters."),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
});

const updateBrandSchema = createBrandSchema.extend({
    id: z.number().int(),
});

export const brandRouter = {
    // Public: Get all brands
    getAll: publicProcedure.handler(async () => {
        return await db.query.brand.findMany({
            orderBy: [asc(brand.displayOrder)],
        });
    }),

    // Public: Get active brands only
    getActive: publicProcedure.handler(async () => {
        return await db.query.brand.findMany({
            where: (b, { eq }) => eq(b.isActive, true),
            orderBy: [asc(brand.displayOrder)],
        });
    }),

    // Public: Get brand by ID
    getById: publicProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const result = await db.query.brand.findFirst({
                where: (b, { eq }) => eq(b.id, input.id),
            });

            if (!result) {
                throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
            }

            return result;
        }),

    // Admin: Create brand
    create: adminProcedure
        .input(createBrandSchema)
        .handler(async ({ input }) => {
            const [newBrand] = await db.insert(brand).values(input).returning();
            return {
                data: newBrand,
                message: "Brand created successfully",
            };
        }),

    // Admin: Update brand
    update: adminProcedure
        .input(updateBrandSchema)
        .handler(async ({ input }) => {
            const { id, ...data } = input;

            // Check if brand exists
            const existing = await db.query.brand.findFirst({
                where: (b, { eq }) => eq(b.id, id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
            }

            await db
                .update(brand)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(brand.id, id));

            return { message: "Brand updated successfully" };
        }),

    // Admin: Delete brand
    delete: adminProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            // Check if brand exists
            const existing = await db.query.brand.findFirst({
                where: (b, { eq }) => eq(b.id, input.id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
            }

            await db.delete(brand).where(eq(brand.id, input.id));

            return { message: "Brand deleted successfully" };
        }),
};
