import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { productVariant } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

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
        .handler(async ({ input }) => {
            const [created] = await db
                .insert(productVariant)
                .values({
                    productId: input.productId,
                    sku: input.sku ?? null,
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
                })
                .returning();
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
                })
                .where(eq(productVariant.id, id));
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
            await db.delete(productVariant).where(eq(productVariant.id, input.id));
            return { message: "Variant deleted successfully" };
        }),
};
