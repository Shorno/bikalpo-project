import { db } from "@bikalpo-project/db";
import { category as categoryTable, product, productImage, stockChangeLog } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gt, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
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
    brandId: z.number().optional().nullable(),
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

const adjustStockSchema = z.object({
    productId: z.number(),
    changeType: z.enum(["add", "reduce"]),
    quantity: z.number().min(1),
    reason: z.string().optional(),
});

export const productRouter = {
    /**
     * Create a new product
     * REST: POST /products
     */
    create: adminProcedure
        .route({
            method: "POST",
            path: "/products",
            tags: ["Product Management"],
            summary: "Create product",
            description: "Create a new product",
        })
        .input(createProductSchema)
        .handler(async ({ context, input }) => {
            const { additionalImages, ...productData } = input;

            // Auto-generate SKU if not provided
            let sku = (productData.sku ?? "").toString().trim() || null;
            if (!sku) {
                // Look up category and subcategory slugs
                const cat = await db.query.category.findFirst({
                    where: eq(categoryTable.id, productData.categoryId),
                    columns: { slug: true },
                });
                let subCatSlug = "xx";
                if (productData.subCategoryId) {
                    const sub = await db.query.subCategory.findFirst({
                        where: (s, { eq: eq2 }) => eq2(s.id, productData.subCategoryId!),
                        columns: { slug: true },
                    });
                    subCatSlug = sub?.slug || "xx";
                }
                // Count existing products in this category for serial
                const [countResult] = await db
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

            const [newProduct] = await db
                .insert(product)
                .values({
                    ...productData,
                    subCategoryId: productData.subCategoryId || null,
                    brandId: productData.brandId || null,
                    sku,
                    supplier: (productData.supplier ?? "").toString().trim() || null,
                    reorderLevel: productData.reorderLevel ?? 0,
                })
                .returning();

            if (additionalImages && additionalImages.length > 0) {
                await db.insert(productImage).values(
                    additionalImages.map((imageUrl) => ({
                        productId: newProduct!.id,
                        imageUrl,
                    })),
                );
            }

            return { product: newProduct };
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
            const { id, additionalImages, ...updateData } = input;

            const [updatedProduct] = await db
                .update(product)
                .set({
                    ...updateData,
                    subCategoryId: updateData.subCategoryId || null,
                    brandId: updateData.brandId || null,
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
                    images: true,
                    brand: true,
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
                    brand: { columns: { name: true } },
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
