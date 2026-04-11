import { db } from "@bikalpo-project/db";
import {
    coreProductIdentity,
    coreProductBrand,
    coreProductPackVariant,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "../index";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

// === Input Schemas ===

const packVariantInput = z.object({
    label: z.string().min(1),
    weightKg: z.string(),
    packType: z.string(),
    sellUnit: z.string().optional(),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
});

const createCoreProductSchema = z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional(),
    image: z.string().min(1),
    categoryId: z.number().int(),
    subCategoryId: z.number().int().optional().nullable(),
    brandSupport: z.enum(["multi_brand", "single_brand"]).default("multi_brand"),
    variantSupportPack: z.boolean().default(true),
    variantSupportLoose: z.boolean().default(false),
    defaultLooseUnit: z.string().optional(),
    status: z.enum(["active", "draft", "inactive"]).default("active"),
    displayOrder: z.number().int().default(0),
    // Linked brands
    brandIds: z.array(z.number().int()).default([]),
    defaultBrandId: z.number().int().optional(),
    // Pack variant templates
    packVariants: z.array(packVariantInput).default([]),
});

const updateCoreProductSchema = createCoreProductSchema.extend({
    id: z.number().int(),
});

const listCoreProductsSchema = z.object({
    search: z.string().optional(),
    categoryId: z.number().int().optional(),
    subCategoryId: z.number().int().optional(),
    status: z.enum(["all", "active", "draft", "inactive"]).default("all"),
});

export const adminCoreProductRouter = {
    /**
     * List all core product identities with filters
     */
    getAll: adminProcedure
        .route({
            method: "POST",
            path: "/admin/core-products",
            tags: ["Admin Core Products"],
            summary: "List core products",
            description: "List all core product identities with optional filters",
        })
        .input(listCoreProductsSchema)
        .handler(async ({ input }) => {
            const conditions: SQL[] = [];

            if (input.search?.trim()) {
                const s = `%${input.search.trim()}%`;
                conditions.push(ilike(coreProductIdentity.name, s));
            }
            if (input.categoryId) {
                conditions.push(eq(coreProductIdentity.categoryId, input.categoryId));
            }
            if (input.subCategoryId) {
                conditions.push(eq(coreProductIdentity.subCategoryId, input.subCategoryId));
            }
            if (input.status && input.status !== "all") {
                conditions.push(eq(coreProductIdentity.status, input.status));
            }

            const where = conditions.length > 0 ? and(...conditions) : undefined;

            const results = await db.query.coreProductIdentity.findMany({
                where,
                orderBy: [desc(coreProductIdentity.createdAt)],
                with: {
                    category: {
                        columns: { id: true, name: true, slug: true, typeId: true },
                    },
                    subCategory: {
                        columns: { id: true, name: true },
                    },
                    brands: {
                        with: {
                            brand: {
                                columns: { id: true, name: true, logo: true },
                            },
                        },
                    },
                    packVariants: {
                        orderBy: (pv, { asc }) => [asc(pv.sortOrder)],
                    },
                },
            });

            return { coreProducts: results };
        }),

    /**
     * Get a single core product identity by ID
     */
    getById: adminProcedure
        .route({
            method: "POST",
            path: "/admin/core-products/detail",
            tags: ["Admin Core Products"],
            summary: "Get core product by ID",
            description: "Get full details of a core product identity",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const result = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, input.id),
                with: {
                    category: {
                        columns: { id: true, name: true, slug: true, typeId: true },
                    },
                    subCategory: {
                        columns: { id: true, name: true },
                    },
                    brands: {
                        with: {
                            brand: {
                                columns: { id: true, name: true, logo: true, slug: true },
                            },
                        },
                    },
                    packVariants: {
                        orderBy: (pv, { asc }) => [asc(pv.sortOrder)],
                    },
                },
            });

            if (!result) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Core product identity not found",
                });
            }

            return { coreProduct: result };
        }),

    /**
     * Create a new core product identity
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/admin/core-products/create",
            tags: ["Admin Core Products"],
            summary: "Create core product",
            description: "Create a new core product identity with brands and pack variants",
        })
        .input(createCoreProductSchema)
        .handler(async ({ input }) => {
            const { brandIds, defaultBrandId, packVariants, ...identityData } = input;

            // Check uniqueness
            const existingName = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.name, identityData.name),
                columns: { id: true },
            });
            if (existingName) {
                throw new ORPCError("CONFLICT", {
                    message: `A core product with name "${identityData.name}" already exists`,
                });
            }

            const existingSku = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.sku, identityData.sku),
                columns: { id: true },
            });
            if (existingSku) {
                throw new ORPCError("CONFLICT", {
                    message: `A core product with SKU "${identityData.sku}" already exists`,
                });
            }

            // Create identity
            const [created] = await db
                .insert(coreProductIdentity)
                .values({
                    ...identityData,
                    subCategoryId: identityData.subCategoryId || null,
                    defaultLooseUnit: identityData.defaultLooseUnit || null,
                })
                .returning();

            if (!created) {
                throw new ORPCError("INTERNAL_SERVER_ERROR", {
                    message: "Failed to create core product identity",
                });
            }

            // Link brands
            if (brandIds.length > 0) {
                await db.insert(coreProductBrand).values(
                    brandIds.map((brandId) => ({
                        coreProductId: created.id,
                        brandId,
                        isDefault: brandId === defaultBrandId,
                    })),
                );
            }

            // Create pack variant templates
            if (packVariants.length > 0) {
                await db.insert(coreProductPackVariant).values(
                    packVariants.map((pv, idx) => ({
                        coreProductId: created.id,
                        label: pv.label,
                        weightKg: pv.weightKg,
                        packType: pv.packType,
                        sellUnit: pv.sellUnit || null,
                        sortOrder: pv.sortOrder ?? idx,
                        isActive: pv.isActive ?? true,
                    })),
                );
            }

            return { message: "Core product created successfully", id: created.id };
        }),

    /**
     * Update a core product identity
     */
    update: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/core-products/update",
            tags: ["Admin Core Products"],
            summary: "Update core product",
            description: "Update core product identity, brands, and pack variants",
        })
        .input(updateCoreProductSchema)
        .handler(async ({ input }) => {
            const { id, brandIds, defaultBrandId, packVariants, ...updateData } = input;

            // Check existence
            const existing = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, id),
                columns: { id: true },
            });
            if (!existing) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Core product identity not found",
                });
            }

            // Check uniqueness for name (exclude self)
            const existingName = await db.query.coreProductIdentity.findFirst({
                where: and(
                    eq(coreProductIdentity.name, updateData.name),
                    sql`${coreProductIdentity.id} != ${id}`,
                ),
                columns: { id: true },
            });
            if (existingName) {
                throw new ORPCError("CONFLICT", {
                    message: `A core product with name "${updateData.name}" already exists`,
                });
            }

            // Update identity
            await db
                .update(coreProductIdentity)
                .set({
                    ...updateData,
                    subCategoryId: updateData.subCategoryId || null,
                    defaultLooseUnit: updateData.defaultLooseUnit || null,
                })
                .where(eq(coreProductIdentity.id, id));

            // Replace brands (delete all, re-insert)
            await db.delete(coreProductBrand).where(eq(coreProductBrand.coreProductId, id));
            if (brandIds.length > 0) {
                await db.insert(coreProductBrand).values(
                    brandIds.map((brandId) => ({
                        coreProductId: id,
                        brandId,
                        isDefault: brandId === defaultBrandId,
                    })),
                );
            }

            // Replace pack variants (delete all, re-insert)
            await db
                .delete(coreProductPackVariant)
                .where(eq(coreProductPackVariant.coreProductId, id));
            if (packVariants.length > 0) {
                await db.insert(coreProductPackVariant).values(
                    packVariants.map((pv, idx) => ({
                        coreProductId: id,
                        label: pv.label,
                        weightKg: pv.weightKg,
                        packType: pv.packType,
                        sellUnit: pv.sellUnit || null,
                        sortOrder: pv.sortOrder ?? idx,
                        isActive: pv.isActive ?? true,
                    })),
                );
            }

            return { message: "Core product updated successfully" };
        }),

    /**
     * Delete a core product identity
     */
    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/core-products/delete",
            tags: ["Admin Core Products"],
            summary: "Delete core product",
            description: "Delete a core product identity and all linked brands/variants",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const existing = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, input.id),
                columns: { id: true },
            });
            if (!existing) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Core product identity not found",
                });
            }

            // Cascade delete will handle brands and pack variants
            await db
                .delete(coreProductIdentity)
                .where(eq(coreProductIdentity.id, input.id));

            return { message: "Core product deleted successfully" };
        }),
};
