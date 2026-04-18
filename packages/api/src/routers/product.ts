import { db } from "@bikalpo-project/db";
import {
    brand as brandTable,
    category as categoryTable,
    coreProductIdentity,
    product,
    productImage,
    productBrand,
    productType,
    productVariantPrice,
    productVariant,
    subCategory,
    variantOption,
    stockChangeLog,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";
import { generateSku } from "./helpers/generate-sku";

// Input schemas
const productIdSchema = z.object({
    id: z.number(),
});

// ProductFeatureGroup schema matching the DB type
const productFeatureItemSchema = z.object({
    key: z.string(),
    value: z.string(),
});

const productFeatureGroupSchema = z.object({
    title: z.string(),
    items: z.array(productFeatureItemSchema),
});

const createProductSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional().nullable(),
    price: z.string(),
    size: z.string(), // required
    image: z.string(), // required
    categoryId: z.number(),
    subCategoryId: z.number().optional().nullable(),
    brandIds: z.array(z.number().int()).optional(),

    inStock: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    stockQuantity: z.number().default(0),
    reorderLevel: z.number().default(0),
    sku: z.string().optional().nullable(),
    supplier: z.string().optional().nullable(),
    features: z.array(productFeatureGroupSchema).optional(),
    additionalImages: z.array(z.string()).optional(),
    // B2B + B2C Pack Return fields
    isReturnablePack: z.boolean().default(false),
    defaultPackDepositAmount: z.string().optional(),
    allowedPackBrands: z.array(z.string()).optional(),
    allowedPackSizes: z.array(z.string()).optional(),
    status: z.enum(["active", "inactive", "draft"]).default("active"),

    // === New fields for Core Identity-driven flow ===
    coreProductId: z.number().int().optional().nullable(),
    shortDescription: z.string().optional().nullable(),
    videoUrl: z.string().optional().nullable(),
    // Behavior settings
    trackingType: z.enum(["none", "batch", "serial"]).default("none"),
    expiryEnabled: z.boolean().default(false),
    damageControlEnabled: z.boolean().default(false),
    // Delivery
    deliveryCostPerCarton: z.string().optional().nullable(),
    /** Total unit size in KG (e.g. 50 for 50KG carton). Used for conversion. */
    unitSize: z.string().optional().nullable(),
    // Visibility / publish
    visibility: z.enum(["public", "private"]).default("public"),
    scheduledAt: z.string().optional().nullable(), // ISO date string
    // Variant prices (brand + variant + consumer reference price)
    variantPrices: z.array(z.object({
        variantOptionId: z.number().int(),
        brandId: z.number().int().optional().nullable(),
        consumerPrice: z.string().default("0"),
    })).optional(),
});

const updateProductSchema = createProductSchema.extend({
    id: z.number(),
});

const stockListParamsSchema = z.object({
    search: z.string().optional(),
    categoryId: z.string().optional(),
    stockStatus: z.enum(["all", "in", "out", "low"]).default("all"),
    sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(10),
});

const stockExportParamsSchema = z.object({
    search: z.string().optional(),
    categoryId: z.string().optional(),
    stockStatus: z.enum(["all", "in", "out", "low"]).default("all"),
    sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
});

const consumerPriceListParamsSchema = z.object({
    search: z.string().optional(),
    typeId: z.number().int().optional(),
    categoryId: z.number().int().optional(),
    subCategoryId: z.number().int().optional(),
    coreProductId: z.number().int().optional(),
});

const updateConsumerReferencePriceSchema = z.object({
    variantPriceId: z.number().int(),
    consumerPrice: z.string().min(1).regex(/^\d+(\.\d{1,2})?$/),
});

const adjustStockSchema = z.object({
    productId: z.number(),
    changeType: z.enum(["add", "reduce"]),
    quantity: z.number().min(1),
    reason: z.string().optional(),
});

type ConsumerPriceListInput = z.infer<typeof consumerPriceListParamsSchema>;

async function fetchConsumerReferencePriceData(input: ConsumerPriceListInput) {
    const conditions: SQL[] = [
        eq(productVariantPrice.isActive, true),
    ];

    if (input.search?.trim()) {
        const s = `%${input.search.trim()}%`;
        conditions.push(
            or(
                ilike(product.name, s),
                ilike(product.sku, s),
                ilike(variantOption.name, s),
                ilike(brandTable.name, s),
                ilike(coreProductIdentity.name, s),
            )!,
        );
    }
    if (input.typeId != null) {
        conditions.push(eq(categoryTable.typeId, input.typeId));
    }
    if (input.categoryId != null) {
        conditions.push(eq(product.categoryId, input.categoryId));
    }
    if (input.subCategoryId != null) {
        conditions.push(eq(product.subCategoryId, input.subCategoryId));
    }
    if (input.coreProductId != null) {
        conditions.push(eq(product.coreProductId, input.coreProductId));
    }

    const where = and(...conditions);

    const rows = await db
        .select({
            variantPriceId: productVariantPrice.id,
            consumerPrice: productVariantPrice.consumerPrice,
            updatedAt: productVariantPrice.updatedAt,
            sortOrder: productVariantPrice.sortOrder,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            variantOptionId: variantOption.id,
            variantName: variantOption.name,
            variantUnit: variantOption.unit,
            categoryId: categoryTable.id,
            categoryName: categoryTable.name,
            typeId: productType.id,
            typeName: productType.name,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.name,
            coreProductId: coreProductIdentity.id,
            coreProductName: coreProductIdentity.name,
            coreProductSku: coreProductIdentity.sku,
            primaryBrandName: brandTable.name,
        })
        .from(productVariantPrice)
        .innerJoin(product, eq(productVariantPrice.productId, product.id))
        .innerJoin(variantOption, eq(productVariantPrice.variantOptionId, variantOption.id))
        .innerJoin(categoryTable, eq(product.categoryId, categoryTable.id))
        .leftJoin(productType, eq(categoryTable.typeId, productType.id))
        .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
        .leftJoin(coreProductIdentity, eq(product.coreProductId, coreProductIdentity.id))
        .leftJoin(brandTable, eq(product.brandId, brandTable.id))
        .where(where)
        .orderBy(
            asc(productType.name),
            asc(categoryTable.name),
            asc(coreProductIdentity.name),
            asc(product.name),
            asc(productVariantPrice.sortOrder),
            asc(variantOption.name),
        );

    const productIds = [...new Set(rows.map((r) => r.productId))];
    const brandLinks =
        productIds.length === 0
            ? []
            : await db.query.productBrand.findMany({
                  where: inArray(productBrand.productId, productIds),
                  with: { brand: { columns: { name: true } } },
              });

    const brandsByProduct = new Map<number, string>();
    for (const link of brandLinks) {
        const name = link.brand?.name;
        if (!name) continue;
        const prev = brandsByProduct.get(link.productId);
        brandsByProduct.set(link.productId, prev ? `${prev}, ${name}` : name);
    }

    const items = rows.map((r) => {
        const brandDisplay =
            (r.primaryBrandName && r.primaryBrandName.trim()) ||
            brandsByProduct.get(r.productId) ||
            "—";
        const identityLabel = r.coreProductName ?? r.productName;
        const skuLabel = r.coreProductSku ?? r.productSku ?? "—";
        const coreLine = `${identityLabel} (${skuLabel}) • ${r.categoryName ?? "—"} → ${r.subCategoryName ?? "—"} → ${identityLabel}`;

        return {
            variantPriceId: r.variantPriceId,
            consumerPrice: String(r.consumerPrice),
            updatedAt: r.updatedAt,
            productId: r.productId,
            productName: r.productName,
            productSku: r.productSku,
            variantOptionId: r.variantOptionId,
            variantName: r.variantName,
            variantUnit: r.variantUnit,
            brandDisplay,
            typeId: r.typeId,
            typeName: r.typeName ?? "Uncategorized",
            categoryId: r.categoryId,
            categoryName: r.categoryName ?? "—",
            subCategoryName: r.subCategoryName ?? "—",
            coreProductId: r.coreProductId,
            coreProductName: r.coreProductName,
            coreProductSku: r.coreProductSku,
            coreLine,
        };
    });

    const uniqueCoreOrProduct = new Set<string>();
    for (const i of items) {
        uniqueCoreOrProduct.add(
            i.coreProductId != null ? `c:${i.coreProductId}` : `p:${i.productId}`,
        );
    }
    const totalCoreProducts = uniqueCoreOrProduct.size;
    const totalVariants = items.length;
    let lastUpdated: Date | null = null;
    for (const i of items) {
        if (i.updatedAt && (!lastUpdated || i.updatedAt > lastUpdated)) {
            lastUpdated = i.updatedAt;
        }
    }

    return {
        items,
        stats: {
            totalCoreProducts,
            totalVariants,
            lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        },
    };
}

export const productRouter = {
    /**
     * Create a new product
     * REST: POST /products
     *
     * Creates a SINGLE product with multiple brands attached.
     * Each brand has its own set of variant configurations (variant prices).
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/products",
            tags: ["Product Management"],
            summary: "Create product",
            description: "Create a new product with multi-brand variant configuration",
        })
        .input(createProductSchema)
        .handler(async ({ context, input }) => {
            const { additionalImages, variantPrices, brandIds, ...productData } = input;

            const primaryBrandId = (brandIds && brandIds.length > 0) ? brandIds[0] : null;

            // Use a transaction for atomicity
            const result = await db.transaction(async (tx) => {
                // Auto-generate SKU if not provided
                let sku = (productData.sku ?? "").toString().trim() || null;
                if (!sku) {
                    const cat = await tx.query.category.findFirst({
                        where: eq(categoryTable.id, productData.categoryId),
                        columns: { slug: true },
                    });
                    let subCatSlug = "xx";
                    if (productData.subCategoryId) {
                        const sub = await tx.query.subCategory.findFirst({
                            where: (s, { eq: eq2 }) => eq2(s.id, productData.subCategoryId!),
                            columns: { slug: true },
                        });
                        subCatSlug = sub?.slug || "xx";
                    }
                    const [countResult] = await tx
                        .select({ count: sql<number>`count(*)::int` })
                        .from(product)
                        .where(eq(product.categoryId, productData.categoryId));
                    const serial = (countResult?.count ?? 0) + 1;

                    sku = generateSku({
                        subCategorySlug: subCatSlug,
                        categorySlug: cat?.slug || "xx",
                        serialNumber: serial,
                        userId: context.session.user.id,
                    });
                }

                // Create ONE product
                const [newProduct] = await tx
                    .insert(product)
                    .values({
                        ...productData,
                        brandId: primaryBrandId,
                        subCategoryId: productData.subCategoryId || null,
                        coreProductId: productData.coreProductId || null,
                        shortDescription: productData.shortDescription || null,
                        videoUrl: productData.videoUrl || null,
                        scheduledAt: productData.scheduledAt ? new Date(productData.scheduledAt) : null,
                        sku,
                        supplier: (productData.supplier ?? "").toString().trim() || null,
                        reorderLevel: productData.reorderLevel ?? 0,
                    })
                    .returning();

                // Insert additional images
                if (additionalImages && additionalImages.length > 0) {
                    await tx.insert(productImage).values(
                        additionalImages.map((imageUrl) => ({
                            productId: newProduct!.id,
                            imageUrl,
                        })),
                    );
                }

                // Insert ALL brand links (M2M)
                if (brandIds && brandIds.length > 0) {
                    await tx.insert(productBrand).values(
                        brandIds.map((bId) => ({
                            productId: newProduct!.id,
                            brandId: bId,
                        })),
                    );
                }

                // Insert variant prices (each carries brandId to differentiate per-brand config)
                if (variantPrices && variantPrices.length > 0) {
                    const insertedPrices = await tx.insert(productVariantPrice).values(
                        variantPrices.map((vp, idx) => ({
                            productId: newProduct!.id,
                            variantOptionId: vp.variantOptionId,
                            brandId: vp.brandId || null,
                            consumerPrice: vp.consumerPrice || "0",
                            sortOrder: idx,
                        })),
                    ).returning();

                    // Fetch variant_option metadata
                    const voIds = [...new Set(variantPrices.map((vp) => vp.variantOptionId))];
                    const variantOptions = await tx
                        .select()
                        .from(variantOption)
                        .where(inArray(variantOption.id, voIds));
                    const voMap = Object.fromEntries(variantOptions.map((vo) => [vo.id, vo]));

                    // Auto-generate product_variant rows (one per variant-price, with brandId)
                    const autoVariantRows: any[] = [];
                    for (let idx = 0; idx < insertedPrices.length; idx++) {
                        const pvp = insertedPrices[idx];
                        const originalVp = variantPrices[idx];
                        const vo = voMap[pvp.variantOptionId];
                        const isLoose = vo?.variantType === "loose";
                        const packType = isLoose ? "loose" : "packet";
                        const weightKg = vo?.size || "0";

                        autoVariantRows.push({
                            productId: newProduct!.id,
                            brandId: originalVp?.brandId || null,
                            sku: `CP-${newProduct!.id}-B${originalVp?.brandId ?? 0}-VO-${pvp.variantOptionId}`,
                            unitLabel: vo?.name || "Unit",
                            quantitySelectorLabel: vo?.name || "Unit",
                            packagingType: packType,
                            weightKg,
                            price: pvp.consumerPrice || "0",
                            orderUnit: vo?.unit || "piece",
                            packType: (packType as any) || null,
                            packWeightKg: weightKg || null,
                            sellUnit: vo?.name || null,
                            sourceVariantPriceId: pvp.id,
                            sourceVariantOptionId: pvp.variantOptionId,
                            stockQuantity: 0,
                            reorderLevel: 0,
                            sortOrder: idx,
                            isActive: pvp.isActive ?? true,
                        });
                    }

                    if (autoVariantRows.length > 0) {
                        await tx.insert(productVariant).values(autoVariantRows).returning();
                    }
                }

                return newProduct;
            });

            return {
                product: result,
                count: 1,
            };
        }),

    /**
     * Update a product
     * REST: PUT /products/:id
     */
    update: adminProcedure
        .route({
            method: "PUT",
            path: "/products/{id}",
            tags: ["Product Management"],
            summary: "Update product",
            description: "Update an existing product",
        })
        .input(updateProductSchema)
        .handler(async ({ input }) => {
            const { id, additionalImages, variantPrices, brandIds, ...updateData } = input;

            // Set brandId at product level
            const productBrandId = (brandIds && brandIds.length > 0) ? brandIds[0] : null;

            const [updatedProduct] = await db
                .update(product)
                .set({
                    ...updateData,
                    brandId: productBrandId,
                    subCategoryId: updateData.subCategoryId || null,
                    coreProductId: updateData.coreProductId || null,
                    shortDescription: updateData.shortDescription || null,
                    videoUrl: updateData.videoUrl || null,
                    scheduledAt: updateData.scheduledAt ? new Date(updateData.scheduledAt) : null,
                    sku: (updateData.sku ?? "").toString().trim() || null,
                    supplier: (updateData.supplier ?? "").toString().trim() || null,
                    reorderLevel: updateData.reorderLevel ?? 0,
                })
                .where(eq(product.id, id))
                .returning();

            if (!updatedProduct) {
                throw new ORPCError("NOT_FOUND", { message: "Product not found" });
            }

            if (additionalImages !== undefined) {
                await db.delete(productImage).where(eq(productImage.productId, id));

                if (additionalImages.length > 0) {
                    await db.insert(productImage).values(
                        additionalImages.map((imageUrl) => ({
                            productId: id,
                            imageUrl,
                        })),
                    );
                }
            }

            // Sync product brands (M2M)
            if (brandIds !== undefined) {
                await db.delete(productBrand).where(eq(productBrand.productId, id));
                if (brandIds.length > 0) {
                    await db.insert(productBrand).values(
                        brandIds.map((bId) => ({
                            productId: id,
                            brandId: bId,
                        })),
                    );
                }
            }

            // Replace variant prices + re-sync product_variant rows
            if (variantPrices && variantPrices.length > 0) {
                // Delete old variant prices
                await db.delete(productVariantPrice).where(eq(productVariantPrice.productId, id));

                // Delete old auto-generated product_variant rows (those with sourceVariantPriceId)
                // Keep manually-created legacy variants untouched
                await db.delete(productVariant).where(
                    and(
                        eq(productVariant.productId, id),
                        sql`${productVariant.sourceVariantPriceId} IS NOT NULL`,
                    ),
                );

                // 1. Insert new product_variant_price rows
                const insertedPrices = await db.insert(productVariantPrice).values(
                    variantPrices.map((vp, idx) => ({
                        productId: id,
                        variantOptionId: vp.variantOptionId,
                        brandId: vp.brandId || null,
                        consumerPrice: vp.consumerPrice || "0",
                        sortOrder: idx,
                    })),
                ).returning();

                // 2. Fetch variant_option metadata
                const voIds = variantPrices.map((vp) => vp.variantOptionId);
                const variantOptions = await db
                    .select()
                    .from(variantOption)
                    .where(inArray(variantOption.id, voIds));
                const voMap = Object.fromEntries(variantOptions.map((vo) => [vo.id, vo]));

                // 3. Auto-generate new product_variant rows
                const autoVariantRows = insertedPrices.map((pvp, idx) => {
                    const vo = voMap[pvp.variantOptionId];
                    const isLoose = vo?.variantType === "loose";
                    const packType = isLoose ? "loose" : "packet";
                    const weightKg = vo?.size || "0";

                    return {
                        productId: id,
                        sku: `CP-${id}-VO-${pvp.variantOptionId}`,
                        unitLabel: vo?.name || "Unit",
                        quantitySelectorLabel: vo?.name || "Unit",
                        packagingType: packType,
                        weightKg,
                        price: pvp.consumerPrice || "0",
                        orderUnit: vo?.unit || "piece",
                        packType: (packType as any) || null,
                        packWeightKg: weightKg || null,
                        sellUnit: vo?.name || null,
                        sourceVariantPriceId: pvp.id,
                        sourceVariantOptionId: pvp.variantOptionId,
                        stockQuantity: 0,
                        reorderLevel: 0,
                        sortOrder: idx,
                        isActive: pvp.isActive ?? true,
                    };
                });

                if (autoVariantRows.length > 0) {
                    await db.insert(productVariant).values(autoVariantRows).returning();
                }
            }

            return { product: updatedProduct };
        }),

    /**
     * Delete a product
     * REST: DELETE /products/:id
     */
    delete: adminProcedure
        .route({
            method: "DELETE",
            path: "/products/{id}",
            tags: ["Product Management"],
            summary: "Delete product",
            description: "Delete a product by ID",
        })
        .input(productIdSchema)
        .handler(async ({ input }) => {
            const [deletedProduct] = await db
                .delete(product)
                .where(eq(product.id, input.id))
                .returning();

            if (!deletedProduct) {
                throw new ORPCError("NOT_FOUND", { message: "Product not found" });
            }

            return { success: true };
        }),

    /**
     * Get product by ID
     * REST: GET /products/:id
     */
    getById: publicProcedure
        .route({
            method: "GET",
            path: "/products/{id}",
            tags: ["Products"],
            summary: "Get product by ID",
            description: "Get a single product by its ID",
        })
        .input(productIdSchema)
        .handler(async ({ input }) => {
            const foundProduct = await db.query.product.findFirst({
                where: eq(product.id, input.id),
                with: {
                    category: true,
                    subCategory: true,
                    brand: true,
                    images: true,
                    productBrands: {
                        with: { brand: true },
                    },
                    variantPrices: {
                        with: {
                            variantOption: true,
                        },
                    },
                },
            });

            if (!foundProduct) {
                throw new ORPCError("NOT_FOUND", { message: "Product not found" });
            }

            return { product: foundProduct };
        }),

    /**
     * Get products for stock management (admin)
     * REST: GET /products/stock
     */
    getForStock: adminProcedure
        .route({
            method: "GET",
            path: "/products/stock",
            tags: ["Product Management"],
            summary: "Get products for stock",
            description: "Get products with stock information for admin management",
        })
        .input(stockListParamsSchema)
        .handler(async ({ input }) => {
            const { search, categoryId, stockStatus, sort, page, limit } = input;

            const conditions: SQL[] = [];

            if (search?.trim()) {
                const s = `%${search.trim()}%`;
                const searchCondition = or(
                    ilike(product.name, s),
                    ilike(product.sku, s),
                    sql`EXISTS (SELECT 1 FROM "category" c WHERE c.id = ${product.categoryId} AND c.name ILIKE ${s})`,
                );
                if (searchCondition) conditions.push(searchCondition);
            }

            if (categoryId) {
                const cid = parseInt(categoryId, 10);
                if (!Number.isNaN(cid)) conditions.push(eq(product.categoryId, cid));
            }

            if (stockStatus === "in") {
                conditions.push(eq(product.inStock, true));
                conditions.push(gt(product.stockQuantity, 0));
            } else if (stockStatus === "out") {
                const outCondition = or(eq(product.inStock, false), eq(product.stockQuantity, 0));
                if (outCondition) conditions.push(outCondition);
            } else if (stockStatus === "low") {
                conditions.push(gt(product.reorderLevel, 0));
                conditions.push(sql`${product.stockQuantity} <= ${product.reorderLevel}`);
            }

            const where = conditions.length > 0 ? and(...conditions) : undefined;
            const offset = (page - 1) * limit;

            const [rows, countResult] = await Promise.all([
                db.query.product.findMany({
                    where,
                    orderBy: (p, { asc, desc: descFn }) =>
                        sort === "oldest"
                            ? [asc(p.createdAt)]
                            : sort === "popular"
                                ? [descFn(p.stockQuantity)]
                                : [descFn(p.createdAt)],
                    offset,
                    limit,
                    columns: {
                        id: true,
                        name: true,
                        slug: true,
                        sku: true,
                        price: true,
                        stockQuantity: true,
                        inStock: true,
                        reorderLevel: true,
                        supplier: true,
                        lastRestockedAt: true,
                        categoryId: true,
                        subCategoryId: true,
                    },
                    with: {
                        category: { columns: { name: true, slug: true } },
                        subCategory: { columns: { name: true } },
                    },
                }),
                db.select({ count: sql<number>`count(*)::int` }).from(product).where(where),
            ]);

            return { products: rows, total: countResult[0]?.count ?? 0 };
        }),

    /**
     * Adjust stock with reason
     * REST: POST /products/:productId/stock
     */
    adjustStock: adminProcedure
        .route({
            method: "POST",
            path: "/products/{productId}/stock",
            tags: ["Product Management"],
            summary: "Adjust stock",
            description: "Adjust product stock with a reason log",
        })
        .input(adjustStockSchema)
        .handler(async ({ context, input }) => {
            const { productId, changeType, quantity, reason } = input;

            if (quantity <= 0) {
                throw new ORPCError("BAD_REQUEST", { message: "Quantity must be greater than 0" });
            }

            const [p] = await db.select().from(product).where(eq(product.id, productId));

            if (!p) {
                throw new ORPCError("NOT_FOUND", { message: "Product not found" });
            }

            const current = p.stockQuantity;
            const newQty = changeType === "add" ? current + quantity : Math.max(0, current - quantity);

            await db
                .update(product)
                .set({
                    stockQuantity: newQty,
                    inStock: newQty > 0,
                    ...(changeType === "add" ? { lastRestockedAt: new Date() } : {}),
                })
                .where(eq(product.id, productId));

            await db.insert(stockChangeLog).values({
                productId,
                changeType,
                quantity: changeType === "add" ? quantity : -quantity,
                reason: reason || null,
                createdById: context.session.user.id,
            });

            return { stockQuantity: newQty };
        }),

    /**
     * Get stock change logs for a product
     * REST: GET /products/:productId/stock-logs
     */
    getStockLogs: adminProcedure
        .route({
            method: "GET",
            path: "/products/{productId}/stock-logs",
            tags: ["Product Management"],
            summary: "Get stock logs",
            description: "Get stock change history for a product",
        })
        .input(z.object({ productId: z.number() }))
        .handler(async ({ input }) => {
            const logs = await db.query.stockChangeLog.findMany({
                where: eq(stockChangeLog.productId, input.productId),
                orderBy: [desc(stockChangeLog.createdAt)],
                with: {
                    createdBy: { columns: { name: true } },
                },
            });

            return { logs };
        }),

    /**
     * Get all products (public)
     * REST: GET /products
     */
    getAll: publicProcedure
        .route({
            method: "GET",
            path: "/products",
            tags: ["Products"],
            summary: "Get all products",
            description: "Get all products with full relations",
        })
        .handler(async () => {
            const products = await db.query.product.findMany({
                orderBy: [desc(product.createdAt)],
                with: {
                    category: true,
                    subCategory: true,
                    brand: true,
                    images: true,
                    productBrands: {
                        with: { brand: true },
                    },
                    variants: {
                        with: { brand: true },
                        columns: { id: true, variantType: true, brandId: true, unitLabel: true },
                    },
                    variantPrices: {
                        with: { variantOption: true },
                    },
                },
            });

            return { products };
        }),

    /**
     * Get product by slug (public)
     * REST: GET /products/by-slug/:slug
     */
    getBySlug: publicProcedure
        .route({
            method: "GET",
            path: "/products/by-slug/{slug}",
            tags: ["Products"],
            summary: "Get product by slug",
            description: "Get a single product by its slug",
        })
        .input(z.object({ slug: z.string() }))
        .handler(async ({ input }) => {
            const foundProduct = await db.query.product.findFirst({
                where: eq(product.slug, input.slug),
                with: {
                    category: { columns: { name: true, slug: true } },
                    subCategory: { columns: { name: true } },
                    images: true,
                },
            });

            if (!foundProduct) {
                throw new ORPCError("NOT_FOUND", { message: "Product not found" });
            }

            return { product: foundProduct };
        }),

    /**
     * Search products (public)
     * REST: GET /products/search
     */
    search: publicProcedure
        .route({
            method: "GET",
            path: "/products/search",
            tags: ["Products"],
            summary: "Search products",
            description: "Search products by name",
        })
        .input(z.object({ query: z.string() }))
        .handler(async ({ input }) => {
            if (!input.query || input.query.trim().length === 0) {
                return { products: [] };
            }

            const products = await db.query.product.findMany({
                where: ilike(product.name, `%${input.query}%`),
                with: {
                    category: { columns: { name: true, slug: true } },
                },
                limit: 10,
            });

            return { products };
        }),

    /**
     * Get filtered products (public)
     * REST: GET /products/filtered
     */
    getFiltered: publicProcedure
        .route({
            method: "GET",
            path: "/products/filtered",
            tags: ["Products"],
            summary: "Get filtered products",
            description: "Get products with filters for category, price, and sorting",
        })
        .input(z.object({
            category: z.string().optional().nullable(),
            brand: z.string().optional().nullable(),
            minPrice: z.number().optional().nullable(),
            maxPrice: z.number().optional().nullable(),
            sort: z.string().optional().nullable(),
        }))
        .handler(async ({ input }) => {
            const { category: categorySlug, minPrice, maxPrice, sort } = input;

            const conditions: SQL[] = [];

            // Category filter
            if (categorySlug) {
                const matchedCategory = await db.query.category.findFirst({
                    where: eq(categoryTable.slug, categorySlug),
                    columns: { id: true },
                });

                if (matchedCategory) {
                    conditions.push(eq(product.categoryId, matchedCategory.id));
                } else {
                    return { products: [] };
                }
            }

            // Price filters
            if (minPrice != null) {
                conditions.push(gte(product.price, minPrice.toString()));
            }
            if (maxPrice != null) {
                conditions.push(lte(product.price, maxPrice.toString()));
            }

            // Get order by
            const getOrderBy = () => {
                switch (sort) {
                    case "price_asc": return asc(product.price);
                    case "price_desc": return desc(product.price);
                    case "name_asc": return asc(product.name);
                    case "name_desc": return desc(product.name);
                    default: return desc(product.createdAt);
                }
            };

            const products = await db.query.product.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    category: { columns: { name: true, slug: true } },
                },
                orderBy: getOrderBy(),
            });

            return { products };
        }),

    /**
     * List consumer reference prices (B2C / retail variant_price rows) for admin pricing console
     */
    listConsumerReferencePrices: adminProcedure
        .route({
            method: "GET",
            path: "/products/consumer-reference-prices",
            tags: ["Product Management"],
            summary: "List consumer reference prices",
            description:
                "Admin view of retail (or unset-type) variant prices with taxonomy for consumer price management.",
        })
        .input(consumerPriceListParamsSchema)
        .handler(async ({ input }) => fetchConsumerReferencePriceData(input)),

    /**
     * Update a single consumer reference price (product_variant_price + linked product_variant)
     */
    updateConsumerReferencePrice: adminProcedure
        .route({
            method: "PUT",
            path: "/products/variant-prices/consumer-price",
            tags: ["Product Management"],
            summary: "Update consumer reference price",
            description: "Updates reference consumer price and syncs linked auto-generated product_variant rows.",
        })
        .input(updateConsumerReferencePriceSchema)
        .handler(async ({ input }) => {
            const [existing] = await db
                .select({ id: productVariantPrice.id })
                .from(productVariantPrice)
                .where(eq(productVariantPrice.id, input.variantPriceId));

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Variant price row not found" });
            }

            await db
                .update(productVariantPrice)
                .set({ consumerPrice: input.consumerPrice, updatedAt: new Date() })
                .where(eq(productVariantPrice.id, input.variantPriceId));

            await db
                .update(productVariant)
                .set({ price: input.consumerPrice, updatedAt: new Date() })
                .where(eq(productVariant.sourceVariantPriceId, input.variantPriceId));

            return { success: true as const };
        }),

    /**
     * Export consumer reference price list as CSV (same filters as list)
     */
    exportConsumerPricesCSV: adminProcedure
        .route({
            method: "POST",
            path: "/products/consumer-reference-prices/export-csv",
            tags: ["Product Management"],
            summary: "Export consumer reference prices CSV",
        })
        .input(consumerPriceListParamsSchema)
        .handler(async ({ input }) => {
            const { items } = await fetchConsumerReferencePriceData(input);
            const header = [
                "Type",
                "Category",
                "SubCategory",
                "CoreOrProduct",
                "Brand",
                "Variant",
                "Unit",
                "ReferencePriceBDT",
                "UpdatedAt",
                "VariantPriceId",
            ];
            const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
            const lines = [
                header.join(","),
                ...items.map((i) =>
                    [
                        i.typeName,
                        i.categoryName,
                        i.subCategoryName,
                        i.coreProductName ?? i.productName,
                        i.brandDisplay,
                        i.variantName,
                        i.variantUnit,
                        i.consumerPrice,
                        i.updatedAt ? i.updatedAt.toISOString() : "",
                        String(i.variantPriceId),
                    ]
                        .map((c) => escape(String(c)))
                        .join(","),
                ),
            ];
            return { csv: lines.join("\n") };
        }),

    /**
     * Export stock as CSV
     */
    exportStockCSV: adminProcedure
        .route({
            method: "POST",
            path: "/products/stock/export-csv",
            tags: ["Product Management"],
            summary: "Export stock as CSV",
            description: "Export stock inventory data as a CSV string",
        })
        .input(stockExportParamsSchema)
        .handler(async ({ input }) => {
            const { search, categoryId, stockStatus, sort } = input;
            const conditions: SQL[] = [];

            if (search?.trim()) {
                const s = `%${search.trim()}%`;
                const searchCondition = or(
                    ilike(product.name, s),
                    ilike(product.sku, s),
                    sql`EXISTS (SELECT 1 FROM "category" c WHERE c.id = ${product.categoryId} AND c.name ILIKE ${s})`,
                );
                if (searchCondition) conditions.push(searchCondition);
            }
            if (categoryId) {
                const cid = parseInt(categoryId, 10);
                if (!Number.isNaN(cid)) conditions.push(eq(product.categoryId, cid));
            }
            if (stockStatus === "in") {
                conditions.push(eq(product.inStock, true));
                conditions.push(gt(product.stockQuantity, 0));
            } else if (stockStatus === "out") {
                const outCondition = or(eq(product.inStock, false), eq(product.stockQuantity, 0));
                if (outCondition) conditions.push(outCondition);
            } else if (stockStatus === "low") {
                conditions.push(gt(product.reorderLevel, 0));
                conditions.push(sql`${product.stockQuantity} <= ${product.reorderLevel}`);
            }

            const where = conditions.length > 0 ? and(...conditions) : undefined;
            const products = await db.query.product.findMany({
                where,
                orderBy: (p, { asc: ascFn, desc: descFn }) =>
                    sort === "oldest" ? [ascFn(p.createdAt)]
                        : sort === "popular" ? [descFn(p.stockQuantity)]
                            : [descFn(p.createdAt)],
                limit: 100_000,
                columns: {
                    id: true, name: true, slug: true, sku: true, price: true,
                    stockQuantity: true, inStock: true, reorderLevel: true,
                },
                with: {
                    category: { columns: { name: true } },
                },
            });

            function escapeCsvCell(val: string | number | null | undefined): string {
                if (val == null) return "";
                const s = String(val);
                if (s.includes(",") || s.includes('"') || s.includes("\n"))
                    return `"${s.replace(/"/g, '""')}"`;
                return s;
            }

            const headers = ["Product ID", "Product Name", "SKU", "Category", "Current Stock", "Reorder Level", "Unit Price", "In Stock"];
            const rows = products.map((p) => [
                `PRD-${p.id}`, p.name, p.sku ?? p.slug,
                p.category?.name ?? "", p.stockQuantity, p.reorderLevel,
                String(p.price ?? ""), p.inStock ? "Yes" : "No",
            ]);
            const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))].join("\n");

            return { success: true as const, csv };
        }),

    /**
     * Export stock as PDF
     */
    exportStockPDF: adminProcedure
        .route({
            method: "POST",
            path: "/products/stock/export-pdf",
            tags: ["Product Management"],
            summary: "Export stock as PDF",
            description: "Export stock inventory data as a base64 PDF",
        })
        .input(stockExportParamsSchema)
        .handler(async ({ input }) => {
            const { search, categoryId, stockStatus, sort } = input;
            const conditions: SQL[] = [];

            if (search?.trim()) {
                const s = `%${search.trim()}%`;
                const searchCondition = or(
                    ilike(product.name, s),
                    ilike(product.sku, s),
                    sql`EXISTS (SELECT 1 FROM "category" c WHERE c.id = ${product.categoryId} AND c.name ILIKE ${s})`,
                );
                if (searchCondition) conditions.push(searchCondition);
            }
            if (categoryId) {
                const cid = parseInt(categoryId, 10);
                if (!Number.isNaN(cid)) conditions.push(eq(product.categoryId, cid));
            }
            if (stockStatus === "in") {
                conditions.push(eq(product.inStock, true));
                conditions.push(gt(product.stockQuantity, 0));
            } else if (stockStatus === "out") {
                const outCondition = or(eq(product.inStock, false), eq(product.stockQuantity, 0));
                if (outCondition) conditions.push(outCondition);
            } else if (stockStatus === "low") {
                conditions.push(gt(product.reorderLevel, 0));
                conditions.push(sql`${product.stockQuantity} <= ${product.reorderLevel}`);
            }

            const where = conditions.length > 0 ? and(...conditions) : undefined;
            const products = await db.query.product.findMany({
                where,
                orderBy: (p, { asc: ascFn, desc: descFn }) =>
                    sort === "oldest" ? [ascFn(p.createdAt)]
                        : sort === "popular" ? [descFn(p.stockQuantity)]
                            : [descFn(p.createdAt)],
                limit: 100_000,
                columns: {
                    id: true, name: true, slug: true, sku: true, price: true,
                    stockQuantity: true, inStock: true, reorderLevel: true,
                },
                with: {
                    category: { columns: { name: true } },
                    subCategory: { columns: { name: true } },
                },
            });

            function formatPrice(price: string | number | null | undefined): string {
                if (price == null) return "—";
                return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(Number(price));
            }
            function truncate(s: string, max: number): string {
                if (!s) return "—";
                return s.length > max ? `${s.slice(0, max)}…` : s;
            }

            const pdfDoc = await PDFDocument.create();
            let currentPage = pdfDoc.addPage([595, 842]);
            const { width, height } = currentPage.getSize();
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

            const leftMargin = 40;
            const rightMargin = width - 40;
            const col = {
                id: leftMargin, name: leftMargin + 38, sku: leftMargin + 118,
                category: leftMargin + 178, stock: leftMargin + 268, reorder: leftMargin + 303,
                price: leftMargin + 348, inStock: leftMargin + 418,
            };
            const rowHeight = 16;
            const headerFontSize = 9;
            const cellFontSize = 8;

            const drawHeader = (page: typeof currentPage, y: number) => {
                const headers = [["ID", col.id], ["Product", col.name], ["SKU", col.sku],
                ["Category", col.category], ["Stock", col.stock], ["Reorder", col.reorder],
                ["Price", col.price], ["In", col.inStock]] as const;
                for (const [text, x] of headers) {
                    page.drawText(text, { x, y, size: headerFontSize, font: helveticaBold });
                }
                page.drawLine({ start: { x: leftMargin, y: y - 6 }, end: { x: rightMargin, y: y - 6 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
                return y - 20;
            };

            let y = height - 50;
            currentPage.drawText("Stock Inventory", { x: width / 2 - 55, y, size: 18, font: helveticaBold, color: rgb(0, 0, 0) });
            y -= 22;
            currentPage.drawText(`Generated: ${new Date().toLocaleDateString("en-BD", { dateStyle: "medium" })}`, { x: leftMargin, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
            y -= 24;
            y = drawHeader(currentPage, y);

            for (const p of products) {
                if (y < 60) {
                    currentPage = pdfDoc.addPage([595, 842]);
                    y = height - 50;
                    y = drawHeader(currentPage, y);
                }
                const cat = p.category?.name ?? "";
                const sub = p.subCategory?.name ? ` / ${p.subCategory.name}` : "";
                const cells: [string, number][] = [
                    [`PRD-${p.id}`, col.id], [truncate(p.name, 18), col.name],
                    [truncate(p.sku ?? p.slug ?? "", 12), col.sku], [truncate(cat + sub, 14), col.category],
                    [String(p.stockQuantity), col.stock], [String(p.reorderLevel), col.reorder],
                    [formatPrice(p.price), col.price], [p.inStock ? "Yes" : "No", col.inStock],
                ];
                for (const [text, x] of cells) {
                    currentPage.drawText(text, { x, y, size: cellFontSize, font: helvetica });
                }
                y -= rowHeight;
            }

            const pdfBytes = await pdfDoc.save();
            const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
            return { success: true as const, pdfBase64 };
        }),
};
