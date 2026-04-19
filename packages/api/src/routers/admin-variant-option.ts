import { and, asc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import {
    variantOption,
    category,
    productType,
} from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";

const UNITS = [
    "KG", "ML", "L", "Pc", "Size", "Box", "Carton", "Ton", "Pair", "Unit",
] as const;

const createInput = z.object({
    name: z.string().min(1).max(100).trim(),
    unit: z.string().min(1).max(20),
    size: z.string().max(20).optional(),
    variantType: z.enum(["pack", "loose"]).default("pack"),
    typeId: z.number().int().nullable(),
    categoryId: z.number().int().nullable(),
    sortOrder: z.number().int().default(0),
});

const updateInput = createInput.extend({
    id: z.number().int(),
    isActive: z.boolean().default(true),
});

export const adminVariantOptionRouter = {
    /**
     * List all variant options with type/category info.
     */
    getAll: adminProcedure
        .input(
            z.object({
                search: z.string().optional(),
                typeId: z.number().int().optional(),
                categoryId: z.number().int().optional(),
                unit: z.string().optional(),
                variantType: z.enum(["all", "pack", "loose"]).default("all"),
                status: z.enum(["all", "active", "disabled"]).default("all"),
            }).optional(),
        )
        .handler(async ({ input }) => {
            const filters = input ?? {};
            const conditions: SQL[] = [];

            // Search filter
            if (filters.search?.trim()) {
                conditions.push(ilike(variantOption.name, `%${filters.search.trim()}%`));
            }

            // Type filter: "global" is handled as typeId === null
            if (filters.typeId !== undefined) {
                conditions.push(eq(variantOption.typeId, filters.typeId));
            }

            // Category filter
            if (filters.categoryId !== undefined) {
                conditions.push(eq(variantOption.categoryId, filters.categoryId));
            }

            // Unit filter
            if (filters.unit) {
                conditions.push(eq(variantOption.unit, filters.unit));
            }

            // Variant type filter
            if (filters.variantType && filters.variantType !== "all") {
                conditions.push(eq(variantOption.variantType, filters.variantType));
            }

            // Status filter
            if (filters.status === "active") {
                conditions.push(eq(variantOption.isActive, true));
            } else if (filters.status === "disabled") {
                conditions.push(eq(variantOption.isActive, false));
            }

            const options = await db.query.variantOption.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    type: { columns: { id: true, name: true } },
                    category: { columns: { id: true, name: true } },
                },
                orderBy: [asc(variantOption.sortOrder), asc(variantOption.name)],
            });

            return options;
        }),

    /**
     * Get all global variant options (typeId=null) — used for pickers.
     */
    getGlobal: adminProcedure.handler(async () => {
        return db.query.variantOption.findMany({
            where: and(
                isNull(variantOption.typeId),
                eq(variantOption.isActive, true),
            ),
            orderBy: [asc(variantOption.sortOrder), asc(variantOption.name)],
        });
    }),

    /**
     * Get a single variant option by ID.
     */
    getById: adminProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const option = await db.query.variantOption.findFirst({
                where: eq(variantOption.id, input.id),
                with: {
                    type: { columns: { id: true, name: true } },
                    category: { columns: { id: true, name: true } },
                },
            });

            if (!option) throw new Error("Variant option not found");

            return {
                variantOption: option,
            };
        }),

    /**
     * Create a new variant option.
     */
    create: adminProcedure
        .input(createInput)
        .handler(async ({ input }) => {
            // Validate: if typeId is null (Global), categoryId must also be null
            if (input.typeId === null && input.categoryId !== null) {
                throw new Error("Global variants cannot have a category scope");
            }

            // Check uniqueness: name must be unique within same typeId + categoryId scope
            const existingConditions: SQL[] = [
                eq(variantOption.name, input.name),
            ];

            if (input.typeId === null) {
                existingConditions.push(isNull(variantOption.typeId));
            } else {
                existingConditions.push(eq(variantOption.typeId, input.typeId));
            }

            if (input.categoryId === null) {
                existingConditions.push(isNull(variantOption.categoryId));
            } else {
                existingConditions.push(eq(variantOption.categoryId, input.categoryId));
            }

            const existing = await db.query.variantOption.findFirst({
                where: and(...existingConditions),
            });

            if (existing) {
                throw new Error(
                    `A variant option named "${input.name}" already exists in this scope`,
                );
            }

            // Auto-generate next 2-digit skuCode scoped to typeId + categoryId
            const skuFilterCondition = input.typeId === null
                ? (input.categoryId === null
                    ? sql`${variantOption.typeId} IS NULL AND ${variantOption.categoryId} IS NULL`
                    : sql`${variantOption.typeId} IS NULL AND ${variantOption.categoryId} = ${input.categoryId}`)
                : (input.categoryId === null
                    ? sql`${variantOption.typeId} = ${input.typeId} AND ${variantOption.categoryId} IS NULL`
                    : sql`${variantOption.typeId} = ${input.typeId} AND ${variantOption.categoryId} = ${input.categoryId}`);

            const skuCode = await nextSkuCode(variantOption, variantOption.skuCode, 2, skuFilterCondition);

            const [created] = await db
                .insert(variantOption)
                .values({
                    name: input.name,
                    unit: input.unit,
                    size: input.size || null,
                    variantType: input.variantType,
                    typeId: input.typeId,
                    categoryId: input.categoryId,
                    sortOrder: input.sortOrder,
                    skuCode,
                })
                .returning();

            return created;
        }),

    /**
     * Update an existing variant option.
     */
    update: adminProcedure
        .input(updateInput)
        .handler(async ({ input }) => {
            // Validate: if typeId is null (Global), categoryId must also be null
            if (input.typeId === null && input.categoryId !== null) {
                throw new Error("Global variants cannot have a category scope");
            }

            const existing = await db.query.variantOption.findFirst({
                where: eq(variantOption.id, input.id),
            });

            if (!existing) throw new Error("Variant option not found");

            // Check uniqueness (exclude self)
            const dupConditions: SQL[] = [
                eq(variantOption.name, input.name),
                sql`${variantOption.id} != ${input.id}`,
            ];

            if (input.typeId === null) {
                dupConditions.push(isNull(variantOption.typeId));
            } else {
                dupConditions.push(eq(variantOption.typeId, input.typeId));
            }

            if (input.categoryId === null) {
                dupConditions.push(isNull(variantOption.categoryId));
            } else {
                dupConditions.push(eq(variantOption.categoryId, input.categoryId));
            }

            const duplicate = await db.query.variantOption.findFirst({
                where: and(...dupConditions),
            });

            if (duplicate) {
                throw new Error(
                    `A variant option named "${input.name}" already exists in this scope`,
                );
            }

            await db
                .update(variantOption)
                .set({
                    name: input.name,
                    unit: input.unit,
                    size: input.size || null,
                    variantType: input.variantType,
                    typeId: input.typeId,
                    categoryId: input.categoryId,
                    isActive: input.isActive,
                    sortOrder: input.sortOrder,
                    updatedAt: new Date(),
                })
                .where(eq(variantOption.id, input.id));

            return { message: "Variant option updated successfully" };
        }),

    /**
     * Delete a variant option.
     */
    delete: adminProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const existing = await db.query.variantOption.findFirst({
                where: eq(variantOption.id, input.id),
            });

            if (!existing) throw new Error("Variant option not found");

            await db.delete(variantOption).where(eq(variantOption.id, input.id));

            return { message: "Variant option deleted successfully" };
        }),
};
