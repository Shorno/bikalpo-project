import { db } from "@bikalpo-project/db";
import { brand } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";

// Validation schemas
const createBrandSchema = z.object({
    name: z.string().min(2).max(100).trim(),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).trim(),
    logo: z.string().url().max(255),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
});

const updateBrandSchema = createBrandSchema.extend({
    id: z.number().int(),
});

export const brandRouter = {
    /**
     * Get all brands
     * REST: GET /api/brands
     */
    getAll: publicProcedure
        .route({
            method: "GET",
            path: "/brands",
            tags: ["Brands"],
            summary: "Get all brands",
            description: "Get all brands ordered by display order",
        })
        .handler(async () => {
            return await db.query.brand.findMany({
                orderBy: [asc(brand.displayOrder)],
            });
        }),

    /**
     * Get active brands only
     * REST: GET /api/brands/active
     */
    getActive: publicProcedure
        .route({
            method: "GET",
            path: "/brands/active",
            tags: ["Brands"],
            summary: "Get active brands",
            description: "Get only active brands for public display",
        })
        .handler(async () => {
            return await db.query.brand.findMany({
                where: (b, { eq }) => eq(b.isActive, true),
                orderBy: [asc(brand.displayOrder)],
            });
        }),

    /**
     * Get brand by ID
     * REST: GET /api/brands/{id}
     */
    getById: publicProcedure
        .route({
            method: "GET",
            path: "/brands/{id}",
            tags: ["Brands"],
            summary: "Get brand by ID",
            description: "Get a single brand by its ID",
        })
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

    /**
     * Create a new brand
     * REST: POST /api/brands
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/brands",
            tags: ["Brands"],
            summary: "Create brand",
            description: "Create a new brand (admin only)",
        })
        .input(createBrandSchema)
        .handler(async ({ input }) => {
            const [newBrand] = await db.insert(brand).values(input).returning();
            return {
                data: newBrand,
                message: "Brand created successfully",
            };
        }),

    /**
     * Update a brand
     * REST: PUT /api/brands/{id}
     */
    update: adminProcedure
        .route({
            method: "PUT",
            path: "/brands/{id}",
            tags: ["Brands"],
            summary: "Update brand",
            description: "Update an existing brand (admin only)",
        })
        .input(updateBrandSchema)
        .handler(async ({ input }) => {
            const { id, ...data } = input;

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

    /**
     * Delete a brand
     * REST: DELETE /api/brands/{id}
     */
    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/brands/{id}",
            tags: ["Brands"],
            summary: "Delete brand",
            description: "Delete a brand (admin only)",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
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
