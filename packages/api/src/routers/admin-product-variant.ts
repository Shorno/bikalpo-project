import { db } from "@bikalpo-project/db";
import { product, productVariant, variantConversionMap } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { adminProcedure } from "../index";
import { generateSku } from "./helpers/generate-sku";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

/**
 * After any variant change, sync the parent product's price/stock/size
 * from its variants: price = MIN, stockQuantity = SUM, size = descriptive.
 */
async function syncProductFromVariants(productId: number) {
    console.log("🔄 syncProductFromVariants called for productId:", productId);
    const variants = await db.query.productVariant.findMany({
        where: eq(productVariant.productId, productId),
        columns: { price: true, stockQuantity: true, weightKg: true, unitLabel: true },
    });
    console.log("🔄 Found variants:", JSON.stringify(variants));

    if (variants.length === 0) {
        await db.update(product).set({ price: "0", stockQuantity: 0, size: "\u2014" }).where(eq(product.id, productId));
        return;
    }

    const prices = variants.map((v) => parseFloat(v.price)).filter((p) => !isNaN(p) && p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices).toFixed(2) : "0";
    const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0);
    const sizeStr = variants.map((v) => v.unitLabel || `${v.weightKg}kg`).join(", ");

    console.log("🔄 Syncing product:", { minPrice, totalStock, sizeStr });
    await db
        .update(product)
        .set({
            price: minPrice,
            stockQuantity: totalStock,
            size: sizeStr.slice(0, 50),
        })
        .where(eq(product.id, productId));
    console.log("🔄 Sync complete for productId:", productId);
}

const quantitySelectorOptionSchema = z.object({
    value: z.number(),
    unit: z.string(),
    label: z.string().optional(),
});

const bulkRateTierSchema = z.object({
    minKg: z.number().optional(),
    maxKg: z.number().optional(),
    pricePerKg: z.string().optional(),
    priceTotal: z.string().optional(),
});

const variantInput = z.object({
    productId: z.number().int(),
    sku: z.string().optional(),
    unitLabel: z.string(),
    quantitySelectorLabel: z.string().optional(),
    packagingType: z.string(),
    weightKg: z.string(),
    pieceWeightKg: z.string().optional(),
    piecesPerUnit: z.number().int().optional(),
    pricingType: z.string().optional(),
    price: z.string(),
    orderMin: z.string().optional(),
    orderMax: z.string().optional(),
    orderIncrement: z.string().optional(),
    orderUnit: z.string().optional(),
    quantitySelectorOptions: z.array(quantitySelectorOptionSchema).optional(),
    priceTiers: z.array(bulkRateTierSchema).optional(),
    stockQuantity: z.number().int().optional(),
    reorderLevel: z.number().int().optional(),
    origin: z.string().optional(),
    shelfLife: z.string().optional(),
    packagingNote: z.string().optional(),
    care: z.string().optional(),
    note: z.string().optional(),
    sortOrder: z.number().int().optional(),

    // === Variant-Level Identity ===
    brandId: z.number().int().optional(),

    // === B2B + B2C Fields ===
    variantType: z.enum(["trade", "retail"]).optional(),
    packType: z.enum(["sack", "carton", "packet", "loose", "bottle", "can", "jar", "pouch", "box"]).optional(),
    packWeightKg: z.string().optional(),
    innerPackSizeKg: z.string().optional(),
    packCountInside: z.number().int().optional(),
    sellUnit: z.string().optional(),
    orderType: z.enum(["b2b", "b2c"]).optional(),
    visibilityRole: z.enum(["shop_owner", "consumer", "all"]).optional(),
    stockSource: z.string().optional(),
    deliveryType: z.string().optional(),
    deliveryRuleId: z.number().int().optional(),
    linkedRetailVariantId: z.number().int().optional(),
    conversionRatio: z.string().optional(),
    conversionLossPercent: z.string().optional(),
    isOpenOrderAllowed: z.boolean().optional(),
    negotiationTimeoutSec: z.number().int().optional(),
    isPackReturnRequired: z.boolean().optional(),
    packDepositAmount: z.string().optional(),
    minMarginPercent: z.string().optional(),
    minMarginAmount: z.string().optional(),
    isActive: z.boolean().optional(),
});

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

    create: adminProcedure
        .route({
            method: "POST",
            path: "/admin/product-variants",
            tags: ["Admin Product Variants"],
            summary: "Create variant",
            description: "Create a new product variant",
        })
        .input(variantInput)
        .handler(async ({ context, input }) => {
            // Enforce: a product can't mix trade (B2B) and retail (B2C) variants
            if (input.variantType) {
                const existing = await db.query.productVariant.findFirst({
                    where: eq(productVariant.productId, input.productId),
                    columns: { variantType: true },
                });
                if (existing?.variantType && existing.variantType !== input.variantType) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `This product already has ${existing.variantType === "trade" ? "Trade (B2B)" : "Retail (B2C)"} variants. A product cannot mix B2B and B2C variants.`,
                    });
                }
            }

            // Trade (warehouse/B2B) variants: admin cannot set price — force to "0"
            if (input.variantType === "trade") {
                input.price = "0";
            }

            // Auto-generate SKU if not provided
            let sku = input.sku?.trim() || null;
            if (!sku) {
                const parentProduct = await db.query.product.findFirst({
                    where: eq(product.id, input.productId),
                    columns: { categoryId: true, subCategoryId: true },
                    with: {
                        category: { columns: { slug: true } },
                        subCategory: { columns: { slug: true } },
                    },
                });
                // Count existing variants for serial
                const [countResult] = await db
                    .select({ count: sql<number>`count(*)::int` })
                    .from(productVariant)
                    .where(eq(productVariant.productId, input.productId));
                const serial = (countResult?.count ?? 0) + 1;

                sku = generateSku({
                    subCategorySlug: (parentProduct as any)?.subCategory?.slug || "xx",
                    categorySlug: (parentProduct as any)?.category?.slug || "xx",
                    serialNumber: serial,
                    sizeId: Math.round(parseFloat(input.weightKg || "0") * 10),
                    userId: context.session.user.id,
                });
            }

            const [created] = await db
                .insert(productVariant)
                .values({
                    productId: input.productId,
                    sku: sku,
                    unitLabel: input.unitLabel,
                    quantitySelectorLabel: input.quantitySelectorLabel ?? null,
                    packagingType: input.packagingType,
                    weightKg: input.weightKg,
                    pieceWeightKg: input.pieceWeightKg ?? null,
                    piecesPerUnit: input.piecesPerUnit ?? null,
                    pricingType: input.pricingType ?? "per_unit",
                    price: input.price,
                    orderMin: input.orderMin ?? "1",
                    orderMax: input.orderMax ?? null,
                    orderIncrement: input.orderIncrement ?? "1",
                    orderUnit: input.orderUnit ?? "piece",
                    quantitySelectorOptions: input.quantitySelectorOptions ?? [],
                    priceTiers: input.priceTiers ?? [],
                    stockQuantity: input.stockQuantity ?? 0,
                    reorderLevel: input.reorderLevel ?? 0,
                    origin: input.origin ?? null,
                    shelfLife: input.shelfLife ?? null,
                    packagingNote: input.packagingNote ?? null,
                    care: input.care ?? null,
                    note: input.note ?? null,
                    sortOrder: input.sortOrder ?? 0,
                    // Variant-level identity
                    brandId: input.brandId ?? null,
                    // B2B + B2C fields
                    variantType: input.variantType ?? null,
                    packType: input.packType ?? null,
                    packWeightKg: input.packWeightKg ?? null,
                    innerPackSizeKg: input.innerPackSizeKg ?? null,
                    packCountInside: input.packCountInside ?? null,
                    sellUnit: input.sellUnit ?? null,
                    orderType: input.orderType ?? null,
                    visibilityRole: input.visibilityRole ?? "all",
                    stockSource: input.stockSource ?? null,
                    deliveryType: input.deliveryType ?? null,
                    deliveryRuleId: input.deliveryRuleId ?? null,
                    linkedRetailVariantId: input.linkedRetailVariantId ?? null,
                    conversionRatio: input.conversionRatio ?? null,
                    conversionLossPercent: input.conversionLossPercent ?? "0",
                    isOpenOrderAllowed: input.isOpenOrderAllowed ?? false,
                    negotiationTimeoutSec: input.negotiationTimeoutSec ?? 100,
                    isPackReturnRequired: input.isPackReturnRequired ?? false,
                    packDepositAmount: input.packDepositAmount ?? "0",
                    minMarginPercent: input.minMarginPercent ?? null,
                    minMarginAmount: input.minMarginAmount ?? null,
                    isActive: input.isActive ?? true,
                })
                .returning();

            // Auto-sync product price/stock from variants
            await syncProductFromVariants(input.productId);

            return created;
        }),

    update: adminProcedure
        .route({
            method: "PUT",
            path: "/admin/product-variants/update",
            tags: ["Admin Product Variants"],
            summary: "Update variant",
            description: "Update an existing product variant",
        })
        .input(variantInput.omit({ productId: true }).extend({ id: z.number().int() }))
        .handler(async ({ input }) => {
            // Enforce: a product can't mix trade (B2B) and retail (B2C) variants
            if (input.variantType) {
                const thisVariant = await db.query.productVariant.findFirst({
                    where: eq(productVariant.id, input.id),
                    columns: { productId: true },
                });
                if (thisVariant) {
                    const sibling = await db.query.productVariant.findFirst({
                        where: and(
                            eq(productVariant.productId, thisVariant.productId),
                            ne(productVariant.id, input.id),
                        ),
                        columns: { variantType: true },
                    });
                    if (sibling?.variantType && sibling.variantType !== input.variantType) {
                        throw new ORPCError("BAD_REQUEST", {
                            message: `This product already has ${sibling.variantType === "trade" ? "Trade (B2B)" : "Retail (B2C)"} variants. A product cannot mix B2B and B2C variants.`,
                        });
                    }
                }
            }

            // Trade (warehouse/B2B) variants: admin cannot set price — force to "0"
            if (input.variantType === "trade") {
                input.price = "0";
            }

            const { id, ...rest } = input;
            await db
                .update(productVariant)
                .set({
                    ...rest,
                    quantitySelectorLabel: rest.quantitySelectorLabel ?? null,
                    priceTiers: rest.priceTiers ?? [],
                    pieceWeightKg: rest.pieceWeightKg ?? null,
                    piecesPerUnit: rest.piecesPerUnit ?? null,
                    orderMax: rest.orderMax ?? null,
                    origin: rest.origin ?? null,
                    shelfLife: rest.shelfLife ?? null,
                    packagingNote: rest.packagingNote ?? null,
                    care: rest.care ?? null,
                    note: rest.note ?? null,
                    // Variant-level identity
                    brandId: rest.brandId ?? null,
                    // B2B + B2C fields
                    variantType: rest.variantType ?? null,
                    packType: rest.packType ?? null,
                    packWeightKg: rest.packWeightKg ?? null,
                    innerPackSizeKg: rest.innerPackSizeKg ?? null,
                    packCountInside: rest.packCountInside ?? null,
                    sellUnit: rest.sellUnit ?? null,
                    orderType: rest.orderType ?? null,
                    visibilityRole: rest.visibilityRole ?? "all",
                    stockSource: rest.stockSource ?? null,
                    deliveryType: rest.deliveryType ?? null,
                    deliveryRuleId: rest.deliveryRuleId ?? null,
                    linkedRetailVariantId: rest.linkedRetailVariantId ?? null,
                    conversionRatio: rest.conversionRatio ?? null,
                    conversionLossPercent: rest.conversionLossPercent ?? "0",
                    isOpenOrderAllowed: rest.isOpenOrderAllowed ?? false,
                    negotiationTimeoutSec: rest.negotiationTimeoutSec ?? 100,
                    isPackReturnRequired: rest.isPackReturnRequired ?? false,
                    packDepositAmount: rest.packDepositAmount ?? "0",
                    minMarginPercent: rest.minMarginPercent ?? null,
                    minMarginAmount: rest.minMarginAmount ?? null,
                    isActive: rest.isActive ?? true,
                })
                .where(eq(productVariant.id, id));

            // Find productId and sync
            const variant = await db.query.productVariant.findFirst({
                where: eq(productVariant.id, id),
                columns: { productId: true },
            });
            if (variant) await syncProductFromVariants(variant.productId);

            return { message: "Variant updated successfully" };
        }),

    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/admin/product-variants/delete",
            tags: ["Admin Product Variants"],
            summary: "Delete variant",
            description: "Delete a product variant",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            // Get productId before deleting
            const variant = await db.query.productVariant.findFirst({
                where: eq(productVariant.id, input.id),
                columns: { productId: true },
            });

            await db.delete(productVariant).where(eq(productVariant.id, input.id));

            // Sync after delete
            if (variant) await syncProductFromVariants(variant.productId);

            return { message: "Variant deleted successfully" };
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
