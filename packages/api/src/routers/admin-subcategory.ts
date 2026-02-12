import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { subCategory } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const createSubcategoryInput = z.object({
    name: z.string().min(2).max(100).trim(),
    slug: z
        .string()
        .min(2)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .trim(),
    image: z.string().url().max(255),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
    categoryId: z.number().int(),
});

const updateSubcategoryInput = createSubcategoryInput.extend({
    id: z.number().int(),
});

export const adminSubcategoryRouter = {
    getAll: adminProcedure
        .route({
            method: "POST",
            path: "/admin/subcategories/list",
            tags: ["Admin Subcategories"],
            summary: "Get subcategories by category",
            description: "Get all subcategories for a given category",
        })
        .input(z.object({ categoryId: z.number().int() }))
        .handler(async ({ input }) => {
            return db.query.subCategory.findMany({
                where: eq(subCategory.categoryId, input.categoryId),
            });
        }),

    create: adminProcedure
        .route({
            method: "POST",
            path: "/admin/subcategories",
            tags: ["Admin Subcategories"],
            summary: "Create subcategory",
            description: "Create a new subcategory",
        })
        .input(createSubcategoryInput)
        .handler(async ({ input }) => {
            const [result] = await db.insert(subCategory).values(input).returning();
            return result;
        }),

    update: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/subcategories/update",
            tags: ["Admin Subcategories"],
            summary: "Update subcategory",
            description: "Update an existing subcategory",
        })
        .input(updateSubcategoryInput)
        .handler(async ({ input }) => {
            const existing = await db
                .select()
                .from(subCategory)
                .where(eq(subCategory.id, input.id))
                .limit(1);

            if (existing.length === 0) throw new Error("Subcategory not found");

            await db
                .update(subCategory)
                .set({
                    name: input.name,
                    slug: input.slug,
                    image: input.image,
                    isActive: input.isActive,
                    displayOrder: input.displayOrder,
                    updatedAt: new Date(),
                })
                .where(eq(subCategory.id, input.id));

            return { message: "Subcategory updated successfully" };
        }),

    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/subcategories/delete",
            tags: ["Admin Subcategories"],
            summary: "Delete subcategory",
            description: "Delete a subcategory",
        })
        .input(z.object({ subcategoryId: z.number().int() }))
        .handler(async ({ input }) => {
            const existing = await db
                .select()
                .from(subCategory)
                .where(eq(subCategory.id, input.subcategoryId))
                .limit(1);

            if (existing.length === 0) throw new Error("Subcategory not found");

            await db.delete(subCategory).where(eq(subCategory.id, input.subcategoryId));

            return { message: "Subcategory deleted successfully" };
        }),
};
