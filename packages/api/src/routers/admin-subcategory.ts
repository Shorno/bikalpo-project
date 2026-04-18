import { eq, asc, and, ilike, type SQL, inArray, countDistinct, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { subCategory, category, product, productType } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";

const createSubcategoryInput = z.object({
    name: z.string().min(2).max(100).trim(),
    slug: z
        .string()
        .min(2)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .trim(),
    image: z.string().max(255).optional(),
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).default(0),
    categoryId: z.number().int(),
});

const updateSubcategoryInput = createSubcategoryInput.extend({
    id: z.number().int(),
});

export const adminSubcategoryRouter = {
    /**
     * Get ALL subcategories globally with parent category and type info
     */
    getAllGlobal: adminProcedure
        .handler(async () => {
            return db.query.subCategory.findMany({
                with: {
                    category: {
                        columns: { id: true, name: true, typeId: true },
                        with: {
                            type: { columns: { id: true, name: true } },
                        },
                    },
                },
                orderBy: [asc(subCategory.displayOrder), asc(subCategory.name)],
            });
        }),

    /**
     * Get single subcategory by ID with products, brands, variants
     */
    getById: adminProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const sub = await db.query.subCategory.findFirst({
                where: eq(subCategory.id, input.id),
                with: {
                    category: {
                        columns: { id: true, name: true, typeId: true },
                        with: {
                            type: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            if (!sub) {
                throw new Error("Subcategory not found");
            }

            // Get products under this subcategory
            const products = await db.query.product.findMany({
                where: eq(product.subCategoryId, input.id),
                columns: {
                    id: true,
                    name: true,
                    slug: true,
                    size: true,
                    status: true,
                    image: true,
                },
                with: {
                    brand: { columns: { id: true, name: true } },
                    variants: { columns: { id: true, unitLabel: true, sku: true, packType: true } },
                },
                orderBy: [asc(product.name)],
            });

            // Extract unique brands
            const brandsMap = new Map<number, string>();
            for (const p of products) {
                if (p.brand) {
                    brandsMap.set(p.brand.id, p.brand.name);
                }
            }
            const brands = Array.from(brandsMap.entries()).map(([id, name]) => ({ id, name }));

            // Extract unique variants
            const variantsMap = new Map<number, { unitLabel: string; sku: string | null; packType: string | null }>();
            for (const p of products) {
                if (p.variants) {
                    for (const v of p.variants) {
                        variantsMap.set(v.id, { unitLabel: v.unitLabel, sku: v.sku, packType: v.packType });
                    }
                }
            }
            const variants = Array.from(variantsMap.entries()).map(([id, data]) => ({ id, ...data }));

            return { subcategory: sub, products, brands, variants };
        }),

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
            // Auto-generate next 3-digit skuCode scoped to categoryId
            const filterCondition = sql`${subCategory.categoryId} = ${input.categoryId}`;
            const skuCode = await nextSkuCode(subCategory, subCategory.skuCode, 3, filterCondition);

            const [result] = await db.insert(subCategory).values({ ...input, skuCode }).returning();
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
                    categoryId: input.categoryId,
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
