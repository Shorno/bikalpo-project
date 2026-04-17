import { db } from "@bikalpo-project/db";
import {
    coreProductIdentity,
    coreProductBrand,
    variantOption,
    coreProductVariantOption,
    subCategory,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "../index";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { nextSkuCode } from "./helpers/generate-sku";

// === Input Schemas ===



const createCoreProductSchema = z.object({
    sku: z.string().optional(), // Now auto-generated if not provided
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional(),
    image: z.string().min(1),
    categoryId: z.number().int(),
    subCategoryId: z.number().int().optional().nullable(),
    brandSupport: z.enum(["multi_brand", "single_brand"]).default("multi_brand"),
    status: z.enum(["active", "draft", "inactive"]).default("active"),
    displayOrder: z.number().int().default(0),
    // Linked brands
    brandIds: z.array(z.number().int()).default([]),
    defaultBrandId: z.number().int().optional(),
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
                        columns: { id: true, name: true, slug: true, typeId: true, skuCode: true },
                        with: {
                            type: { columns: { id: true, name: true, skuCode: true } },
                        },
                    },
                    subCategory: {
                        columns: { id: true, name: true, skuCode: true },
                    },
                    brands: {
                        with: {
                            brand: {
                                columns: { id: true, name: true, logo: true },
                            },
                        },
                    },
                },
            });

            // Compose full hierarchical SKU for each core product
            const coreProducts = results.map((cp) => {
                const typeCode = cp.category?.type?.skuCode || "??";
                const catCode = cp.category?.skuCode || "???";
                const subCatCode = cp.subCategory?.skuCode || "???";
                const coreCode = cp.sku || "???";
                const composedSku = `${typeCode}-${catCode}-${subCatCode}-${coreCode}`;
                return { ...cp, composedSku };
            });

            return { coreProducts };
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
                    variantLinks: {
                        with: {
                            variantOption: {
                                with: {
                                    type: { columns: { id: true, name: true } },
                                    category: { columns: { id: true, name: true } },
                                },
                            },
                        },
                        orderBy: (vl, { asc }) => [asc(vl.sortOrder)],
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
            const { brandIds, defaultBrandId, ...identityData } = input;

            // Check uniqueness for name
            const existingName = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.name, identityData.name),
                columns: { id: true },
            });
            if (existingName) {
                throw new ORPCError("CONFLICT", {
                    message: `A core product with name "${identityData.name}" already exists`,
                });
            }

            // Auto-generate 3-digit SKU scoped to subCategoryId (or categoryId if no subCat)
            let sku = identityData.sku;
            if (!sku) {
                const filterCondition = identityData.subCategoryId
                    ? sql`${coreProductIdentity.subCategoryId} = ${identityData.subCategoryId}`
                    : sql`${coreProductIdentity.categoryId} = ${identityData.categoryId} AND ${coreProductIdentity.subCategoryId} IS NULL`;
                sku = await nextSkuCode(coreProductIdentity, coreProductIdentity.sku, 3, filterCondition);
            }

            // Check uniqueness for SKU within the same scope
            const scopeCondition = identityData.subCategoryId
                ? and(eq(coreProductIdentity.sku, sku), eq(coreProductIdentity.subCategoryId, identityData.subCategoryId))
                : and(eq(coreProductIdentity.sku, sku), eq(coreProductIdentity.categoryId, identityData.categoryId));
            const existingSku = await db.query.coreProductIdentity.findFirst({
                where: scopeCondition,
                columns: { id: true },
            });
            if (existingSku) {
                throw new ORPCError("CONFLICT", {
                    message: `A core product with SKU "${sku}" already exists in this category`,
                });
            }

            // Create identity
            const [created] = await db
                .insert(coreProductIdentity)
                .values({
                    ...identityData,
                    sku,
                    subCategoryId: identityData.subCategoryId || null,
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
            const { id, brandIds, defaultBrandId, ...updateData } = input;

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

    /**
     * Get eligible variant options for a core product (scoped by type + category).
     * Returns variants that are: Global, matching type, or matching type+category.
     * Excludes variants already linked to this core product.
     */
    getEligibleVariants: adminProcedure
        .input(z.object({
            coreProductId: z.number().int(),
        }))
        .handler(async ({ input }) => {
            // Get the core product to know its category (and derive typeId)
            const cp = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, input.coreProductId),
                columns: { id: true, categoryId: true },
                with: {
                    category: { columns: { id: true, typeId: true } },
                },
            });

            if (!cp) throw new Error("Core product not found");

            const typeId = cp.category.typeId;
            const categoryId = cp.categoryId;

            // Build scope filter: Global OR Type-scoped OR Category-scoped
            const scopeConditions: SQL[] = [
                // Global: typeId=null AND categoryId=null
                and(isNull(variantOption.typeId), isNull(variantOption.categoryId))!,
            ];

            if (typeId) {
                // Type-scoped: typeId=X AND categoryId=null
                scopeConditions.push(
                    and(eq(variantOption.typeId, typeId), isNull(variantOption.categoryId))!,
                );
                // Category-scoped: typeId=X AND categoryId=Y
                scopeConditions.push(
                    and(eq(variantOption.typeId, typeId), eq(variantOption.categoryId, categoryId))!,
                );
            }

            // Get already linked variant IDs
            const linkedRows = await db
                .select({ variantOptionId: coreProductVariantOption.variantOptionId })
                .from(coreProductVariantOption)
                .where(eq(coreProductVariantOption.coreProductId, input.coreProductId));

            const linkedIds = new Set(linkedRows.map((r) => r.variantOptionId));

            // Fetch eligible variants
            const eligible = await db.query.variantOption.findMany({
                where: and(
                    or(...scopeConditions),
                    eq(variantOption.isActive, true),
                ),
                with: {
                    type: { columns: { id: true, name: true } },
                    category: { columns: { id: true, name: true } },
                },
                orderBy: [asc(variantOption.sortOrder), asc(variantOption.name)],
            });

            // Filter out already linked
            return eligible.filter((v) => !linkedIds.has(v.id));
        }),

    /**
     * Link a variant option to a core product.
     */
    linkVariant: adminProcedure
        .input(z.object({
            coreProductId: z.number().int(),
            variantOptionId: z.number().int(),
        }))
        .handler(async ({ input }) => {
            // Check if already linked
            const existing = await db.query.coreProductVariantOption.findFirst({
                where: and(
                    eq(coreProductVariantOption.coreProductId, input.coreProductId),
                    eq(coreProductVariantOption.variantOptionId, input.variantOptionId),
                ),
            });

            if (existing) {
                throw new Error("This variant is already linked to this core product");
            }

            // Get next sort order
            const lastLink = await db.query.coreProductVariantOption.findFirst({
                where: eq(coreProductVariantOption.coreProductId, input.coreProductId),
                orderBy: (vl, { desc }) => [desc(vl.sortOrder)],
            });

            await db.insert(coreProductVariantOption).values({
                coreProductId: input.coreProductId,
                variantOptionId: input.variantOptionId,
                sortOrder: (lastLink?.sortOrder ?? -1) + 1,
            });

            return { message: "Variant linked successfully" };
        }),

    /**
     * Unlink a variant option from a core product.
     */
    unlinkVariant: adminProcedure
        .input(z.object({
            coreProductId: z.number().int(),
            variantOptionId: z.number().int(),
        }))
        .handler(async ({ input }) => {
            await db
                .delete(coreProductVariantOption)
                .where(
                    and(
                        eq(coreProductVariantOption.coreProductId, input.coreProductId),
                        eq(coreProductVariantOption.variantOptionId, input.variantOptionId),
                    ),
                );

            return { message: "Variant unlinked successfully" };
        }),
};
