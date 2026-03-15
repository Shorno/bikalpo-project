import { db } from "@bikalpo-project/db";
import { category } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";

// Validation schemas
const createCategorySchema = z.object({
    name: z.string().min(2).max(100).trim(),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).trim(),
    image: z.string().url().max(255),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
    typeId: z.number().int().nullable().optional(),
});

const updateCategorySchema = createCategorySchema.extend({
    id: z.number().int(),
});

export const categoryRouter = {
    /**
     * Get all categories with subcategories
     * REST: GET /api/categories
     */
    getAll: publicProcedure
        .route({
            method: "GET",
            path: "/categories",
            tags: ["Categories"],
            summary: "Get all categories",
            description: "Get all categories with their subcategories",
        })
        .handler(async () => {
            return await db.query.category.findMany({
                with: { subCategory: true },
                orderBy: [asc(category.displayOrder)],
            });
        }),

    /**
     * Get active categories only
     * REST: GET /api/categories/active
     */
    getActive: publicProcedure
        .route({
            method: "GET",
            path: "/categories/active",
            tags: ["Categories"],
            summary: "Get active categories",
            description: "Get only active categories with subcategories for public display",
        })
        .handler(async () => {
            return await db.query.category.findMany({
                where: (c, { eq }) => eq(c.isActive, true),
                with: { subCategory: true },
                orderBy: [asc(category.displayOrder)],
            });
        }),

    /**
     * Get category by ID
     * REST: GET /api/categories/{id}
     */
    getById: publicProcedure
        .route({
            method: "GET",
            path: "/categories/{id}",
            tags: ["Categories"],
            summary: "Get category by ID",
            description: "Get a single category with subcategories by its ID",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const result = await db.query.category.findFirst({
                where: (c, { eq }) => eq(c.id, input.id),
                with: { subCategory: true },
            });

            if (!result) {
                throw new ORPCError("NOT_FOUND", { message: "Category not found" });
            }

            return result;
        }),

    /**
     * Create a new category
     * REST: POST /api/categories
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/categories",
            tags: ["Admin Categories"],
            summary: "Create category",
            description: "Create a new category (admin only)",
        })
        .input(createCategorySchema)
        .handler(async ({ input }) => {
            const [newCategory] = await db.insert(category).values(input).returning();
            return {
                data: newCategory,
                message: "Category created successfully",
            };
        }),

    /**
     * Update a category
     * REST: PUT /api/categories/{id}
     */
    update: adminProcedure
        .route({
            method: "PUT",
            path: "/categories/{id}",
            tags: ["Admin Categories"],
            summary: "Update category",
            description: "Update an existing category (admin only)",
        })
        .input(updateCategorySchema)
        .handler(async ({ input }) => {
            const { id, ...data } = input;

            const existing = await db.query.category.findFirst({
                where: (c, { eq }) => eq(c.id, id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Category not found" });
            }

            await db
                .update(category)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(category.id, id));

            return { message: "Category updated successfully" };
        }),

    /**
     * Delete a category
     * REST: DELETE /api/categories/{id}
     */
    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/categories/{id}",
            tags: ["Admin Categories"],
            summary: "Delete category",
            description: "Delete a category (admin only)",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const existing = await db.query.category.findFirst({
                where: (c, { eq }) => eq(c.id, input.id),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Category not found" });
            }

            await db.delete(category).where(eq(category.id, input.id));

            return { message: "Category deleted successfully" };
        }),
};
