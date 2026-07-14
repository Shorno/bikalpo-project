import { and, asc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import {
    variantOption,
    productVariant,
    productVariantPrice,
    productType,
    category,
} from "@bikalpo-project/db/schema";
import { buildProductTypeFulfillmentProfile } from "@bikalpo-project/db/fulfillment";
import { formatVariantDefinition, VARIANT_CONTAINERS, variantDefinitionSignature, withDerivedOperationalUnit } from "@bikalpo-project/db/variant-definition";
import { adminProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";
import { resyncGeneratedVariantsForOption } from "./helpers/sync-generated-variants";

const commonUnits = z.string().min(1).max(20).trim();
const definitionSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("measurement"),
        value: z.string().min(1).max(20).trim(),
        measurementUnit: commonUnits,
        container: z.string().refine(
            (value) => Object.prototype.hasOwnProperty.call(VARIANT_CONTAINERS, value),
            "Select a supported container",
        ),
    }),
    z.object({ kind: z.literal("loose"), measurementUnit: commonUnits }),
    z.object({ kind: z.literal("attribute"), attribute: z.string().min(1).max(30).trim(), value: z.string().min(1).max(30).trim() }),
]);

const createInput = z.object({
    definition: definitionSchema,
    displayAlias: z.string().max(100).trim().optional(),
    typeId: z.number().int(),
    categoryId: z.number().int().nullable(),
    sortOrder: z.number().int().default(0),
});

const updateInput = createInput.extend({
    id: z.number().int(),
    isActive: z.boolean().default(true),
});

const filtersInput = z.object({
    search: z.string().optional(),
    typeId: z.number().int().optional(),
    categoryId: z.number().int().optional(),
    unit: z.string().optional(),
    variantType: z.enum(["all", "pack", "loose"]).default("all"),
    status: z.enum(["all", "active", "disabled"]).default("all"),
});

async function validateCategoryScope(typeId: number, categoryId: number | null) {
    if (categoryId === null) return;
    const scopedCategory = await db.query.category.findFirst({
        where: and(eq(category.id, categoryId), eq(category.typeId, typeId)),
        columns: { id: true },
    });
    if (!scopedCategory) {
        throw new ORPCError("BAD_REQUEST", {
            message: "The selected category does not belong to this product type",
        });
    }
}

export const adminVariantOptionRouter = {
    /**
     * List all variant options with type/category info.
     */
    getAll: adminProcedure
        .input(
            filtersInput.optional(),
        )
        .handler(async ({ input }) => {
            const filters: Partial<z.infer<typeof filtersInput>> = input ?? {};
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
            const usage = await Promise.all(options.map(async (option) => {
                const [priceRef, generatedRef] = await Promise.all([
                    db.query.productVariantPrice.findFirst({ where: eq(productVariantPrice.variantOptionId, option.id), columns: { id: true } }),
                    db.query.productVariant.findFirst({ where: eq(productVariant.sourceVariantOptionId, option.id), columns: { id: true } }),
                ]);
                return { ...option, structuralLocked: Boolean(priceRef || generatedRef) };
            }));
            return usage;
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
            const type = await db.query.productType.findFirst({ where: eq(productType.id, input.typeId) });
            if (!type) throw new ORPCError("BAD_REQUEST", { message: "Product type not found" });
            await validateCategoryScope(input.typeId, input.categoryId);
            const definition = withDerivedOperationalUnit(input.definition, buildProductTypeFulfillmentProfile(type).family);
            const name = formatVariantDefinition(definition);
            const signature = variantDefinitionSignature(definition);

            // Check uniqueness: name must be unique within same typeId + categoryId scope
            const existingConditions: SQL[] = [
                eq(variantOption.canonicalSignature, signature),
            ];

            existingConditions.push(eq(variantOption.typeId, input.typeId));

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
                    `The same structured variant already exists in this scope`,
                );
            }

            // Auto-generate next 2-digit skuCode scoped to typeId + categoryId
            const skuFilterCondition = input.categoryId === null
                    ? sql`${variantOption.typeId} = ${input.typeId} AND ${variantOption.categoryId} IS NULL`
                    : sql`${variantOption.typeId} = ${input.typeId} AND ${variantOption.categoryId} = ${input.categoryId}`;

            const skuCode = await nextSkuCode(variantOption, variantOption.skuCode, 2, skuFilterCondition);

            const [created] = await db
                .insert(variantOption)
                .values({
                    name,
                    unit: "measurementUnit" in definition ? definition.measurementUnit : definition.operationalUnit || "unit",
                    size: "value" in definition ? definition.value : null,
                    variantType: definition.kind === "loose" ? "loose" : "pack",
                    definitionKind: definition.kind,
                    definition,
                    displayAlias: input.displayAlias || null,
                    canonicalSignature: signature,
                    needsReview: false,
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
            const existing = await db.query.variantOption.findFirst({
                where: eq(variantOption.id, input.id),
            });

            if (!existing) throw new Error("Variant option not found");

            const type = await db.query.productType.findFirst({ where: eq(productType.id, input.typeId) });
            if (!type) throw new ORPCError("BAD_REQUEST", { message: "Product type not found" });
            await validateCategoryScope(input.typeId, input.categoryId);
            const definition = withDerivedOperationalUnit(input.definition, buildProductTypeFulfillmentProfile(type).family);
            const name = formatVariantDefinition(definition);
            const signature = variantDefinitionSignature(definition);
            const [priceRef, generatedRef] = await Promise.all([
                db.query.productVariantPrice.findFirst({ where: eq(productVariantPrice.variantOptionId, input.id), columns: { id: true } }),
                db.query.productVariant.findFirst({ where: eq(productVariant.sourceVariantOptionId, input.id), columns: { id: true } }),
            ]);
            const structuralLocked = Boolean(priceRef || generatedRef);
            const isLegacyUpgrade =
                existing.needsReview &&
                existing.canonicalSignature === null;
            if (structuralLocked && !isLegacyUpgrade && (existing.canonicalSignature !== signature || existing.typeId !== input.typeId || existing.categoryId !== input.categoryId)) {
                throw new ORPCError("BAD_REQUEST", { message: "This variant is already in use. Clone it to change its structure or scope." });
            }

            // Check uniqueness (exclude self)
            const dupConditions: SQL[] = [
                eq(variantOption.canonicalSignature, signature),
                sql`${variantOption.id} != ${input.id}`,
            ];

            dupConditions.push(eq(variantOption.typeId, input.typeId));

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
                    `The same structured variant already exists in this scope`,
                );
            }

            await db.transaction(async (tx) => {
                const [updated] = await tx
                    .update(variantOption)
                    .set({
                    name,
                    unit: "measurementUnit" in definition ? definition.measurementUnit : definition.operationalUnit || "unit",
                    size: "value" in definition ? definition.value : null,
                    variantType: definition.kind === "loose" ? "loose" : "pack",
                    definitionKind: definition.kind,
                    definition,
                    displayAlias: input.displayAlias || null,
                    canonicalSignature: signature,
                    needsReview: false,
                    typeId: input.typeId,
                    categoryId: input.categoryId,
                    isActive: input.isActive,
                    sortOrder: input.sortOrder,
                    updatedAt: new Date(),
                    })
                    .where(eq(variantOption.id, input.id))
                    .returning();
                if (!updated) {
                    throw new ORPCError("NOT_FOUND", { message: "Variant option not found" });
                }
                await resyncGeneratedVariantsForOption(tx, updated);
            });

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

            const [priceRef, generatedRef] = await Promise.all([
                db.query.productVariantPrice.findFirst({ where: eq(productVariantPrice.variantOptionId, input.id), columns: { id: true } }),
                db.query.productVariant.findFirst({ where: eq(productVariant.sourceVariantOptionId, input.id), columns: { id: true } }),
            ]);
            if (priceRef || generatedRef) {
                throw new ORPCError("BAD_REQUEST", { message: "This variant is in use and cannot be deleted. Disable it instead." });
            }

            await db.delete(variantOption).where(eq(variantOption.id, input.id));

            return { message: "Variant option deleted successfully" };
        }),
};
