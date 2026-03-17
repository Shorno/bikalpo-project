import { db } from "@bikalpo-project/db";
import { productType } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";

export const adminProductTypeRouter = {
    // List all product types
    getAll: adminProcedure
        .input(
            z.object({
                search: z.string().optional(),
            }),
        )
        .handler(async ({ input }) => {
            const conditions: SQL[] = [];
            if (input.search) {
                conditions.push(ilike(productType.name, `%${input.search}%`));
            }

            const types = await db.query.productType.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                orderBy: [asc(productType.displayOrder), asc(productType.name)],
            });

            return { types };
        }),

    // Get single product type by ID
    getById: adminProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const type = await db.query.productType.findFirst({
                where: eq(productType.id, input.id),
                with: { categories: true },
            });

            if (!type) {
                throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
            }

            return { type };
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
                    displayOrder: input.displayOrder,
                })
                .returning();

            return { type: created };
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

            return { type: updated };
        }),

    // Delete a product type
    delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const [deleted] = await db
                .delete(productType)
                .where(eq(productType.id, input.id))
                .returning();

            if (!deleted) {
                throw new ORPCError("NOT_FOUND", { message: "Product type not found" });
            }

            return { success: true };
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
