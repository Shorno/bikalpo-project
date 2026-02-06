import { db } from "@bikalpo-project/db";
import { category, subCategory } from "@bikalpo-project/db/schema";
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
});

const updateCategorySchema = createCategorySchema.extend({
    id: z.number().int(),
});

const createSubcategorySchema = createCategorySchema.extend({
    categoryId: z.number().int(),
});

const updateSubcategorySchema = createSubcategorySchema.extend({
    id: z.number().int(),
});

export const categoryRouter = {
    // Public: Get all categories with subcategories
    getAll: publicProcedure.handler(async () => {
        return await db.query.category.findMany({
            with: { subCategory: true },
            orderBy: [asc(category.displayOrder)],
        });
    }),

    // Public: Get active categories only
    getActive: publicProcedure.handler(async () => {
        return await db.query.category.findMany({
            where: (c, { eq }) => eq(c.isActive, true),
            with: { subCategory: true },
            orderBy: [asc(category.displayOrder)],
        });
    }),

    // Public: Get category by ID
    getById: publicProcedure
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

    // Admin: Create category
    create: adminProcedure
        .input(createCategorySchema)
        .handler(async ({ input }) => {
            const [newCategory] = await db.insert(category).values(input).returning();
            return {
                data: newCategory,
                message: "Category created successfully",
            };
        }),

    // Admin: Update category
    update: adminProcedure
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

    // Admin: Delete category
    delete: adminProcedure
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

    // Subcategory procedures
    subcategory: {
        // Public: Get subcategories by category ID
        getByCategoryId: publicProcedure
            .input(z.object({ categoryId: z.number().int() }))
            .handler(async ({ input }) => {
                return await db.query.subCategory.findMany({
                    where: (s, { eq }) => eq(s.categoryId, input.categoryId),
                    orderBy: [asc(subCategory.displayOrder)],
                });
            }),

        // Admin: Create subcategory
        create: adminProcedure
            .input(createSubcategorySchema)
            .handler(async ({ input }) => {
                // Check if parent category exists
                const parentCategory = await db.query.category.findFirst({
                    where: (c, { eq }) => eq(c.id, input.categoryId),
                });

                if (!parentCategory) {
                    throw new ORPCError("NOT_FOUND", { message: "Parent category not found" });
                }

                const [newSubcategory] = await db.insert(subCategory).values(input).returning();
                return {
                    data: newSubcategory,
                    message: "Subcategory created successfully",
                };
            }),

        // Admin: Update subcategory
        update: adminProcedure
            .input(updateSubcategorySchema)
            .handler(async ({ input }) => {
                const { id, ...data } = input;

                const existing = await db.query.subCategory.findFirst({
                    where: (s, { eq }) => eq(s.id, id),
                });

                if (!existing) {
                    throw new ORPCError("NOT_FOUND", { message: "Subcategory not found" });
                }

                await db
                    .update(subCategory)
                    .set({ ...data, updatedAt: new Date() })
                    .where(eq(subCategory.id, id));

                return { message: "Subcategory updated successfully" };
            }),

        // Admin: Delete subcategory
        delete: adminProcedure
            .input(z.object({ id: z.number().int() }))
            .handler(async ({ input }) => {
                const existing = await db.query.subCategory.findFirst({
                    where: (s, { eq }) => eq(s.id, input.id),
                });

                if (!existing) {
                    throw new ORPCError("NOT_FOUND", { message: "Subcategory not found" });
                }

                await db.delete(subCategory).where(eq(subCategory.id, input.id));

                return { message: "Subcategory deleted successfully" };
            }),
    },
};
