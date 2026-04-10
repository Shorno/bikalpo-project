import { db } from "@bikalpo-project/db";
import { category, product, productType } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq, ilike, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";

export const adminProductTypeRouter = {
    // List all product types with optional status filter
    getAll: adminProcedure
        .input(
            z.object({
                search: z.string().optional(),
                status: z.enum(["all", "active", "inactive"]).optional().default("all"),
            }),
        )
        .handler(async ({ input }) => {
            const conditions: SQL[] = [];
            if (input.search) {
                conditions.push(ilike(productType.name, `%${input.search}%`));
            }
            if (input.status === "active") {
                conditions.push(eq(productType.isActive, true));
            } else if (input.status === "inactive") {
                conditions.push(eq(productType.isActive, false));
            }

            const types = await db.query.productType.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                orderBy: [asc(productType.displayOrder), asc(productType.name)],
                with: { categories: { columns: { id: true } } },
            });

            return {
                types: types.map(({ categories: cats, ...rest }) => ({
                    ...rest,
                    categoryCount: cats.length,
                })),
            };
        }),

    // Get single product type by ID with related data
    getById: adminProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const type = await db.query.productType.findFirst({
                where: eq(productType.id, input.id),
                with: {
                    categories: {
                        columns: { id: true, name: true, slug: true, isActive: true, image: true },
                        orderBy: [asc(category.displayOrder), asc(category.name)],
                    },
                },
            });

            if (!type) {
                throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
            }

            // Get products under this type via categories
            const categoryIds = type.categories.map((c) => c.id);
            let products: { id: number; name: string; slug: string; image: string; size: string; price: string; status: string; categoryId: number }[] = [];
            if (categoryIds.length > 0) {
                products = await db
                    .select({
                        id: product.id,
                        name: product.name,
                        slug: product.slug,
                        image: product.image,
                        size: product.size,
                        price: product.price,
                        status: product.status,
                        categoryId: product.categoryId,
                    })
                    .from(product)
                    .where(inArray(product.categoryId, categoryIds))
                    .orderBy(asc(product.name));
            }

            return { type, products };
        }),

    // Create a new product type
    create: adminProcedure
        .input(
            z.object({
                name: z.string().min(1),
                slug: z.string().min(1),
                description: z.string().optional(),
                image: z.string().optional(),
                enableBrand: z.boolean().default(true),
                enableColor: z.boolean().default(false),
                enableSize: z.boolean().default(true),
                enableDesign: z.boolean().default(false),
                enableVariant: z.boolean().default(true),
                inventoryBehaviour: z.enum(["auto_break", "loose_convert", "fixed_pack"]).default("fixed_pack"),
                isActive: z.boolean().default(true),
                displayOrder: z.number().default(0),
            }),
        )
        .handler(async ({ input }) => {
            // Check for unique slug
            const existing = await db.query.productType.findFirst({
                where: eq(productType.slug, input.slug),
            });
            if (existing) {
                throw new ORPCError("CONFLICT", { message: "A type with this slug already exists" });
            }

            const [created] = await db
                .insert(productType)
                .values({
                    name: input.name,
                    slug: input.slug,
                    description: input.description || null,
                    image: input.image || null,
                    enableBrand: input.enableBrand,
                    enableColor: input.enableColor,
                    enableSize: input.enableSize,
                    enableDesign: input.enableDesign,
                    enableVariant: input.enableVariant,
                    inventoryBehaviour: input.inventoryBehaviour,
                    isActive: input.isActive,
                    displayOrder: input.displayOrder,
                })
                .returning();

            return { type: created, message: `Product type "${created!.name}" created successfully` };
        }),

    // Update a product type
    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().min(1),
                slug: z.string().min(1),
                description: z.string().optional(),
                image: z.string().optional(),
                enableBrand: z.boolean(),
                enableColor: z.boolean(),
                enableSize: z.boolean(),
                enableDesign: z.boolean(),
                enableVariant: z.boolean(),
                inventoryBehaviour: z.enum(["auto_break", "loose_convert", "fixed_pack"]),
                isActive: z.boolean().optional(),
                displayOrder: z.number().optional(),
            }),
        )
        .handler(async ({ input }) => {
            const { id, ...data } = input;

            const [updated] = await db
                .update(productType)
                .set({
                    name: data.name,
                    slug: data.slug,
                    description: data.description || null,
                    image: data.image || null,
                    enableBrand: data.enableBrand,
                    enableColor: data.enableColor,
                    enableSize: data.enableSize,
                    enableDesign: data.enableDesign,
                    enableVariant: data.enableVariant,
                    inventoryBehaviour: data.inventoryBehaviour,
                    isActive: data.isActive,
                    displayOrder: data.displayOrder,
                })
                .where(eq(productType.id, id))
                .returning();

            if (!updated) {
                throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
            }

            return { type: updated, message: `Product type "${updated.name}" updated successfully` };
        }),

    // Toggle active status
    toggleActive: adminProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const existing = await db.query.productType.findFirst({
                where: eq(productType.id, input.id),
            });
            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
            }

            const [updated] = await db
                .update(productType)
                .set({ isActive: !existing.isActive })
                .where(eq(productType.id, input.id))
                .returning();

            return {
                type: updated,
                message: `Product type "${updated!.name}" ${updated!.isActive ? "activated" : "deactivated"} successfully`,
            };
        }),

    // Delete a product type (with protection)
    delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            // Check if categories exist under this type
            const categoryCount = await db
                .select({ count: count() })
                .from(category)
                .where(eq(category.typeId, input.id));

            if ((categoryCount[0]?.count ?? 0) > 0) {
                throw new ORPCError("CONFLICT", {
                    message: `Cannot delete this type — it has ${categoryCount[0]!.count} categories. Remove or reassign them first.`,
                });
            }

            const [deleted] = await db
                .delete(productType)
                .where(eq(productType.id, input.id))
                .returning();

            if (!deleted) {
                throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
            }

            return { success: true, message: `Product type "${deleted.name}" deleted successfully` };
        }),

    // Public: get active types (for dropdowns)
    getActiveTypes: publicProcedure
        .handler(async () => {
            const types = await db.query.productType.findMany({
                where: eq(productType.isActive, true),
                orderBy: [asc(productType.displayOrder), asc(productType.name)],
                columns: {
                    id: true,
                    name: true,
                    slug: true,
                    enableBrand: true,
                    enableColor: true,
                    enableSize: true,
                    enableDesign: true,
                    enableVariant: true,
                    inventoryBehaviour: true,
                },
            });

            return { types };
        }),
};
