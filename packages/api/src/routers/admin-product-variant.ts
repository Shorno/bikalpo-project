import { db } from "@bikalpo-project/db";
import { productVariant, variantConversionMap } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";
import { eq } from "drizzle-orm";
import { z } from "zod";

const conversionRuleInput = z.object({
    fromVariantId: z.number().int(),
    toVariantId: z.number().int(),
    conversionRatio: z.string(),
    autoConvert: z.boolean().default(true),
});

export const adminProductVariantRouter = {
    getByProductId: adminProcedure
        .route({
            method: "POST",
            path: "/admin/product-variants/by-product",
            tags: ["Admin Product Variants"],
            summary: "Get variants by product",
            description: "Get all variants for a specific product",
        })
        .input(z.object({ productId: z.number().int() }))
        .handler(async ({ input }) => {
            return db.query.productVariant.findMany({
                where: eq(productVariant.productId, input.productId),
                orderBy: (v, { asc }) => [asc(v.sortOrder), asc(v.id)],
                with: { brand: { columns: { id: true, name: true, logo: true } } },
            });
        }),

    // === Conversion Rule Management ===

    listConversionRules: adminProcedure
        .route({
            method: "POST",
            path: "/admin/conversion-rules/list",
            tags: ["Admin Conversion Rules"],
            summary: "List conversion rules",
            description: "List all conversion rules, optionally filtered by variant",
        })
        .input(z.object({ fromVariantId: z.number().int().optional() }).optional())
        .handler(async ({ input }) => {
            if (input?.fromVariantId) {
                return db.query.variantConversionMap.findMany({
                    where: eq(variantConversionMap.fromVariantId, input.fromVariantId),
                    with: {
                        fromVariant: true,
                        toVariant: true,
                    },
                });
            }
            return db.query.variantConversionMap.findMany({
                with: {
                    fromVariant: true,
                    toVariant: true,
                },
            });
        }),

    createConversionRule: adminProcedure
        .route({
            method: "POST",
            path: "/admin/conversion-rules",
            tags: ["Admin Conversion Rules"],
            summary: "Create conversion rule",
            description: "Create a new TRADE → RETAIL conversion rule",
        })
        .input(conversionRuleInput)
        .handler(async ({ input }) => {
            const [created] = await db
                .insert(variantConversionMap)
                .values({
                    fromVariantId: input.fromVariantId,
                    toVariantId: input.toVariantId,
                    conversionRatio: input.conversionRatio,
                    autoConvert: input.autoConvert,
                })
                .returning();
            return created;
        }),

    updateConversionRule: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/conversion-rules/update",
            tags: ["Admin Conversion Rules"],
            summary: "Update conversion rule",
            description: "Update an existing conversion rule",
        })
        .input(conversionRuleInput.extend({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const { id, ...rest } = input;
            await db
                .update(variantConversionMap)
                .set(rest)
                .where(eq(variantConversionMap.id, id));
            return { message: "Conversion rule updated" };
        }),

    deleteConversionRule: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/conversion-rules/delete",
            tags: ["Admin Conversion Rules"],
            summary: "Delete conversion rule",
            description: "Delete a conversion rule",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            await db
                .delete(variantConversionMap)
                .where(eq(variantConversionMap.id, input.id));
            return { message: "Conversion rule deleted" };
        }),
};
