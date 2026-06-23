/**
 * Shop Owner ORPC Router
 *
 * Contains queries for the shop owner's B2B view (buying wholesale from Admin)
 * and B2C management view (managing their retail catalog).
 *
 * - TRADE variants only for product browsing (B2B buying)
 * - RETAIL variants for shop management (what they sell to consumers)
 * - Inventory and pricing management
 */

import { db } from "@bikalpo-project/db";
import { FULFILLMENT_MODES } from "@bikalpo-project/db/fulfillment";
import {
    brand,
    category,
    product,
    productBrand,
    productImage,
    productReview,
    productVariant,
    productVariantPrice,
    subCategory,
    inventory,
    order,
    orderItem,
    user,
    area,
    sellerAreaMapping,
    openOrderBid,
    openOrderBidItem,
    shopWarehouseConnection,
    shopCategoryAssignment,
    warehouseCategoryAssignment,
    coreProductIdentity,
    productType,
    productIdentityRequest,
    variantOption,
    stockAdjustment,
    stockAdjustmentItem,
    damageEntry,
    damageEntryItem,
    emptyPack,
    productPackRule,
    supplier,
    purchaseItem,
    purchase,
    customerAssignment,
    deliveryArea,
    deliverySchedule,
    invoice,
    carton,
    cartonConfig,
    warehouseApplication,
    complaint,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
    and,
    asc,
    avg,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    lte,
    min,
    or,
    sql,
    sum,
    type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { shopOwnerProcedure, publicProcedure } from "../index";
import {
    isSellerAuthorizedForArea,
    calculateSellerDistance,
} from "../services/location-service";
import {
    DEFAULT_LOCK_TIMEOUT_SECONDS,
    checkAndExpireBids,
} from "../services/open-order-matching";
import { convertB2bOrderToRetailInventory } from "./helpers/b2b-conversion";
import { resolveWarehouseOrderMode } from "./helpers/warehouse-order-fulfillment";

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const productFiltersSchema = z.object({
    category: z.string().optional().nullable(),
    subcategory: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    minPrice: z.string().optional().nullable(),
    maxPrice: z.string().optional().nullable(),
    inStock: z.string().optional().nullable(),
    search: z.string().optional().nullable(),
    sort: z.string().optional().nullable(),
    page: z.string().optional().default("1"),
    limit: z.string().optional().default("12"),
});

const PAID_INVOICE_STATUSES = new Set(["collected", "settled"]);
const NON_PURCHASE_ORDER_STATUSES = new Set(["cancelled", "returned"]);
const PAYABLE_ORDER_STATUSES = new Set(["confirmed", "processing", "delivered"]);
const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
] as const;

const warehouseOrderModeSchema = z.enum(FULFILLMENT_MODES);

function toSafeNumber(value: string | number | null | undefined) {
    return Number(value || 0);
}

function isOrderPaid(
    orderPaymentStatus: string | null | undefined,
    invoicePaymentStatus: string | null | undefined,
) {
    return (
        orderPaymentStatus === "paid"
        || PAID_INVOICE_STATUSES.has(invoicePaymentStatus || "")
    );
}

function isPurchaseOrderStatus(status: string | null | undefined) {
    return !NON_PURCHASE_ORDER_STATUSES.has(status || "");
}

function isPayableOrder(
    status: string | null | undefined,
    orderPaymentStatus: string | null | undefined,
    invoicePaymentStatus: string | null | undefined,
) {
    return (
        PAYABLE_ORDER_STATUSES.has(status || "")
        && !isOrderPaid(orderPaymentStatus, invoicePaymentStatus)
    );
}

function normalizeDeliveryText(value: string | null | undefined) {
    return (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function findNextDeliveryDate(
    days: number[],
    today = new Date(),
) {
    if (days.length === 0) return null;

    const currentDay = today.getDay();
    const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
    const offsets = uniqueDays.map((dayOfWeek) => {
        let offset = (dayOfWeek - currentDay + 7) % 7;
        if (offset === 0) offset = 7;
        return { dayOfWeek, offset };
    });
    const next = offsets.sort((a, b) => a.offset - b.offset)[0];
    if (!next) return null;

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + next.offset);

    return {
        dayOfWeek: next.dayOfWeek,
        dayName: DAY_NAMES[next.dayOfWeek] || "Unknown",
        date: nextDate.toISOString(),
        offsetDays: next.offset,
    };
}

const CONNECTED_SUPPLIER_ACTIVE_WINDOW_DAYS = 45;

function getConnectedSupplierActivityStatus(
    lastOrderDate: Date | null | undefined,
    connectedAt: Date | null | undefined,
    pendingOrders = 0,
) {
    if (pendingOrders > 0) {
        return "active" as const;
    }

    const referenceDate = lastOrderDate || connectedAt;
    if (!referenceDate) {
        return "inactive" as const;
    }

    const diffMs = Date.now() - referenceDate.getTime();
    const activeWindowMs =
        CONNECTED_SUPPLIER_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    return diffMs <= activeWindowMs ? "active" as const : "inactive" as const;
}

// ────────────────────────────────────────────────────────────────
// B2B Queries (Shop Owner as Buyer — TRADE variants)
// ────────────────────────────────────────────────────────────────

const b2bQueries = {
    /**
     * Get products for shop owner wholesale browsing.
     * Same as customer.getCustomerProducts but products only shown
     * if they have TRADE variants visible to shop_owner.
     */
    getProducts: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/products",
            tags: ["Shop Owner"],
            summary: "Get wholesale products for shop owner (TRADE variants)",
        })
        .input(productFiltersSchema)
        .handler(async ({ input }) => {
            const {
                category: categorySlug,
                subcategory,
                brand: brandSlug,
                minPrice,
                maxPrice,
                inStock: inStockStr,
                search,
                sort = "newest",
                page: pageStr = "1",
                limit: limitStr = "12",
            } = input;

            const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
            const limit = Math.min(50, Math.max(1, parseInt(limitStr ?? "12", 10) || 12));
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [eq(product.status, "active")];

            // Category filter
            if (categorySlug) {
                const cat = await db.query.category.findFirst({
                    where: eq(category.slug, categorySlug),
                });
                if (cat) {
                    conditions.push(eq(product.categoryId, cat.id));
                } else {
                    return {
                        products: [],
                        pagination: { page, limit, totalCount: 0, totalPages: 0 },
                    };
                }
            }

            // Subcategory filter
            if (subcategory) {
                const slugs = subcategory.split(",").filter(Boolean);
                const subs = await db.query.subCategory.findMany({
                    where: inArray(subCategory.slug, slugs),
                });
                if (subs.length > 0) {
                    conditions.push(inArray(product.subCategoryId, subs.map((s) => s.id)));
                }
            }

            // Brand filter — product-level brand
            if (brandSlug) {
                const b = await db.query.brand.findFirst({
                    where: eq(brand.slug, brandSlug),
                });
                if (b) {
                    conditions.push(eq(product.brandId, b.id));
                } else {
                    return {
                        products: [],
                        pagination: { page, limit, totalCount: 0, totalPages: 0 },
                    };
                }
            }

            // Price filter (on product base price)
            if (minPrice) conditions.push(gte(product.price, minPrice));
            if (maxPrice) conditions.push(lte(product.price, maxPrice));

            // In stock filter
            const inStock = inStockStr === "true";
            if (inStock) conditions.push(eq(product.inStock, true));

            // Search
            if (search) conditions.push(ilike(product.name, `%${search}%`));

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            // Sort
            const getOrderBy = () => {
                switch (sort) {
                    case "price_asc":
                        return [asc(product.price)];
                    case "price_desc":
                        return [desc(product.price)];
                    case "oldest":
                        return [asc(product.createdAt)];
                    case "popular":
                        return [desc(product.createdAt)];
                    case "newest":
                    default:
                        return [desc(product.createdAt)];
                }
            };

            const [products, countResult] = await Promise.all([
                db.query.product.findMany({
                    where: whereClause,
                    with: {
                        category: { columns: { slug: true, name: true } },
                        subCategory: { columns: { name: true } },
                        images: true,
                    },
                    orderBy: getOrderBy(),
                    limit,
                    offset,
                }),
                db.select({ count: count() }).from(product).where(whereClause),
            ]);

            const totalCount = countResult[0]?.count || 0;
            const productIds = products.map((item) => item.id);

            let startingPriceMap: Record<number, number> = {};
            if (productIds.length > 0) {
                const priceRows = await db
                    .select({
                        productId: productVariant.productId,
                        minPrice: min(productVariant.price),
                    })
                    .from(productVariant)
                    .where(
                        and(
                            inArray(productVariant.productId, productIds),
                            eq(productVariant.isActive, true),
                            or(
                                eq(productVariant.variantType, "trade"),
                                and(
                                    sql`${productVariant.variantType} IS NULL`,
                                    or(
                                        eq(productVariant.visibilityRole, "shop_owner"),
                                        eq(productVariant.visibilityRole, "all"),
                                        sql`${productVariant.visibilityRole} IS NULL`,
                                    ),
                                ),
                            ),
                        ),
                    )
                    .groupBy(productVariant.productId);

                for (const row of priceRows) {
                    startingPriceMap[row.productId] = row.minPrice
                        ? parseFloat(row.minPrice)
                        : 0;
                }
            }

            const serializedProducts = products.map((item) => {
                const basePrice = Number(item.price);
                const variantPrice = startingPriceMap[item.id] ?? 0;

                return {
                    ...item,
                    price:
                        variantPrice > 0
                            ? variantPrice
                            : Number.isFinite(basePrice)
                                ? basePrice
                                : 0,
                };
            });

            return {
                products: serializedProducts,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(Number(totalCount) / limit),
                },
            };
        }),

    /**
     * Get product details with TRADE variants only (for shop owner B2B buying).
     */
    getProductDetails: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/products/{slug}",
            tags: ["Shop Owner"],
            summary: "Get product details with TRADE variants only",
        })
        .input(z.object({ slug: z.string() }))
        .handler(async ({ input }) => {
            const found = await db.query.product.findFirst({
                where: eq(product.slug, input.slug),
                with: {
                    category: { columns: { name: true, slug: true } },
                    subCategory: { columns: { name: true } },
                    images: true,
                },
            });
            if (!found)
                throw new ORPCError("NOT_FOUND", { message: "Product not found" });

            // Get only TRADE variants visible to shop_owner
            const variants = await db.query.productVariant.findMany({
                where: and(
                    eq(productVariant.productId, found.id),
                    eq(productVariant.isActive, true),
                    or(
                        eq(productVariant.variantType, "trade"),
                        // Include variants without type set (legacy) if visible to shop_owner
                        and(
                            sql`${productVariant.variantType} IS NULL`,
                            or(
                                eq(productVariant.visibilityRole, "shop_owner"),
                                eq(productVariant.visibilityRole, "all"),
                                sql`${productVariant.visibilityRole} IS NULL`,
                            ),
                        ),
                    ),
                ),
                orderBy: [asc(productVariant.sortOrder)],
            });

            // Get review stats
            const reviewStats = await db
                .select({
                    averageRating: avg(productReview.rating),
                    totalReviews: count(productReview.id),
                })
                .from(productReview)
                .where(eq(productReview.productId, found.id));

            return {
                product: found,
                variants,
                reviewStats: {
                    averageRating: reviewStats[0]?.averageRating
                        ? parseFloat(reviewStats[0].averageRating)
                        : 0,
                    totalReviews: reviewStats[0]?.totalReviews || 0,
                },
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Management Queries (Shop Owner as Seller — RETAIL variants)
// ────────────────────────────────────────────────────────────────

const managementQueries = {
    /**
     * Aggregated Stock Overview KPIs for the shop dashboard.
     * Returns all metrics in a single call to avoid multiple round-trips.
     */
    getStockOverview: shopOwnerProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // 1. Fetch all inventory for this shop with variant + product + category + brand
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { id: true, name: true } },
                                },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            // 2. Aggregate metrics
            const LOW_STOCK_THRESHOLD = 5;
            const AT_RISK_THRESHOLD = 2;

            let totalSKUs = 0;
            let inStockCount = 0;
            let lowStockCount = 0;
            let outOfStockCount = 0;
            let totalStockValue = 0;
            let atRiskCount = 0;

            const productSet = new Set<number>();
            const categoryMap = new Map<string, { totalQty: number; hasWeight: boolean }>();
            const productStockMap = new Map<number, {
                name: string;
                totalQty: number;
                unit: string;
                image: string | null;
            }>();

            for (const inv of shopInventory) {
                if (!inv.variant?.product) continue;

                totalSKUs++;
                const qty = parseFloat(inv.availableQty || "0");
                const retailPrice = parseFloat(inv.retailPrice || "0");
                const variantPrice = parseFloat(inv.variant.price || "0");
                const effectivePrice = retailPrice > 0 ? retailPrice : variantPrice;

                totalStockValue += qty * effectivePrice;
                productSet.add(inv.variant.product.id);

                // Stock status
                if (qty <= 0) outOfStockCount++;
                else if (qty <= LOW_STOCK_THRESHOLD) lowStockCount++;
                else inStockCount++;

                // At risk
                if (qty > 0 && qty <= AT_RISK_THRESHOLD) atRiskCount++;

                // Category snapshot
                const catName = inv.variant.product.category?.name || "Uncategorized";
                const hasWeight = parseFloat(inv.variant.weightKg || "0") > 0;
                const existing = categoryMap.get(catName);
                if (existing) {
                    existing.totalQty += qty;
                    if (hasWeight) existing.hasWeight = true;
                } else {
                    categoryMap.set(catName, { totalQty: qty, hasWeight });
                }

                // Product stock aggregation for top products
                const pid = inv.variant.product.id;
                const pEntry = productStockMap.get(pid);
                const weightKg = parseFloat(inv.variant.weightKg || "0");
                if (pEntry) {
                    pEntry.totalQty += qty;
                } else {
                    productStockMap.set(pid, {
                        name: inv.variant.product.name,
                        totalQty: qty,
                        unit: weightKg > 0 ? "KG" : "pcs",
                        image: inv.variant.product.image,
                    });
                }
            }

            // 3. Category snapshot — top 6 categories
            const categorySnapshot = Array.from(categoryMap.entries())
                .map(([name, data]) => ({
                    categoryName: name,
                    totalQty: Math.round(data.totalQty * 100) / 100,
                    unit: data.hasWeight ? "KG" : "pcs",
                }))
                .sort((a, b) => b.totalQty - a.totalQty)
                .slice(0, 6);

            // 4. Top products — top 5 by stock qty
            const topProducts = Array.from(productStockMap.values())
                .sort((a, b) => b.totalQty - a.totalQty)
                .slice(0, 5)
                .map((p) => ({
                    productName: p.name,
                    totalQty: Math.round(p.totalQty * 100) / 100,
                    unit: p.unit,
                    image: p.image,
                    status: p.totalQty > 20
                        ? ("high" as const)
                        : p.totalQty > 5
                            ? ("available" as const)
                            : ("low" as const),
                }));

            // 5. Damage alert — count active damage entries in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const [damageResult] = await db
                .select({ count: count() })
                .from(damageEntry)
                .where(
                    and(
                        eq(damageEntry.shopId, userId),
                        eq(damageEntry.status, "active"),
                        gte(damageEntry.createdAt, thirtyDaysAgo),
                    ),
                );

            return {
                // Main KPIs
                totalProducts: productSet.size,
                totalSKUs,
                totalStockValue: Math.round(totalStockValue * 100) / 100,

                // Stock Status
                inStockCount,
                lowStockCount,
                outOfStockCount,

                // Category Snapshot
                categorySnapshot,

                // Alert Summary
                alerts: {
                    lowStock: lowStockCount,
                    expiringSoon: 0, // No expiry field yet
                    damaged: damageResult?.count ?? 0,
                },

                // Top Products
                topProducts,

                // Insights
                insights: {
                    fastMoving: null as string | null,  // Needs sales data
                    slowMoving: null as string | null,  // Needs sales data
                    atRiskCount,
                },
            };
        }),

    /**
     * Real-time stock view grouped by product.
     * Shows pack (carton-packed) vs loose breakdown at product level,
     * with variant-level detail for the expanded view.
     */
    getRealtimeStock: shopOwnerProcedure
        .input(
            z.object({
                search: z.string().optional(),
                categoryId: z.number().int().optional(),
                status: z.enum(["all", "in_stock", "low", "out_of_stock"]).default("all"),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Fetch all inventory for this shop
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { id: true, name: true } },
                                },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            // 2. Group by product
            const LOW_STOCK_THRESHOLD = 5;

            type VariantDetail = {
                variantId: number;
                inventoryId: number;
                sku: string | null;
                brandName: string | null;
                weightKg: string;
                unitLabel: string;
                packType: string | null;
                pcsPerPack: number;
                availableQty: number;
                inCartonQty: number;
                looseQty: number;
                retailPrice: number;
            };

            type ProductGroup = {
                productId: number;
                productName: string;
                productImage: string | null;
                sku: string | null;
                categoryId: number | null;
                categoryName: string | null;
                totalAvailableQty: number;
                totalPackQty: number;
                totalLooseQty: number;
                looseUnit: string;
                variants: VariantDetail[];
            };

            const productMap = new Map<number, ProductGroup>();

            for (const inv of shopInventory) {
                if (!inv.variant?.product) continue;

                const prod = inv.variant.product;
                const pid = prod.id;
                const qty = parseFloat(inv.availableQty || "0");
                const cartonQty = parseFloat(inv.inCartonQty || "0");
                const isLoose = (inv.variant.packagingType || "").toLowerCase() === "loose";
                const retailPrice = parseFloat(inv.retailPrice || "0") || parseFloat(inv.variant.price || "0");

                // Pack variants: subtract in-carton qty so packs in cartons aren't double-counted
                // Loose variants: all qty counts as loose KG
                const uncartonedQty = Math.max(0, qty - cartonQty);
                const packQty = isLoose ? 0 : uncartonedQty;
                const looseQty = isLoose ? qty : 0;

                if (!productMap.has(pid)) {
                    productMap.set(pid, {
                        productId: pid,
                        productName: prod.name,
                        productImage: prod.image,
                        sku: prod.sku,
                        categoryId: prod.category?.id ?? null,
                        categoryName: prod.category?.name ?? null,
                        totalAvailableQty: 0,
                        totalPackQty: 0,
                        totalLooseQty: 0,
                        looseUnit: "KG",
                        variants: [],
                    });
                }

                const group = productMap.get(pid)!;
                group.totalAvailableQty += isLoose ? qty : uncartonedQty;
                group.totalPackQty += packQty;
                group.totalLooseQty += looseQty;

                group.variants.push({
                    variantId: inv.variant.id,
                    inventoryId: inv.id,
                    sku: inv.variant.sku,
                    brandName: inv.variant.brand?.name ?? null,
                    weightKg: inv.variant.weightKg,
                    unitLabel: isLoose ? "KG" : inv.variant.unitLabel,
                    packType: inv.variant.packagingType,
                    pcsPerPack: Number(inv.variant.packCountInside || 0),
                    availableQty: isLoose ? qty : uncartonedQty,
                    inCartonQty: cartonQty,
                    looseQty: isLoose ? qty : Math.max(0, qty - cartonQty),
                    retailPrice,
                });
            }

            // 3. Convert to array, apply filters
            let products = Array.from(productMap.values());

            // Search filter
            if (input.search?.trim()) {
                const s = input.search.toLowerCase();
                products = products.filter(
                    (p) =>
                        p.productName.toLowerCase().includes(s) ||
                        (p.sku && p.sku.toLowerCase().includes(s)) ||
                        p.variants.some((v) => v.sku?.toLowerCase().includes(s)) ||
                        p.variants.some((v) => v.brandName?.toLowerCase().includes(s)),
                );
            }

            // Category filter
            if (input.categoryId) {
                products = products.filter((p) => p.categoryId === input.categoryId);
            }

            // Status filter
            const withStatus = products.map((p) => {
                const status: "in_stock" | "low" | "out_of_stock" =
                    p.totalAvailableQty <= 0
                        ? "out_of_stock"
                        : p.totalAvailableQty <= LOW_STOCK_THRESHOLD
                            ? "low"
                            : "in_stock";
                return { ...p, status };
            });

            const filtered =
                input.status === "all"
                    ? withStatus
                    : withStatus.filter((p) => p.status === input.status);

            // 4. Derive unique categories for filter dropdown
            const categorySet = new Map<number, string>();
            for (const p of Array.from(productMap.values())) {
                if (p.categoryId && p.categoryName) {
                    categorySet.set(p.categoryId, p.categoryName);
                }
            }

            return {
                products: filtered.sort((a, b) => a.productName.localeCompare(b.productName)),
                categories: Array.from(categorySet.entries()).map(([id, name]) => ({ id, name })),
                totalCount: filtered.length,
            };
        }),

    /**
     * Low stock products — only products with variants below their reorderLevel.
     * Classifies as "low" or "critical" (≤ 50% of threshold).
     */
    getLowStockProducts: shopOwnerProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;
            const DEFAULT_THRESHOLD = 5;

            // Fetch inventory with variant + product + brand
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { id: true, name: true } },
                                },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            // Classify each variant
            type VariantInfo = {
                variantId: number;
                brandName: string | null;
                weightKg: string;
                unitLabel: string;
                availableQty: number;
                inCartonQty: number;
                looseQty: number;
                reorderLevel: number;
                status: "ok" | "low" | "critical" | "out_of_stock";
            };

            type ProductLow = {
                productId: number;
                productName: string;
                productImage: string | null;
                sku: string | null;
                totalStock: number;
                stockUnit: string;
                issueLabel: string;
                status: "low" | "critical";
                variants: VariantInfo[];
                minimumLevels: { label: string; minimum: number; unit: string }[];
                alertReasons: string[];
            };

            const productMap = new Map<number, ProductLow>();
            let criticalItems = 0;
            let totalShortage = 0;

            for (const inv of shopInventory) {
                if (!inv.variant?.product) continue;

                const prod = inv.variant.product;
                const pid = prod.id;
                const qty = parseFloat(inv.availableQty || "0");
                const cartonQty = parseFloat(inv.inCartonQty || "0");
                const threshold = inv.variant.reorderLevel > 0
                    ? inv.variant.reorderLevel
                    : (prod.reorderLevel > 0 ? prod.reorderLevel : DEFAULT_THRESHOLD);

                // Classify variant
                let variantStatus: "ok" | "low" | "critical" | "out_of_stock";
                if (qty <= 0) variantStatus = "out_of_stock";
                else if (qty <= threshold * 0.5) variantStatus = "critical";
                else if (qty <= threshold) variantStatus = "low";
                else variantStatus = "ok";

                // Skip healthy variants for the low stock page aggregation
                const isLow = variantStatus !== "ok";

                const variantInfo: VariantInfo = {
                    variantId: inv.variant.id,
                    brandName: inv.variant.brand?.name ?? null,
                    weightKg: inv.variant.weightKg,
                    unitLabel: inv.variant.unitLabel,
                    availableQty: qty,
                    inCartonQty: cartonQty,
                    looseQty: Math.max(0, qty - cartonQty),
                    reorderLevel: threshold,
                    status: variantStatus,
                };

                // Track KPI metrics for low/critical variants
                if (isLow) {
                    if (variantStatus === "critical") criticalItems++;
                    const shortage = Math.max(0, threshold - qty);
                    totalShortage += shortage;
                }

                // Group by product — include all variants for expanded detail
                if (!productMap.has(pid)) {
                    productMap.set(pid, {
                        productId: pid,
                        productName: prod.name,
                        productImage: prod.image,
                        sku: prod.sku,
                        totalStock: 0,
                        stockUnit: inv.variant.unitLabel || "pcs",
                        issueLabel: "",
                        status: "low",
                        variants: [],
                        minimumLevels: [],
                        alertReasons: [],
                    });
                }

                const group = productMap.get(pid)!;
                group.totalStock += qty;
                group.variants.push(variantInfo);

                // Build minimum level config
                const weightLabel = parseFloat(inv.variant.weightKg || "0") > 0
                    ? `${inv.variant.weightKg}KG`
                    : inv.variant.unitLabel;
                group.minimumLevels.push({
                    label: `${weightLabel} Variant`,
                    minimum: threshold,
                    unit: inv.variant.unitLabel || "Pack",
                });

                // Track alert reasons for low variants
                if (isLow) {
                    const reason = `${weightLabel} ${variantStatus === "critical" ? "Critical" : "Low"}`;
                    group.alertReasons.push(reason);
                }
            }

            // Filter to only products that have at least 1 low/critical variant
            const lowProducts: ProductLow[] = [];

            for (const group of productMap.values()) {
                const hasLowVariant = group.variants.some(
                    (v) => v.status === "low" || v.status === "critical" || v.status === "out_of_stock",
                );
                if (!hasLowVariant) continue;

                // Determine product-level status and issue label
                const hasCritical = group.variants.some((v) => v.status === "critical" || v.status === "out_of_stock");
                group.status = hasCritical ? "critical" : "low";

                // Build issue label from the most urgent variant
                const worstVariant = group.variants
                    .filter((v) => v.status !== "ok")
                    .sort((a, b) => {
                        const order = { out_of_stock: 0, critical: 1, low: 2, ok: 3 };
                        return order[a.status] - order[b.status];
                    })[0];

                if (worstVariant) {
                    const wt = parseFloat(worstVariant.weightKg || "0") > 0
                        ? `${worstVariant.weightKg}KG`
                        : worstVariant.unitLabel;
                    group.issueLabel = `${wt} ${worstVariant.status === "critical" ? "Critical" : "Low"}`;
                }

                lowProducts.push(group);
            }

            // Sort: critical first, then low
            lowProducts.sort((a, b) => {
                if (a.status === "critical" && b.status !== "critical") return -1;
                if (a.status !== "critical" && b.status === "critical") return 1;
                return a.productName.localeCompare(b.productName);
            });

            return {
                summary: {
                    lowProducts: lowProducts.length,
                    criticalItems,
                    totalShortage: Math.round(totalShortage),
                },
                products: lowProducts,
            };
        }),

    /**
     * Expired products — damage entries with type 'expired',
     * plus expiry-enabled products as a watchlist.
     */
    getExpiredProducts: shopOwnerProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // 1. Get all expired damage entries for this shop
            const expiredEntries = await db.query.damageEntry.findMany({
                where: and(
                    eq(damageEntry.shopId, userId),
                    eq(damageEntry.damageType, "expired"),
                    eq(damageEntry.status, "active"),
                ),
                with: {
                    items: {
                        with: {
                            variant: {
                                with: {
                                    product: {
                                        columns: { id: true, name: true, image: true, sku: true },
                                    },
                                    brand: { columns: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: [desc(damageEntry.entryDate)],
            });

            // 2. Group expired items by product
            type ExpiredVariant = {
                variantId: number;
                brandName: string | null;
                weightKg: string;
                unitLabel: string;
                qty: number;
                unitPrice: number;
                totalValue: number;
                entryDate: string;
            };

            type ExpiredProduct = {
                productId: number;
                productName: string;
                productImage: string | null;
                expiredQty: number;
                unit: string;
                lastExpiryDate: string;
                status: "expired";
                lossValue: number;
                variants: ExpiredVariant[];
            };

            const productMap = new Map<number, ExpiredProduct>();
            let totalLoss = 0;

            for (const entry of expiredEntries) {
                for (const item of entry.items) {
                    if (!item.variant?.product) continue;

                    const prod = item.variant.product;
                    const pid = prod.id;
                    const qty = item.qty;
                    const unitPrice = parseFloat(item.unitPrice || "0");
                    const totalValue = parseFloat(item.totalValue || "0");

                    totalLoss += totalValue;

                    if (!productMap.has(pid)) {
                        productMap.set(pid, {
                            productId: pid,
                            productName: prod.name,
                            productImage: prod.image,
                            expiredQty: 0,
                            unit: item.variant.unitLabel || "pcs",
                            lastExpiryDate: entry.entryDate,
                            status: "expired",
                            lossValue: 0,
                            variants: [],
                        });
                    }

                    const group = productMap.get(pid)!;
                    group.expiredQty += qty;
                    group.lossValue += totalValue;

                    // Keep the most recent entry date
                    if (entry.entryDate > group.lastExpiryDate) {
                        group.lastExpiryDate = entry.entryDate;
                    }

                    group.variants.push({
                        variantId: item.variant.id,
                        brandName: item.variant.brand?.name ?? null,
                        weightKg: item.variant.weightKg,
                        unitLabel: item.variant.unitLabel,
                        qty,
                        unitPrice,
                        totalValue,
                        entryDate: entry.entryDate,
                    });
                }
            }

            const expiredProducts = Array.from(productMap.values())
                .sort((a, b) => b.lastExpiryDate.localeCompare(a.lastExpiryDate));

            // 3. Get expiry-enabled products in shop inventory (watchlist)
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                columns: {
                                    id: true,
                                    name: true,
                                    image: true,
                                    expiryEnabled: true,
                                },
                            },
                        },
                    },
                },
            });

            const watchlistMap = new Map<number, {
                productId: number;
                productName: string;
                productImage: string | null;
                availableQty: number;
                unit: string;
                expiryEnabled: boolean;
                shelfLife: string | null;
            }>();

            for (const inv of shopInventory) {
                if (!inv.variant?.product?.expiryEnabled) continue;

                const prod = inv.variant.product;
                const pid = prod.id;
                const qty = parseFloat(inv.availableQty || "0");

                if (qty <= 0) continue;

                if (!watchlistMap.has(pid)) {
                    watchlistMap.set(pid, {
                        productId: pid,
                        productName: prod.name,
                        productImage: prod.image,
                        availableQty: 0,
                        unit: inv.variant.unitLabel || "pcs",
                        expiryEnabled: true,
                        shelfLife: inv.variant.shelfLife,
                    });
                }

                const w = watchlistMap.get(pid)!;
                w.availableQty += qty;
            }

            const expiryEnabledProducts = Array.from(watchlistMap.values());

            return {
                summary: {
                    expiredProducts: expiredProducts.length,
                    expiringSoon: expiryEnabledProducts.length,
                    lossValue: Math.round(totalLoss * 100) / 100,
                },
                expiredProducts,
                expiryEnabledProducts,
            };
        }),

    /**
     * Empty pack management — aggregates empty pack collections,
     * condition breakdown, and return tracking.
     */
    getEmptyPackSummary: shopOwnerProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // 1. Get all empty pack records linked to this shop's deliveries
            // empty_pack is delivery-scoped, so we need to find packs
            // from deliveries belonging to this shop owner
            const allPacks = await db.query.emptyPack.findMany({
                with: {
                    variant: {
                        with: {
                            product: {
                                columns: { id: true, name: true, image: true },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                    brand: { columns: { id: true, name: true } },
                },
            });

            // 2. Get pack rules for this shop
            const packRules = await db.query.productPackRule.findMany({
                where: and(
                    eq(productPackRule.ownerType, "shop"),
                    eq(productPackRule.ownerId, userId),
                    eq(productPackRule.isActive, true),
                ),
            });
            const ruleMap = new Map(packRules.map((r) => [r.productId, r]));

            // 3. Get return pack quantities from purchases
            const shopPurchases = await db.query.purchase.findMany({
                where: eq(purchase.warehouseId, userId),
                with: {
                    items: {
                        columns: { variantId: true, returnPackQty: true, productName: true },
                    },
                    supplier: { columns: { id: true, name: true, returnPackAgreement: true } },
                },
            });

            // Build return tracking from purchases
            const returnedByVariant = new Map<number, number>();
            const supplierByProduct = new Map<number, { name: string; hasAgreement: boolean }>();

            for (const p of shopPurchases) {
                for (const item of p.items) {
                    if (item.variantId && parseFloat(item.returnPackQty || "0") > 0) {
                        const prev = returnedByVariant.get(item.variantId) || 0;
                        returnedByVariant.set(item.variantId, prev + parseFloat(item.returnPackQty));
                    }
                }
                if (p.supplier) {
                    // We don't have productId directly, but we can track supplier info
                    for (const item of p.items) {
                        if (item.variantId) {
                            supplierByProduct.set(item.variantId, {
                                name: p.supplier.name,
                                hasAgreement: p.supplier.returnPackAgreement,
                            });
                        }
                    }
                }
            }

            // 4. Group empty packs by product
            type PackVariant = {
                variantId: number | null;
                brandName: string | null;
                packDescription: string;
                collected: number;
                verified: number;
                rejected: number;
                condition: "reusable" | "damaged" | "pending";
            };

            type PackProduct = {
                productId: number;
                productName: string;
                productImage: string | null;
                emptyQty: number;
                packType: string;
                isReturnable: boolean;
                status: "reusable" | "return_pending";
                variants: PackVariant[];
                totalCollected: number;
                totalVerified: number;
                totalRejected: number;
                totalReturned: number;
            };

            const productMap = new Map<number, PackProduct>();
            let totalPacks = 0;
            let returnPending = 0;
            let reusable = 0;

            for (const pack of allPacks) {
                const prod = pack.variant?.product;
                if (!prod) continue;

                const pid = prod.id;
                const qty = pack.quantityCollected;
                totalPacks += qty;

                if (pack.status === "verified") reusable += qty;
                else if (pack.status === "collected" || pack.status === "submitted") returnPending += qty;

                if (!productMap.has(pid)) {
                    const rule = ruleMap.get(pid);
                    productMap.set(pid, {
                        productId: pid,
                        productName: prod.name,
                        productImage: prod.image,
                        emptyQty: 0,
                        packType: pack.packDescription || "Pack",
                        isReturnable: rule?.isEmptyPackReturnable ?? (pack.variant?.isPackReturnRequired ?? false),
                        status: "reusable",
                        variants: [],
                        totalCollected: 0,
                        totalVerified: 0,
                        totalRejected: 0,
                        totalReturned: 0,
                    });
                }

                const group = productMap.get(pid)!;
                group.emptyQty += qty;
                group.totalCollected += qty;

                if (pack.status === "verified") group.totalVerified += qty;
                if (pack.status === "rejected") group.totalRejected += qty;

                // Add returned qty from purchases
                if (pack.variantId) {
                    group.totalReturned = returnedByVariant.get(pack.variantId) || 0;
                }

                const brandName = pack.brand?.name ?? pack.variant?.brand?.name ?? null;

                group.variants.push({
                    variantId: pack.variantId,
                    brandName,
                    packDescription: pack.packDescription || "Pack",
                    collected: qty,
                    verified: pack.status === "verified" ? qty : 0,
                    rejected: pack.status === "rejected" ? qty : 0,
                    condition: pack.status === "rejected" ? "damaged" :
                        pack.status === "verified" ? "reusable" : "pending",
                });
            }

            // Determine product-level status
            for (const group of productMap.values()) {
                const hasPending = group.variants.some((v) => v.condition === "pending");
                group.status = hasPending ? "return_pending" : "reusable";
            }

            const products = Array.from(productMap.values())
                .sort((a, b) => b.emptyQty - a.emptyQty);

            // 5. Build return tracking list
            const returnTracking = products
                .filter((p) => p.isReturnable && p.status === "return_pending")
                .map((p) => {
                    const firstVariant = p.variants[0];
                    const supplierInfo = firstVariant?.variantId
                        ? supplierByProduct.get(firstVariant.variantId)
                        : null;

                    return {
                        productId: p.productId,
                        productName: p.productName,
                        pendingReturn: p.totalCollected - p.totalReturned,
                        supplierName: supplierInfo?.name ?? null,
                        hasReturnAgreement: supplierInfo?.hasAgreement ?? false,
                    };
                })
                .filter((r) => r.pendingReturn > 0);

            return {
                summary: {
                    totalEmptyPacks: totalPacks,
                    returnPending,
                    reusableStock: reusable,
                },
                products,
                returnTracking,
            };
        }),

    /** B2B → B2C conversion history for the shop owner */
    getConversionHistory: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/conversion-history",
            tags: ["Shop Owner"],
            summary: "Get B2B to B2C stock conversion history",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Get all B2B orders for this shop
            const b2bOrders = await db.query.order.findMany({
                where: and(
                    eq(order.userId, userId),
                    eq(order.orderType, "b2b"),
                ),
                columns: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    createdAt: true,
                    deliveredAt: true,
                },
                with: {
                    items: {
                        columns: {
                            id: true,
                            productId: true,
                            variantId: true,
                            productName: true,
                            productImage: true,
                            productSize: true,
                            quantity: true,
                            unitPrice: true,
                            totalPrice: true,
                            supplyMode: true,
                            targetVariantId: true,
                            conversionStatus: true,
                            convertedQty: true,
                        },
                    },
                },
                orderBy: [desc(order.createdAt)],
            });

            // Build flat list of conversion items
            const conversionItems: {
                orderItemId: number;
                orderNumber: string;
                orderStatus: string;
                orderedAt: Date;
                deliveredAt: Date | null;
                productName: string;
                productImage: string;
                productSize: string;
                quantity: number;
                unitPrice: string;
                supplyMode: string | null;
                targetVariantId: number | null;
                conversionStatus: string | null;
                convertedQty: string | null;
            }[] = [];

            let totalConverted = 0;
            let totalPending = 0;
            let totalFailed = 0;

            for (const o of b2bOrders) {
                for (const item of o.items) {
                    const status = item.conversionStatus ?? (o.status === "delivered" ? "converted" : "pending");
                    if (status === "converted") totalConverted++;
                    else if (status === "failed") totalFailed++;
                    else totalPending++;

                    conversionItems.push({
                        orderItemId: item.id,
                        orderNumber: o.orderNumber,
                        orderStatus: o.status,
                        orderedAt: o.createdAt,
                        deliveredAt: o.deliveredAt,
                        productName: item.productName,
                        productImage: item.productImage,
                        productSize: item.productSize,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        supplyMode: item.supplyMode,
                        targetVariantId: item.targetVariantId,
                        conversionStatus: status,
                        convertedQty: item.convertedQty,
                    });
                }
            }

            return {
                summary: {
                    totalItems: conversionItems.length,
                    converted: totalConverted,
                    pending: totalPending,
                    failed: totalFailed,
                },
                items: conversionItems,
            };
        }),

    /**
     * Get shop owner's retail products (what they sell to consumers).
     * Shows RETAIL variants with inventory info.
     */
    getMyRetailProducts: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/retail-products",
            tags: ["Shop Owner"],
            summary: "Get shop owner retail product catalog",
        })
        .input(
            z.object({
                search: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;
            const { search, page, limit } = input;
            const offset = (page - 1) * limit;

            // Get inventory records for this shop owner
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { name: true, slug: true } },
                                    images: { limit: 1 },
                                    brand: { columns: { id: true, name: true } },
                                    productBrands: {
                                        with: {
                                            brand: { columns: { id: true, name: true } },
                                        },
                                    },
                                },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            // Filter by search if needed
            let filtered = shopInventory;
            if (search?.trim()) {
                const s = search.toLowerCase();
                filtered = shopInventory.filter(
                    (inv) =>
                        inv.variant?.product?.name?.toLowerCase().includes(s) ||
                        inv.variant?.sku?.toLowerCase().includes(s),
                );
            }

            const total = filtered.length;
            const paginated = filtered.slice(offset, offset + limit);

            return {
                items: paginated,
                pagination: {
                    page,
                    limit,
                    totalCount: total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }),

    /**
     * Get shop owner's inventory summary.
     */
    getMyInventory: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/inventory",
            tags: ["Shop Owner"],
            summary: "Get shop owner inventory",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const items = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { name: true } },
                                    images: { limit: 1 },
                                },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            return { items };
        }),

    /**
     * Get areas assigned to this shop owner.
     */
    getMyAssignedAreas: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/my-areas",
            tags: ["Shop Owner"],
            summary: "Get areas assigned to this shop owner",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const mappings = await db
                .select({
                    id: sellerAreaMapping.id,
                    areaId: sellerAreaMapping.areaId,
                    isActive: sellerAreaMapping.isActive,
                    overrideRadiusKm: sellerAreaMapping.overrideRadiusKm,
                    areaName: area.name,
                    areaSlug: area.slug,
                    areaDescription: area.description,
                    areaCenterLat: area.centerLat,
                    areaCenterLng: area.centerLng,
                    areaRadiusKm: area.radiusKm,
                })
                .from(sellerAreaMapping)
                .innerJoin(area, eq(sellerAreaMapping.areaId, area.id))
                .where(
                    and(
                        eq(sellerAreaMapping.sellerId, userId),
                        eq(sellerAreaMapping.isActive, true),
                        eq(area.isActive, true),
                    ),
                );

            return { areas: mappings };
        }),
};

// ────────────────────────────────────────────────────────────────
// Mutations (Shop Owner management actions)
// ────────────────────────────────────────────────────────────────

const mutations = {
    /**
     * Update retail selling price for a product in the shop owner's inventory.
     * Validates that the price meets the minimum margin requirement.
     */
    updateRetailPrice: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/update-price",
            tags: ["Shop Owner"],
            summary: "Update retail selling price for an inventory item",
        })
        .input(
            z.object({
                inventoryId: z.number(),
                retailPrice: z.string().refine(
                    (v) => !isNaN(Number(v)) && Number(v) > 0,
                    { message: "Price must be a positive number" },
                ),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;
            const newPrice = Number(input.retailPrice);

            // 1. Get the inventory record and verify ownership
            const invRecord = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.id, input.inventoryId),
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        columns: {
                            id: true,
                            price: true,             // base cost price
                            minMarginPercent: true,
                            minMarginAmount: true,
                            productId: true,
                        },
                    },
                },
            });

            if (!invRecord) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Inventory record not found or not owned by you",
                });
            }

            // 2. Validate minimum margin
            const basePrice = Number(invRecord.variant?.price || 0);
            const minMarginPercent = Number(invRecord.variant?.minMarginPercent || 0);
            const minMarginAmount = Number(invRecord.variant?.minMarginAmount || 0);

            let minimumPrice = basePrice;
            if (minMarginPercent > 0) {
                minimumPrice = basePrice * (1 + minMarginPercent / 100);
            }
            if (minMarginAmount > 0) {
                minimumPrice = Math.max(minimumPrice, basePrice + minMarginAmount);
            }

            if (newPrice < minimumPrice) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Price must be at least ৳${minimumPrice.toFixed(2)} (base ৳${basePrice.toFixed(2)} + required margin)`,
                });
            }

            // 3. Update the inventory record's retail price
            await db
                .update(inventory)
                .set({
                    retailPrice: input.retailPrice,
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, input.inventoryId));

            return {
                success: true,
                inventoryId: input.inventoryId,
                retailPrice: input.retailPrice,
            };
        }),

    /** Update shop location coordinates */
    updateShopLocation: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/update-location",
            tags: ["Shop Owner"],
            summary: "Update shop location (lat/lng)",
        })
        .input(
            z.object({
                lat: z.string().refine((v) => !isNaN(Number(v)), {
                    message: "Latitude must be a number",
                }),
                lng: z.string().refine((v) => !isNaN(Number(v)), {
                    message: "Longitude must be a number",
                }),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            await db
                .update(user)
                .set({
                    shopLat: input.lat,
                    shopLng: input.lng,
                })
                .where(eq(user.id, userId));

            return {
                success: true,
                message: "Shop location updated",
                location: { lat: input.lat, lng: input.lng },
            };
        }),

    // ── Purchase Order Actions ───────────────────────────────

    /**
     * Mark a purchase order as received by the shop owner.
     * Optionally adjust received quantities per item.
     * Triggers B2B → Retail inventory conversion.
     */
    markPurchaseReceived: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-orders/receive",
            tags: ["Shop Owner"],
            summary: "Mark a purchase order as received",
        })
        .input(
            z.object({
                orderId: z.number(),
                /** Optional per-item received quantities (null = accept all as ordered) */
                receivedItems: z
                    .array(
                        z.object({
                            itemId: z.number(),
                            receivedQty: z.number().min(0),
                        }),
                    )
                    .optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
                with: { items: true },
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            // Can only receive orders that are in delivery or already marked delivered by warehouse
            if (!["processing", "delivered"].includes(existingOrder.status)) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Cannot receive an order with status '${existingOrder.status}'`,
                });
            }

            if (existingOrder.receivedAt) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Order has already been received",
                });
            }

            await db.transaction(async (tx) => {
                // If received quantities provided, update items
                if (input.receivedItems && input.receivedItems.length > 0) {
                    for (const ri of input.receivedItems) {
                        const existingItem = existingOrder.items.find(
                            (i) => i.id === ri.itemId,
                        );
                        if (!existingItem) continue;

                        // Store the received qty as modifiedQty if different from ordered
                        const effectiveQty = existingItem.modifiedQty ?? existingItem.quantity;
                        if (ri.receivedQty !== effectiveQty) {
                            await tx
                                .update(orderItem)
                                .set({ modifiedQty: ri.receivedQty })
                                .where(eq(orderItem.id, ri.itemId));
                        }
                    }
                }

                // Mark as delivered (if not already) + received
                await tx
                    .update(order)
                    .set({
                        status: "delivered",
                        deliveredAt: existingOrder.deliveredAt || new Date(),
                        receivedAt: new Date(),
                    })
                    .where(eq(order.id, input.orderId));

                // Trigger B2B → Retail inventory conversion
                try {
                    await convertB2bOrderToRetailInventory(tx, input.orderId);
                } catch (err: any) {
                    console.error(`[RECEIVE-PO] B2B conversion failed for order #${input.orderId}:`, err);
                    // Don't rollback — still mark as received
                }
            });

            return {
                success: true,
                message: `Order ${existingOrder.orderNumber} received successfully`,
            };
        }),

    /**
     * Cancel a pending/confirmed purchase order.
     * Restores warehouse inventory for deducted items.
     */
    cancelPurchaseOrder: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-orders/cancel",
            tags: ["Shop Owner"],
            summary: "Cancel a purchase order",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
                with: { items: true },
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            if (!["pending", "confirmed"].includes(existingOrder.status)) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Cannot cancel an order with status '${existingOrder.status}'`,
                });
            }

            await db.transaction(async (tx) => {
                // Release approved reservation for confirmed orders.
                if (existingOrder.warehouseId && existingOrder.status === "confirmed") {
                    for (const item of existingOrder.items) {
                        if (!item.variantId) continue;
                        const qty = item.modifiedQty ?? item.quantity;
                        await tx
                            .update(inventory)
                            .set({
                                availableQty: sql`CAST(${inventory.availableQty} AS numeric) + ${qty}`,
                                reservedQty: sql`GREATEST(CAST(${inventory.reservedQty} AS numeric) - ${qty}, 0)`,
                            })
                            .where(
                                and(
                                    eq(inventory.ownerType, "warehouse"),
                                    eq(inventory.ownerId, existingOrder.warehouseId!),
                                    eq(inventory.variantId, item.variantId),
                                ),
                            );
                    }
                }

                // Update order status
                await tx
                    .update(order)
                    .set({
                        status: "cancelled",
                        cancelledAt: new Date(),
                    })
                    .where(eq(order.id, input.orderId));
            });

            return {
                success: true,
                message: `Order ${existingOrder.orderNumber} cancelled`,
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Order & Dashboard Queries
// ────────────────────────────────────────────────────────────────

const orderQueries = {
    /**
     * Get shop owner's own orders (B2B purchases from admin).
     */
    getMyOrders: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/my-orders",
            tags: ["Shop Owner"],
            summary: "Get shop owner's B2B purchase orders",
        })
        .input(
            z.object({
                status: z
                    .enum([
                        "pending",
                        "confirmed",
                        "processing",
                        "delivered",
                        "returned",
                        "cancelled",
                    ])
                    .optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const page = input.page;
            const limit = input.limit;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [eq(order.userId, userId)];
            if (input.status) conditions.push(eq(order.status, input.status));

            const where = and(...conditions);

            const [orders, countResult] = await Promise.all([
                db.query.order.findMany({
                    where,
                    with: {
                        items: {
                            columns: {
                                id: true,
                                productName: true,
                                productImage: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                            },
                        },
                    },
                    orderBy: [desc(order.createdAt)],
                    limit,
                    offset,
                }),
                db
                    .select({ count: count() })
                    .from(order)
                    .where(where),
            ]);

            const totalCount = countResult[0]?.count || 0;

            return {
                orders,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /**
     * Get dashboard summary stats for the shop owner.
     */

    // ── Purchase Orders (enhanced) ──────────────────────────────

    /**
     * Get shop owner's purchase orders with search, filters, and warehouse info.
     */
    getPurchaseOrders: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-orders",
            tags: ["Shop Owner"],
            summary: "Get purchase orders with search/filter/pagination",
        })
        .input(
            z.object({
                search: z.string().optional(),
                status: z
                    .enum([
                        "pending",
                        "confirmed",
                        "processing",
                        "delivered",
                        "cancelled",
                    ])
                    .optional(),
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { page, limit, search, status, dateFrom, dateTo } = input;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [eq(order.userId, userId)];

            if (status) conditions.push(eq(order.status, status));

            if (dateFrom) {
                conditions.push(gte(order.createdAt, new Date(dateFrom)));
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                conditions.push(lte(order.createdAt, toDate));
            }

            // Search by order number or product name
            if (search) {
                const s = `%${search}%`;
                // Get order IDs that match product name search
                const matchingOrderIds = await db
                    .select({ orderId: orderItem.orderId })
                    .from(orderItem)
                    .where(ilike(orderItem.productName, s));
                const orderIds = matchingOrderIds.map((r) => r.orderId);

                if (orderIds.length > 0) {
                    conditions.push(
                        or(
                            ilike(order.orderNumber, s),
                            inArray(order.id, orderIds),
                        )!,
                    );
                } else {
                    conditions.push(ilike(order.orderNumber, s));
                }
            }

            const where = and(...conditions);

            const [orders, countResult, kpiResult] = await Promise.all([
                db.query.order.findMany({
                    where,
                    with: {
                        items: {
                            columns: {
                                id: true,
                                productName: true,
                                productImage: true,
                                productSize: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                                modifiedQty: true,
                                modifiedUnitPrice: true,
                            },
                        },
                    },
                    orderBy: [desc(order.createdAt)],
                    limit,
                    offset,
                }),
                db
                    .select({ count: count() })
                    .from(order)
                    .where(where),
                // KPI aggregation
                db
                    .select({
                        totalOrders: count(),
                        pendingCount: sql<number>`count(*) filter (where ${order.status} = 'pending')`.as("pending_count"),
                        confirmedCount: sql<number>`count(*) filter (where ${order.status} = 'confirmed')`.as("confirmed_count"),
                        processingCount: sql<number>`count(*) filter (where ${order.status} = 'processing')`.as("processing_count"),
                        deliveredCount: sql<number>`count(*) filter (where ${order.status} = 'delivered')`.as("delivered_count"),
                        cancelledCount: sql<number>`count(*) filter (where ${order.status} = 'cancelled')`.as("cancelled_count"),
                        totalAmount: sql<string>`coalesce(sum(${order.total}), 0)`.as("total_amount"),
                        pendingAmount: sql<string>`coalesce(sum(case when ${order.status} in ('pending','confirmed','processing') then ${order.total} else 0 end), 0)`.as("pending_amount"),
                    })
                    .from(order)
                    .where(eq(order.userId, userId)),
            ]);

            const totalCount = countResult[0]?.count || 0;
            const kpi = kpiResult[0];

            // Resolve warehouse names for orders that have warehouseId
            const warehouseIds = [...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean))];
            let warehouseMap: Record<string, string> = {};
            if (warehouseIds.length > 0) {
                const warehouses = await db
                    .select({ id: user.id, name: user.name, shopName: user.shopName })
                    .from(user)
                    .where(inArray(user.id, warehouseIds));
                for (const w of warehouses) {
                    warehouseMap[w.id] = w.shopName || w.name;
                }
            }

            const enrichedOrders = orders.map((o: any) => ({
                ...o,
                warehouseName: o.warehouseId ? (warehouseMap[o.warehouseId] || "Unknown") : "Admin",
            }));

            return {
                orders: enrichedOrders,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
                kpi: {
                    totalOrders: kpi?.totalOrders || 0,
                    pendingCount: Number(kpi?.pendingCount) || 0,
                    confirmedCount: Number(kpi?.confirmedCount) || 0,
                    processingCount: Number(kpi?.processingCount) || 0,
                    deliveredCount: Number(kpi?.deliveredCount) || 0,
                    cancelledCount: Number(kpi?.cancelledCount) || 0,
                    totalAmount: kpi?.totalAmount || "0",
                    pendingAmount: kpi?.pendingAmount || "0",
                },
            };
        }),

    /**
     * Get full details for a single purchase order.
     */
    getPurchaseOrderDetail: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-order-detail",
            tags: ["Shop Owner"],
            summary: "Get full detail for a single purchase order",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const result = await db.query.order.findFirst({
                where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
                with: {
                    items: {
                        with: {
                            product: {
                                columns: { id: true, name: true, image: true },
                            },
                            variant: {
                                columns: {
                                    id: true,
                                    sku: true,
                                    weightKg: true,
                                    unitLabel: true,
                                    packType: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!result) {
                throw new ORPCError("NOT_FOUND", { message: "Purchase order not found" });
            }

            // Resolve warehouse info
            let warehouseInfo: { name: string; phone: string | null; shopName: string | null } | null = null;
            if (result.warehouseId) {
                const wh = await db
                    .select({
                        name: user.name,
                        phone: user.phoneNumber,
                        shopName: user.shopName,
                    })
                    .from(user)
                    .where(eq(user.id, result.warehouseId))
                    .limit(1);
                if (wh[0]) warehouseInfo = wh[0];
            }

            // Build status timeline
            const timeline = [
                { step: "Placed", date: result.createdAt, completed: true },
                {
                    step: "Confirmed",
                    date: result.confirmedAt,
                    completed: !!result.confirmedAt,
                },
                {
                    step: "Modified",
                    date: result.modifiedByWarehouseAt,
                    completed: !!result.modifiedByWarehouseAt,
                    isModification: true,
                },
                {
                    step: "Dispatched",
                    date: result.shippedAt,
                    completed: !!result.shippedAt,
                },
                {
                    step: "Delivered",
                    date: result.deliveredAt,
                    completed: !!result.deliveredAt,
                },
                {
                    step: "Received",
                    date: result.receivedAt,
                    completed: !!result.receivedAt,
                },
            ].filter((t) => !t.isModification || t.completed); // Only show "Modified" if it actually happened

            // Check if any items were modified
            const hasModifications = result.items.some(
                (item: any) => item.modifiedQty !== null || item.modifiedUnitPrice !== null,
            );

            return {
                order: {
                    ...result,
                    warehouseName: warehouseInfo?.shopName || warehouseInfo?.name || "Admin",
                    warehousePhone: warehouseInfo?.phone || null,
                },
                timeline,
                hasModifications,
                delivery: {
                    trackingId: result.trackingId,
                    riderName: result.riderName,
                    riderPhone: result.riderPhone,
                },
            };
        }),

    // ── Purchase Order Tracking ──────────────────────────────

    /**
     * Get purchase orders with tracking-focused data:
     * ordered vs received quantities, modification flags, 8-step timeline, alerts.
     */
    getPurchaseTracking: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-tracking",
            tags: ["Shop Owner"],
            summary: "Get purchase orders with tracking data",
        })
        .input(
            z.object({
                search: z.string().optional(),
                status: z
                    .enum([
                        "pending",
                        "confirmed",
                        "processing",
                        "delivered",
                        "cancelled",
                    ])
                    .optional(),
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { page, limit, search, status, dateFrom, dateTo } = input;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [eq(order.userId, userId)];

            if (status) conditions.push(eq(order.status, status));
            if (dateFrom) conditions.push(gte(order.createdAt, new Date(dateFrom)));
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                conditions.push(lte(order.createdAt, toDate));
            }

            if (search) {
                const s = `%${search}%`;
                const matchingOrderIds = await db
                    .select({ orderId: orderItem.orderId })
                    .from(orderItem)
                    .where(ilike(orderItem.productName, s));
                const orderIds = matchingOrderIds.map((r) => r.orderId);
                if (orderIds.length > 0) {
                    conditions.push(
                        or(ilike(order.orderNumber, s), inArray(order.id, orderIds))!,
                    );
                } else {
                    conditions.push(ilike(order.orderNumber, s));
                }
            }

            const where = and(...conditions);

            const [orders, countResult] = await Promise.all([
                db.query.order.findMany({
                    where,
                    with: {
                        items: {
                            columns: {
                                id: true,
                                productName: true,
                                productImage: true,
                                productSize: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                                modifiedQty: true,
                                modifiedUnitPrice: true,
                                deliveredQty: true,
                            },
                        },
                    },
                    orderBy: [desc(order.createdAt)],
                    limit,
                    offset,
                }),
                db.select({ count: count() }).from(order).where(where),
            ]);

            const totalCount = countResult[0]?.count || 0;

            // Resolve warehouse names
            const warehouseIds = [...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean))];
            let warehouseMap: Record<string, string> = {};
            if (warehouseIds.length > 0) {
                const warehouses = await db
                    .select({ id: user.id, name: user.name, shopName: user.shopName })
                    .from(user)
                    .where(inArray(user.id, warehouseIds));
                for (const w of warehouses) {
                    warehouseMap[w.id] = w.shopName || w.name;
                }
            }

            // Build tracking data for each order
            const trackingOrders = orders.map((o: any) => {
                const totalOrdered = o.items.reduce((s: number, i: any) => s + (i.modifiedQty ?? i.quantity), 0);
                const totalDelivered = o.items.reduce((s: number, i: any) => s + (i.deliveredQty || 0), 0);
                const isModified = !!o.modifiedByWarehouseAt;
                const needsApproval = isModified && !o.modificationAcceptedAt && !o.modificationRejectedAt && o.status !== "cancelled";

                // Build 8-step timeline
                const timeline = [
                    { step: "Placed", date: o.createdAt, completed: true },
                    { step: "Modified", date: o.modifiedByWarehouseAt, completed: !!o.modifiedByWarehouseAt, isModification: true },
                    { step: "Accepted", date: o.modificationAcceptedAt || o.confirmedAt, completed: !!o.confirmedAt || !!o.modificationAcceptedAt },
                    { step: "Processing", date: o.processingStartedAt, completed: !!o.processingStartedAt || o.status === "processing" || o.status === "delivered" },
                    { step: "Packing", date: o.packingStartedAt, completed: !!o.packingStartedAt },
                    { step: "Ready", date: o.readyAt, completed: !!o.readyAt },
                    { step: "Delivered", date: o.deliveredAt, completed: !!o.deliveredAt || o.status === "delivered" },
                    { step: "Received", date: o.receivedAt, completed: !!o.receivedAt },
                ].filter((t) => !t.isModification || t.completed);

                return {
                    ...o,
                    warehouseName: o.warehouseId ? (warehouseMap[o.warehouseId] || "Unknown") : "Admin",
                    tracking: {
                        totalOrdered,
                        totalDelivered,
                        remaining: totalOrdered - totalDelivered,
                        deliveryProgress: totalOrdered > 0 ? Math.round((totalDelivered / totalOrdered) * 100) : 0,
                        isPartialDelivery: totalDelivered > 0 && totalDelivered < totalOrdered,
                    },
                    modification: {
                        isModified,
                        needsApproval,
                        acceptedAt: o.modificationAcceptedAt,
                        rejectedAt: o.modificationRejectedAt,
                    },
                    timeline,
                };
            });

            // Alerts / Insights
            const allUserOrders = await db
                .select({
                    modifiedCount: sql<number>`count(*) filter (where ${order.modifiedByWarehouseAt} is not null and ${order.modificationAcceptedAt} is null and ${order.modificationRejectedAt} is null and ${order.status} != 'cancelled')`.as("mc"),
                    pendingApprovals: sql<number>`count(*) filter (where ${order.status} = 'pending')`.as("pa"),
                    totalActive: sql<number>`count(*) filter (where ${order.status} not in ('delivered', 'cancelled'))`.as("ta"),
                })
                .from(order)
                .where(eq(order.userId, userId));

            const alerts = {
                modifiedOrders: Number(allUserOrders[0]?.modifiedCount) || 0,
                pendingApprovals: Number(allUserOrders[0]?.pendingApprovals) || 0,
                totalActive: Number(allUserOrders[0]?.totalActive) || 0,
            };

            return {
                orders: trackingOrders,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
                alerts,
            };
        }),

    /**
     * Retailer accepts wholesaler's quantity modifications.
     */
    acceptPurchaseModification: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-orders/accept-modification",
            tags: ["Shop Owner"],
            summary: "Accept wholesaler modifications",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            if (!existingOrder.modifiedByWarehouseAt) {
                throw new ORPCError("BAD_REQUEST", { message: "This order has no modifications to accept" });
            }

            if (existingOrder.modificationAcceptedAt || existingOrder.modificationRejectedAt) {
                throw new ORPCError("BAD_REQUEST", { message: "Modification already resolved" });
            }

            await db
                .update(order)
                .set({
                    modificationAcceptedAt: new Date(),
                    confirmedAt: existingOrder.confirmedAt || new Date(),
                    status: "confirmed",
                })
                .where(eq(order.id, input.orderId));

            return {
                success: true,
                message: `Modifications accepted for ${existingOrder.orderNumber}`,
            };
        }),

    /**
     * Retailer rejects wholesaler's modifications → order cancelled, inventory restored.
     */
    rejectPurchaseModification: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-orders/reject-modification",
            tags: ["Shop Owner"],
            summary: "Reject wholesaler modifications and cancel order",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
                with: { items: true },
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            if (!existingOrder.modifiedByWarehouseAt) {
                throw new ORPCError("BAD_REQUEST", { message: "This order has no modifications to reject" });
            }

            if (existingOrder.modificationAcceptedAt || existingOrder.modificationRejectedAt) {
                throw new ORPCError("BAD_REQUEST", { message: "Modification already resolved" });
            }

            await db.transaction(async (tx) => {
                // Release the approved reservation created by warehouse review.
                if (existingOrder.warehouseId) {
                    for (const item of existingOrder.items) {
                        if (!item.variantId) continue;
                        const qty = item.modifiedQty ?? item.quantity;
                        await tx
                            .update(inventory)
                            .set({
                                availableQty: sql`CAST(${inventory.availableQty} AS numeric) + ${qty}`,
                                reservedQty: sql`GREATEST(CAST(${inventory.reservedQty} AS numeric) - ${qty}, 0)`,
                            })
                            .where(
                                and(
                                    eq(inventory.ownerType, "warehouse"),
                                    eq(inventory.ownerId, existingOrder.warehouseId!),
                                    eq(inventory.variantId, item.variantId),
                                ),
                            );
                    }
                }

                await tx
                    .update(order)
                    .set({
                        modificationRejectedAt: new Date(),
                        status: "cancelled",
                        cancelledAt: new Date(),
                    })
                    .where(eq(order.id, input.orderId));
            });

            return {
                success: true,
                message: `Modifications rejected, order ${existingOrder.orderNumber} cancelled`,
            };
        }),

    // ── Purchase History ─────────────────────────────────────

    /**
     * Get completed/past purchase orders with stock impact, payment info,
     * invoice data, and 7-day trend.
     */
    getPurchaseHistory: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/purchase-history",
            tags: ["Shop Owner"],
            summary: "Get purchase history with stock impact and trends",
        })
        .input(
            z.object({
                search: z.string().optional(),
                status: z.enum(["delivered", "cancelled", "returned"]).optional(),
                warehouseId: z.string().optional(),
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { page, limit, search, status, warehouseId, dateFrom, dateTo } = input;
            const offset = (page - 1) * limit;

            // Only completed statuses
            const conditions: SQL[] = [
                eq(order.userId, userId),
                inArray(order.status, ["delivered", "cancelled", "returned"]),
            ];

            if (status) conditions.push(eq(order.status, status));
            if (warehouseId) conditions.push(eq(order.warehouseId, warehouseId));
            if (dateFrom) conditions.push(gte(order.createdAt, new Date(dateFrom)));
            if (dateTo) {
                const d = new Date(dateTo);
                d.setHours(23, 59, 59, 999);
                conditions.push(lte(order.createdAt, d));
            }

            if (search) {
                const s = `%${search}%`;
                const matchingIds = await db
                    .select({ orderId: orderItem.orderId })
                    .from(orderItem)
                    .where(ilike(orderItem.productName, s));
                const ids = matchingIds.map((r) => r.orderId);
                if (ids.length > 0) {
                    conditions.push(or(ilike(order.orderNumber, s), inArray(order.id, ids))!);
                } else {
                    conditions.push(ilike(order.orderNumber, s));
                }
            }

            const where = and(...conditions);

            const [orders, countResult] = await Promise.all([
                db.query.order.findMany({
                    where,
                    with: {
                        items: {
                            columns: {
                                id: true,
                                productName: true,
                                productImage: true,
                                productSize: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                                modifiedQty: true,
                                modifiedUnitPrice: true,
                                deliveredQty: true,
                                convertedQty: true,
                            },
                        },
                    },
                    orderBy: [desc(order.createdAt)],
                    limit,
                    offset,
                }),
                db.select({ count: count() }).from(order).where(where),
            ]);

            const totalCount = countResult[0]?.count || 0;

            // Resolve warehouse names
            const whIds = [...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean))];
            let whMap: Record<string, string> = {};
            if (whIds.length > 0) {
                const whs = await db
                    .select({ id: user.id, name: user.name, shopName: user.shopName })
                    .from(user)
                    .where(inArray(user.id, whIds));
                for (const w of whs) whMap[w.id] = w.shopName || w.name;
            }

            // Fetch invoices for these orders
            const orderIds = orders.map((o: any) => o.id);
            let invoiceMap: Record<number, string> = {};
            if (orderIds.length > 0) {
                const invoices = await db
                    .select({ orderId: invoice.orderId, invoiceNumber: invoice.invoiceNumber })
                    .from(invoice)
                    .where(inArray(invoice.orderId, orderIds));
                for (const inv of invoices) invoiceMap[inv.orderId] = inv.invoiceNumber;
            }

            // Build history records
            const historyOrders = orders.map((o: any) => {
                const totalQty = o.items.reduce((s: number, i: any) => s + (i.modifiedQty ?? i.quantity), 0);
                const totalAmount = o.items.reduce((s: number, i: any) => {
                    const qty = i.modifiedQty ?? i.quantity;
                    const price = i.modifiedUnitPrice ?? i.unitPrice;
                    return s + qty * Number(price);
                }, 0);

                // Stock impact
                const stockImpact = o.items.map((item: any) => {
                    const qty = item.modifiedQty ?? item.quantity;
                    if (o.status === "delivered") {
                        return { product: item.productName, change: `+${qty}`, type: "added" };
                    } else if (o.status === "cancelled") {
                        return { product: item.productName, change: "0", type: "no_impact" };
                    } else {
                        return { product: item.productName, change: `-${qty}`, type: "returned" };
                    }
                });

                return {
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    createdAt: o.createdAt,
                    deliveredAt: o.deliveredAt,
                    receivedAt: o.receivedAt,
                    cancelledAt: o.cancelledAt,
                    paymentMethod: o.paymentMethod,
                    paymentStatus: o.paymentStatus,
                    total: o.total,
                    subtotal: o.subtotal,
                    warehouseName: o.warehouseId ? (whMap[o.warehouseId] || "Unknown") : "Admin",
                    invoiceNumber: invoiceMap[o.id] || null,
                    items: o.items,
                    totalQty,
                    totalAmount,
                    stockImpact,
                };
            });

            // 7-day purchase trend
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const trendData = await db
                .select({
                    day: sql<string>`TO_CHAR(${order.createdAt}, 'YYYY-MM-DD')`.as("day"),
                    orderCount: count(),
                    totalAmount: sql<number>`COALESCE(SUM(CAST(${order.total} AS numeric)), 0)`.as("total_amount"),
                })
                .from(order)
                .where(
                    and(
                        eq(order.userId, userId),
                        inArray(order.status, ["delivered", "cancelled", "returned"]),
                        gte(order.createdAt, sevenDaysAgo),
                    ),
                )
                .groupBy(sql`TO_CHAR(${order.createdAt}, 'YYYY-MM-DD')`)
                .orderBy(sql`TO_CHAR(${order.createdAt}, 'YYYY-MM-DD')`);

            // Fill missing days
            const trend: { day: string; label: string; orders: number; amount: number }[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(sevenDaysAgo);
                d.setDate(d.getDate() + i);
                const key = d.toISOString().split("T")[0]!;
                const match = trendData.find((t) => t.day === key);
                trend.push({
                    day: key,
                    label: d.toLocaleDateString("en-BD", { weekday: "short" }),
                    orders: match ? Number(match.orderCount) : 0,
                    amount: match ? Number(match.totalAmount) : 0,
                });
            }

            // Distinct wholesalers for filter dropdown
            const wholesalers = Object.entries(whMap).map(([id, name]) => ({ id, name }));

            return {
                orders: historyOrders,
                pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
                trend,
                wholesalers,
            };
        }),

    // ── Supplier Management ──────────────────────────────────

    /**
     * List active platform-connected suppliers with network insights.
     */
    getConnectedSuppliers: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/connected-suppliers",
            tags: ["Shop Owner"],
            summary: "List connected suppliers from the platform network",
        })
        .input(
            z.object({
                search: z.string().optional(),
                status: z.enum(["all", "active", "inactive"]).default("all"),
                category: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            const connections = await db
                .select({
                    connectionId: shopWarehouseConnection.id,
                    warehouseId: user.id,
                    warehouseName: user.warehouseName,
                    warehouseSlug: user.warehouseSlug,
                    warehouseAddress: user.warehouseAddress,
                    name: user.name,
                    phone: user.phoneNumber,
                    email: user.email,
                    image: user.image,
                    connectedAt: shopWarehouseConnection.connectedAt,
                    lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                })
                .from(shopWarehouseConnection)
                .innerJoin(user, eq(shopWarehouseConnection.warehouseId, user.id))
                .where(
                    and(
                        eq(shopWarehouseConnection.shopId, shopId),
                        eq(shopWarehouseConnection.status, "active"),
                    ),
                )
                .orderBy(
                    desc(shopWarehouseConnection.lastOrderedAt),
                    desc(shopWarehouseConnection.connectedAt),
                );

            if (connections.length === 0) {
                return {
                    summary: {
                        connectedSuppliers: 0,
                        activeSuppliers: 0,
                        totalPurchase: 0,
                    },
                    categories: [],
                    suppliers: [],
                };
            }

            const warehouseIds = connections.map((connection) => connection.warehouseId);

            const orderRows = await db
                .select({
                    warehouseId: order.warehouseId,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    total: order.total,
                    createdAt: order.createdAt,
                    invoicePaymentStatus: invoice.paymentStatus,
                })
                .from(order)
                .leftJoin(
                    invoice,
                    and(eq(invoice.orderId, order.id), eq(invoice.invoiceType, "main")),
                )
                .where(
                    and(
                        eq(order.userId, shopId),
                        inArray(order.warehouseId, warehouseIds),
                    ),
                );

            const supplierOrderMap = new Map<
                string,
                {
                    totalOrders: number;
                    totalPurchase: number;
                    totalPaid: number;
                    totalDue: number;
                    pendingOrders: number;
                    lastPurchaseDate: Date | null;
                }
            >();

            for (const warehouseId of warehouseIds) {
                supplierOrderMap.set(warehouseId, {
                    totalOrders: 0,
                    totalPurchase: 0,
                    totalPaid: 0,
                    totalDue: 0,
                    pendingOrders: 0,
                    lastPurchaseDate: null,
                });
            }

            for (const row of orderRows) {
                const warehouseId = row.warehouseId;
                if (!warehouseId) continue;

                const current = supplierOrderMap.get(warehouseId);
                if (!current) continue;

                const total = toSafeNumber(row.total);
                current.totalOrders += 1;

                if (
                    !current.lastPurchaseDate
                    || (row.createdAt && row.createdAt > current.lastPurchaseDate)
                ) {
                    current.lastPurchaseDate = row.createdAt;
                }

                if (["pending", "confirmed", "processing"].includes(row.status)) {
                    current.pendingOrders += 1;
                }

                if (isPurchaseOrderStatus(row.status)) {
                    current.totalPurchase += total;
                }

                if (isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)) {
                    current.totalPaid += total;
                }

                if (
                    isPayableOrder(
                        row.status,
                        row.paymentStatus,
                        row.invoicePaymentStatus,
                    )
                ) {
                    current.totalDue += total;
                }
            }

            const inventoryCategoryRows = await db
                .select({
                    warehouseId: inventory.ownerId,
                    categoryName: category.name,
                    itemCount: count(),
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .innerJoin(category, eq(product.categoryId, category.id))
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        inArray(inventory.ownerId, warehouseIds),
                        sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
                    ),
                )
                .groupBy(inventory.ownerId, category.name);

            const orderedCategoryRows = await db
                .select({
                    warehouseId: order.warehouseId,
                    categoryName: category.name,
                    itemCount: count(),
                })
                .from(orderItem)
                .innerJoin(order, eq(orderItem.orderId, order.id))
                .innerJoin(product, eq(orderItem.productId, product.id))
                .innerJoin(category, eq(product.categoryId, category.id))
                .where(
                    and(
                        eq(order.userId, shopId),
                        inArray(order.warehouseId, warehouseIds),
                    ),
                )
                .groupBy(order.warehouseId, category.name);

            const inventoryCategoryMap = new Map<
                string,
                { categoryName: string; itemCount: number }
            >();
            for (const row of inventoryCategoryRows) {
                const current = inventoryCategoryMap.get(row.warehouseId);
                const nextCount = Number(row.itemCount || 0);
                if (!current || nextCount > current.itemCount) {
                    inventoryCategoryMap.set(row.warehouseId, {
                        categoryName: row.categoryName,
                        itemCount: nextCount,
                    });
                }
            }

            const orderedCategoryMap = new Map<
                string,
                { categoryName: string; itemCount: number }
            >();
            for (const row of orderedCategoryRows) {
                if (!row.warehouseId) continue;

                const current = orderedCategoryMap.get(row.warehouseId);
                const nextCount = Number(row.itemCount || 0);
                if (!current || nextCount > current.itemCount) {
                    orderedCategoryMap.set(row.warehouseId, {
                        categoryName: row.categoryName,
                        itemCount: nextCount,
                    });
                }
            }

            const allSuppliers = connections.map((connection) => {
                const orderSummary = supplierOrderMap.get(connection.warehouseId) ?? {
                    totalOrders: 0,
                    totalPurchase: 0,
                    totalPaid: 0,
                    totalDue: 0,
                    pendingOrders: 0,
                    lastPurchaseDate: null,
                };
                const primaryCategory = inventoryCategoryMap.get(connection.warehouseId)
                    ?.categoryName
                    || orderedCategoryMap.get(connection.warehouseId)?.categoryName
                    || null;
                const activityStatus = getConnectedSupplierActivityStatus(
                    orderSummary.lastPurchaseDate,
                    connection.connectedAt,
                    orderSummary.pendingOrders,
                );

                return {
                    connectionId: connection.connectionId,
                    warehouseId: connection.warehouseId,
                    warehouseSlug: connection.warehouseSlug,
                    name:
                        connection.warehouseName
                        || connection.name
                        || "Connected Supplier",
                    phone: connection.phone,
                    email: connection.email,
                    address: connection.warehouseAddress,
                    image: connection.image,
                    primaryCategory,
                    activityStatus,
                    totalOrders: orderSummary.totalOrders,
                    totalPurchase: orderSummary.totalPurchase,
                    totalPaid: orderSummary.totalPaid,
                    totalDue: orderSummary.totalDue,
                    pendingOrders: orderSummary.pendingOrders,
                    lastPurchaseDate: orderSummary.lastPurchaseDate,
                    connectedAt: connection.connectedAt,
                    lastOrderedAt: connection.lastOrderedAt,
                };
            });

            const summary = {
                connectedSuppliers: allSuppliers.length,
                activeSuppliers: allSuppliers.filter(
                    (supplier) => supplier.activityStatus === "active",
                ).length,
                totalPurchase: allSuppliers.reduce(
                    (total, supplier) => total + supplier.totalPurchase,
                    0,
                ),
            };

            const categories = [...new Set(
                allSuppliers
                    .map((supplier) => supplier.primaryCategory)
                    .filter((value): value is string => Boolean(value)),
            )].sort((a, b) => a.localeCompare(b));

            let suppliers = allSuppliers;

            if (input.search?.trim()) {
                const search = input.search.trim().toLowerCase();
                suppliers = suppliers.filter((supplier) =>
                    [
                        supplier.name,
                        supplier.phone,
                        supplier.email,
                        supplier.address,
                        supplier.primaryCategory,
                    ]
                        .filter(Boolean)
                        .some((value) => value!.toLowerCase().includes(search)),
                );
            }

            if (input.status !== "all") {
                suppliers = suppliers.filter(
                    (supplier) => supplier.activityStatus === input.status,
                );
            }

            if (input.category?.trim()) {
                const categoryFilter = input.category.trim().toLowerCase();
                suppliers = suppliers.filter(
                    (supplier) =>
                        supplier.primaryCategory?.toLowerCase() === categoryFilter,
                );
            }

            suppliers = suppliers.sort((a, b) => {
                if (a.activityStatus !== b.activityStatus) {
                    return a.activityStatus === "active" ? -1 : 1;
                }

                if (b.totalPurchase !== a.totalPurchase) {
                    return b.totalPurchase - a.totalPurchase;
                }

                return (
                    (b.lastPurchaseDate?.getTime()
                        || b.lastOrderedAt?.getTime()
                        || b.connectedAt?.getTime()
                        || 0)
                    - (a.lastPurchaseDate?.getTime()
                        || a.lastOrderedAt?.getTime()
                        || a.connectedAt?.getTime()
                        || 0)
                );
            });

            return {
                summary,
                categories,
                suppliers,
            };
        }),

    /**
     * Full detail for a platform-connected supplier.
     */
    getConnectedSupplierDetail: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/connected-supplier-detail",
            tags: ["Shop Owner"],
            summary: "Get a connected supplier network profile",
        })
        .input(z.object({ warehouseId: z.string() }))
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;
            const warehouseId = input.warehouseId;

            const [shopUser] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    shopName: user.shopName,
                    shopAddress: user.shopAddress,
                    serviceArea: user.serviceArea,
                })
                .from(user)
                .where(eq(user.id, shopId))
                .limit(1);

            const [warehouseUser] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    warehouseName: user.warehouseName,
                    warehouseSlug: user.warehouseSlug,
                    phoneNumber: user.phoneNumber,
                    email: user.email,
                    image: user.image,
                    address: user.warehouseAddress,
                })
                .from(user)
                .where(eq(user.id, warehouseId))
                .limit(1);

            const [connection] = await db
                .select({
                    status: shopWarehouseConnection.status,
                    connectedAt: shopWarehouseConnection.connectedAt,
                    lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                })
                .from(shopWarehouseConnection)
                .where(
                    and(
                        eq(shopWarehouseConnection.shopId, shopId),
                        eq(shopWarehouseConnection.warehouseId, warehouseId),
                        eq(shopWarehouseConnection.status, "active"),
                    ),
                )
                .limit(1);

            if (!warehouseUser || !connection) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Connected supplier not found",
                });
            }

            const [warehouseProfile] = await db
                .select({
                    status: warehouseApplication.status,
                    tradeLicenseNumber: warehouseApplication.tradeLicenseNumber,
                    businessCategory: warehouseApplication.businessCategory,
                    yearsInBusiness: warehouseApplication.yearsInBusiness,
                    area: warehouseApplication.area,
                    district: warehouseApplication.district,
                    division: warehouseApplication.division,
                    documents: warehouseApplication.documents,
                    updatedAt: warehouseApplication.updatedAt,
                })
                .from(warehouseApplication)
                .where(eq(warehouseApplication.userId, warehouseId))
                .orderBy(desc(warehouseApplication.updatedAt))
                .limit(1);

            const supplierOrders = await db
                .select({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    total: order.total,
                    createdAt: order.createdAt,
                    deliveredAt: order.deliveredAt,
                    modifiedByWarehouseAt: order.modifiedByWarehouseAt,
                    shippingAddress: order.shippingAddress,
                    shippingCity: order.shippingCity,
                    shippingArea: order.shippingArea,
                    invoicePaymentStatus: invoice.paymentStatus,
                    invoiceDeliveryStatus: invoice.deliveryStatus,
                    expectedDeliveryAt: invoice.expectedDeliveryAt,
                })
                .from(order)
                .leftJoin(
                    invoice,
                    and(eq(invoice.orderId, order.id), eq(invoice.invoiceType, "main")),
                )
                .where(
                    and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)),
                )
                .orderBy(desc(order.createdAt));

            const orderStats = {
                total: supplierOrders.length,
                pending: 0,
                confirmed: 0,
                processing: 0,
                delivered: 0,
                returned: 0,
                cancelled: 0,
                outForDelivery: 0,
            };

            let totalPurchase = 0;
            let totalPaid = 0;
            let totalDue = 0;
            let overdueAmount = 0;
            let payableOrders = 0;

            for (const row of supplierOrders) {
                const total = toSafeNumber(row.total);

                if (row.status === "pending") orderStats.pending += 1;
                if (row.status === "confirmed") orderStats.confirmed += 1;
                if (row.status === "processing") orderStats.processing += 1;
                if (row.status === "delivered") orderStats.delivered += 1;
                if (row.status === "returned") orderStats.returned += 1;
                if (row.status === "cancelled") orderStats.cancelled += 1;
                if (row.invoiceDeliveryStatus === "out_for_delivery") {
                    orderStats.outForDelivery += 1;
                }

                if (isPurchaseOrderStatus(row.status)) {
                    totalPurchase += total;
                }

                if (
                    isPurchaseOrderStatus(row.status)
                    && isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
                ) {
                    totalPaid += total;
                }

                if (
                    isPayableOrder(
                        row.status,
                        row.paymentStatus,
                        row.invoicePaymentStatus,
                    )
                ) {
                    totalDue += total;
                    payableOrders += 1;
                    if (row.status === "delivered") {
                        overdueAmount += total;
                    }
                }
            }

            const latestOrder = supplierOrders[0] || null;
            const lastPayment = supplierOrders.find((row) =>
                isPurchaseOrderStatus(row.status)
                && isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
            ) || null;

            const pendingOrders = await db.query.order.findMany({
                where: and(
                    eq(order.userId, shopId),
                    eq(order.warehouseId, warehouseId),
                    inArray(order.status, ["pending", "confirmed", "processing"]),
                ),
                with: {
                    items: {
                        columns: {
                            id: true,
                            productName: true,
                            productImage: true,
                            quantity: true,
                            modifiedQty: true,
                        },
                    },
                },
                orderBy: [desc(order.createdAt)],
                limit: 5,
            });

            const pendingOrderIds = pendingOrders.map((row) => row.id);
            const pendingInvoices = pendingOrderIds.length > 0
                ? await db
                    .select({
                        orderId: invoice.orderId,
                        deliveryStatus: invoice.deliveryStatus,
                        expectedDeliveryAt: invoice.expectedDeliveryAt,
                    })
                    .from(invoice)
                    .where(
                        and(
                            eq(invoice.invoiceType, "main"),
                            inArray(invoice.orderId, pendingOrderIds),
                        ),
                    )
                : [];

            const pendingInvoiceMap = new Map(
                pendingInvoices.map((row) => [row.orderId, row]),
            );

            const historyOrderRows = supplierOrders.slice(0, 5);
            const historyOrderIds = historyOrderRows.map((row) => row.id);
            const historyItems = historyOrderIds.length > 0
                ? await db
                    .select({
                        orderId: orderItem.orderId,
                        productName: orderItem.productName,
                    })
                    .from(orderItem)
                    .where(inArray(orderItem.orderId, historyOrderIds))
                : [];

            const historyItemMap = new Map<number, string[]>();
            for (const item of historyItems) {
                const current = historyItemMap.get(item.orderId) ?? [];
                current.push(item.productName);
                historyItemMap.set(item.orderId, current);
            }

            const purchaseHistory = historyOrderRows.map((row) => {
                const total = toSafeNumber(row.total);
                const productNames = historyItemMap.get(row.id) ?? [];
                const productSummary = productNames.length <= 2
                    ? productNames.join(", ")
                    : `${productNames[0]}, ${productNames[1]} +${productNames.length - 2} more`;
                const paid = isOrderPaid(row.paymentStatus, row.invoicePaymentStatus);
                const dueAmount = isPayableOrder(
                    row.status,
                    row.paymentStatus,
                    row.invoicePaymentStatus,
                )
                    ? total
                    : 0;

                return {
                    id: row.id,
                    orderNumber: row.orderNumber,
                    date: row.createdAt,
                    productSummary: productSummary || "Multiple products",
                    amount: total,
                    orderStatus: row.status,
                    paymentStatus: paid
                        ? "paid"
                        : dueAmount > 0
                            ? "due"
                            : "pending",
                    dueAmount,
                };
            });

            const topProducts = await db
                .select({
                    productName: orderItem.productName,
                    productImage: orderItem.productImage,
                    totalQty: sql<number>`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity}))`.as("tq"),
                    orderCount: count(),
                })
                .from(orderItem)
                .innerJoin(order, eq(orderItem.orderId, order.id))
                .where(and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)))
                .groupBy(orderItem.productName, orderItem.productImage)
                .orderBy(
                    sql`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity})) DESC`,
                )
                .limit(5);

            const topCategories = await db
                .select({
                    categoryName: category.name,
                    totalQty: sql<number>`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity}))`.as("tq"),
                    orderCount: count(),
                })
                .from(orderItem)
                .innerJoin(order, eq(orderItem.orderId, order.id))
                .innerJoin(product, eq(orderItem.productId, product.id))
                .innerJoin(category, eq(product.categoryId, category.id))
                .where(and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)))
                .groupBy(category.name)
                .orderBy(
                    sql`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity})) DESC`,
                )
                .limit(3);

            const [skuSummary] = await db
                .select({
                    totalSkuPurchased: sql<number>`COUNT(DISTINCT ${orderItem.productId})`.as(
                        "total_sku_purchased",
                    ),
                })
                .from(orderItem)
                .innerJoin(order, eq(orderItem.orderId, order.id))
                .where(and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)));

            const perfData = await db
                .select({
                    avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${order.deliveredAt} - ${order.createdAt})) / 86400)`.as("ad"),
                    modifiedCount: sql<number>`count(*) filter (where ${order.modifiedByWarehouseAt} is not null)`.as("mc"),
                    deliveredTotal: sql<number>`count(*) filter (where ${order.status} = 'delivered')`.as("dt"),
                })
                .from(order)
                .where(
                    and(
                        eq(order.userId, shopId),
                        eq(order.warehouseId, warehouseId),
                        eq(order.status, "delivered"),
                    ),
                );

            const avgDeliveryDays = Math.round(Number(perfData[0]?.avgDays) || 0);
            const deliveredTotal = Number(perfData[0]?.deliveredTotal) || 0;
            const modifiedRate = deliveredTotal > 0
                ? Math.round(
                    ((Number(perfData[0]?.modifiedCount) || 0) / deliveredTotal) * 100,
                )
                : 0;

            const complaintRows = await db
                .select({
                    id: complaint.id,
                    type: complaint.type,
                    status: complaint.status,
                    description: complaint.description,
                    delayReason: complaint.delayReason,
                    createdAt: complaint.createdAt,
                })
                .from(complaint)
                .innerJoin(order, eq(complaint.orderId, order.id))
                .where(
                    and(
                        eq(complaint.userId, shopId),
                        eq(order.userId, shopId),
                        eq(order.warehouseId, warehouseId),
                    ),
                )
                .orderBy(desc(complaint.createdAt));

            const totalIssues = complaintRows.length;
            const resolvedIssues = complaintRows.filter((row) =>
                ["resolved", "closed"].includes(row.status)
            ).length;
            const latestIssue = complaintRows[0] || null;
            const issueRate = orderStats.total > 0
                ? Math.round((totalIssues / orderStats.total) * 100)
                : 0;

            const assignment = await db.query.customerAssignment.findFirst({
                where: eq(customerAssignment.customerId, shopId),
                with: {
                    salesman: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                            role: true,
                            warehouseId: true,
                            banned: true,
                        },
                    },
                },
            });

            const assignedSalesman = assignment?.salesman
                && assignment.salesman.role === "salesman"
                && assignment.salesman.warehouseId === warehouseId
                ? {
                    id: assignment.salesman.id,
                    name: assignment.salesman.name,
                    phone: assignment.salesman.phoneNumber,
                    status: assignment.salesman.banned ? "inactive" : "active",
                }
                : null;

            const warehouseAreas = await db.query.deliveryArea.findMany({
                where: and(
                    eq(deliveryArea.warehouseId, warehouseId),
                    eq(deliveryArea.status, "active"),
                ),
                with: {
                    schedules: {
                        where: eq(deliverySchedule.isActive, true),
                        with: {
                            defaultRider: {
                                columns: {
                                    name: true,
                                    phoneNumber: true,
                                },
                            },
                        },
                        orderBy: [asc(deliverySchedule.dayOfWeek)],
                    },
                },
                orderBy: [asc(deliveryArea.sortOrder), asc(deliveryArea.name)],
            });

            const deliveryHints = [
                {
                    source: "shipping_area",
                    value: latestOrder?.shippingArea || null,
                },
                {
                    source: "shipping_city",
                    value: latestOrder?.shippingCity || null,
                },
                {
                    source: "service_area",
                    value: shopUser?.serviceArea || null,
                },
                {
                    source: "shop_address",
                    value: shopUser?.shopAddress || latestOrder?.shippingAddress || null,
                },
            ].filter((hint) => normalizeDeliveryText(hint.value).length > 0);

            let matchedArea: (typeof warehouseAreas)[number] | null = null;
            let matchSource: string | null = null;

            for (const areaRow of warehouseAreas) {
                const areaTerms = [areaRow.name, areaRow.slug, areaRow.description]
                    .map((value) => normalizeDeliveryText(value))
                    .filter(Boolean);

                const matchedHint = deliveryHints.find((hint) => {
                    const normalizedHint = normalizeDeliveryText(hint.value);
                    return areaTerms.some((term) =>
                        normalizedHint.includes(term) || term.includes(normalizedHint)
                    );
                });

                if (matchedHint) {
                    matchedArea = areaRow;
                    matchSource = matchedHint.source;
                    break;
                }
            }

            const warehouseScheduleMap = new Map<
                number,
                {
                    dayOfWeek: number;
                    dayName: string;
                    areaNames: string[];
                    riderName: string | null;
                    riderPhone: string | null;
                }
            >();

            for (const areaRow of warehouseAreas) {
                for (const schedule of areaRow.schedules) {
                    const current = warehouseScheduleMap.get(schedule.dayOfWeek) ?? {
                        dayOfWeek: schedule.dayOfWeek,
                        dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
                        areaNames: [],
                        riderName: schedule.defaultRider?.name ?? null,
                        riderPhone: schedule.defaultRider?.phoneNumber ?? null,
                    };

                    if (!current.areaNames.includes(areaRow.name)) {
                        current.areaNames.push(areaRow.name);
                    }

                    if (!current.riderName && schedule.defaultRider?.name) {
                        current.riderName = schedule.defaultRider.name;
                    }

                    if (!current.riderPhone && schedule.defaultRider?.phoneNumber) {
                        current.riderPhone = schedule.defaultRider.phoneNumber;
                    }

                    warehouseScheduleMap.set(schedule.dayOfWeek, current);
                }
            }

            const warehouseWeeklyDays = Array.from(warehouseScheduleMap.values()).sort(
                (a, b) => a.dayOfWeek - b.dayOfWeek,
            );
            const matchedWeeklyDays = matchedArea
                ? matchedArea.schedules.map((schedule) => ({
                    dayOfWeek: schedule.dayOfWeek,
                    dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
                    areaNames: [matchedArea!.name],
                    riderName: schedule.defaultRider?.name ?? null,
                    riderPhone: schedule.defaultRider?.phoneNumber ?? null,
                }))
                : [];
            const deliveryScope = matchedWeeklyDays.length > 0
                ? "matched_area"
                : warehouseWeeklyDays.length > 0
                    ? "warehouse"
                    : "none";
            const effectiveWeeklyDays = deliveryScope === "matched_area"
                ? matchedWeeklyDays
                : warehouseWeeklyDays;
            const today = new Date();
            const todayDayOfWeek = today.getDay();
            const hasDeliveryToday = effectiveWeeklyDays.some(
                (day) => day.dayOfWeek === todayDayOfWeek,
            );
            const nextDelivery = findNextDeliveryDate(
                effectiveWeeklyDays.map((day) => day.dayOfWeek),
                today,
            );

            const uploadedDocuments = Array.isArray(warehouseProfile?.documents)
                ? warehouseProfile.documents
                : [];
            const locationParts = [
                warehouseProfile?.area,
                warehouseProfile?.district,
                warehouseProfile?.division,
            ].filter(Boolean);
            const businessType = warehouseProfile?.businessCategory
                ? warehouseProfile.businessCategory
                : "warehouse_supplier";
            const bestCategory = topCategories[0]?.categoryName || null;

            let reliability: "Excellent" | "Good" | "Stable" | "Needs attention" =
                "Stable";
            if (issueRate === 0 && modifiedRate <= 5) {
                reliability = "Excellent";
            } else if (issueRate <= 2 && modifiedRate <= 10) {
                reliability = "Good";
            } else if (issueRate > 10 || modifiedRate > 25) {
                reliability = "Needs attention";
            }

            return {
                identity: {
                    warehouseId: warehouseUser.id,
                    warehouseSlug: warehouseUser.warehouseSlug,
                    name: warehouseUser.warehouseName || warehouseUser.name,
                    type: businessType,
                    location:
                        locationParts.join(", ")
                        || warehouseUser.address
                        || null,
                    phone: warehouseUser.phoneNumber,
                    email: warehouseUser.email,
                    image: warehouseUser.image,
                    connectionStatus: connection.status,
                    connectedAt: connection.connectedAt,
                    lastOrderedAt: connection.lastOrderedAt,
                },
                business: {
                    name: warehouseUser.warehouseName || warehouseUser.name,
                    category: warehouseProfile?.businessCategory || null,
                    yearsInBusiness: warehouseProfile?.yearsInBusiness || null,
                    yourStoreName: shopUser?.shopName || shopUser?.name || null,
                    yourAddress:
                        shopUser?.shopAddress || latestOrder?.shippingAddress || null,
                },
                documents: {
                    applicationStatus: warehouseProfile?.status || null,
                    tradeLicenseNumber: warehouseProfile?.tradeLicenseNumber || null,
                    uploadedDocumentCount: uploadedDocuments.length,
                    uploadedDocuments,
                    hasTradeLicense: Boolean(warehouseProfile?.tradeLicenseNumber),
                    hasVatBin: false,
                    hasAgreement: false,
                    hasProductAuthorization: uploadedDocuments.length > 0,
                },
                financialSummary: {
                    totalPurchase,
                    totalPaid,
                    totalDue,
                    creditLimit: null,
                    availableCredit: null,
                    health: totalDue > 0 ? "attention" : "safe",
                },
                orderStatus: {
                    totalOrders: orderStats.total,
                    pendingOrders:
                        orderStats.pending + orderStats.confirmed + orderStats.processing,
                    processingOrders: orderStats.processing,
                    outForDeliveryOrders: orderStats.outForDelivery,
                    deliveredOrders: orderStats.delivered,
                },
                pendingOrders: pendingOrders.map((row: any) => {
                    const invoiceData = pendingInvoiceMap.get(row.id);
                    return {
                        id: row.id,
                        orderNumber: row.orderNumber,
                        status: row.status,
                        createdAt: row.createdAt,
                        total: toSafeNumber(row.total),
                        deliveryStatus: invoiceData?.deliveryStatus || null,
                        expectedDeliveryAt: invoiceData?.expectedDeliveryAt || null,
                        items: row.items.map((item: any) => ({
                            id: item.id,
                            productName: item.productName,
                            quantity: Number(item.modifiedQty || item.quantity || 0),
                            rawQuantity: Number(item.quantity || 0),
                        })),
                    };
                }),
                dueStatus: {
                    totalPayable: totalDue,
                    overdueAmount,
                    payableOrders,
                    lastPayment: lastPayment
                        ? {
                            orderNumber: lastPayment.orderNumber,
                            amount: toSafeNumber(lastPayment.total),
                            date: lastPayment.createdAt,
                        }
                        : null,
                    alert:
                        totalDue > 0
                            ? overdueAmount > 0
                                ? "Delivered dues are waiting to be settled."
                                : "Pending purchase dues need follow-up."
                            : "No pending payable balance.",
                },
                purchaseHistory,
                productRelation: {
                    topProducts: topProducts.map((row) => ({
                        name: row.productName,
                        image: row.productImage,
                        totalQty: Number(row.totalQty),
                        orderCount: Number(row.orderCount),
                    })),
                    totalSkuPurchased: Number(skuSummary?.totalSkuPurchased || 0),
                    topCategories: topCategories.map((row) => ({
                        name: row.categoryName,
                        totalQty: Number(row.totalQty),
                        orderCount: Number(row.orderCount),
                    })),
                },
                performance: {
                    avgDeliveryDays,
                    deliverySpeed:
                        avgDeliveryDays <= 1
                            ? "Fast"
                            : avgDeliveryDays <= 3
                                ? "Normal"
                                : avgDeliveryDays > 0
                                    ? "Slow"
                                    : "No delivery data",
                    orderAccuracy: deliveredTotal > 0 ? 100 - modifiedRate : 100,
                    reliability,
                    issueRate,
                },
                issues: {
                    totalIssues,
                    resolvedIssues,
                    unresolvedIssues: totalIssues - resolvedIssues,
                    lastIssue: latestIssue
                        ? {
                            type: latestIssue.type,
                            status: latestIssue.status,
                            description: latestIssue.description,
                            delayReason: latestIssue.delayReason,
                            createdAt: latestIssue.createdAt,
                        }
                        : null,
                },
                salesman: assignedSalesman,
                delivery: {
                    scope: deliveryScope,
                    matchSource,
                    yourAddress:
                        shopUser?.shopAddress || latestOrder?.shippingAddress || null,
                    areaHint:
                        latestOrder?.shippingArea
                        || latestOrder?.shippingCity
                        || shopUser?.serviceArea
                        || null,
                    matchedArea: matchedArea
                        ? {
                            id: matchedArea.id,
                            name: matchedArea.name,
                            description: matchedArea.description,
                        }
                        : null,
                    availableAreas: warehouseAreas.map((areaRow) => areaRow.name),
                    weeklyDays: effectiveWeeklyDays,
                    hasDeliveryToday,
                    todayDayName: DAY_NAMES[todayDayOfWeek],
                    nextDelivery,
                    cutoffTime: null,
                },
                smartInsight: {
                    headline: bestCategory
                        ? `This supplier performs strongest in ${bestCategory}.`
                        : orderStats.total > 0
                            ? "This supplier already has purchase activity."
                            : "Connection is active, but no transactions have been recorded yet.",
                    warning:
                        totalDue > 0
                            ? `Outstanding payable balance: Tk ${totalDue.toLocaleString("en-BD")}`
                            : latestIssue
                                ? `Latest issue: ${latestIssue.type.replace(/_/g, " ")}`
                                : null,
                    suggestion:
                        totalDue > 0
                            ? "Settle pending dues before scaling order volume."
                            : orderStats.pending + orderStats.confirmed + orderStats.processing > 0
                                ? "Track active orders closely against the delivery schedule."
                                : "Use this connection to expand repeat purchasing in strong categories.",
                    compareCategory: bestCategory,
                },
                emptyState: {
                    hasTransactions: supplierOrders.length > 0,
                },
            };
        }),

    /**
     * List all warehouses this shop has ordered from (= suppliers).
     */
    getMySuppliers: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/my-suppliers",
            tags: ["Shop Owner"],
            summary: "List suppliers (warehouses ordered from)",
        })
        .input(
            z.object({
                search: z.string().optional(),
                status: z.enum(["all", "with_due", "no_due"]).default("all"),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const supplierOrders = await db
                .select({
                    warehouseId: order.warehouseId,
                    orderId: order.id,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    total: order.total,
                    createdAt: order.createdAt,
                    invoicePaymentStatus: invoice.paymentStatus,
                })
                .from(order)
                .leftJoin(
                    invoice,
                    and(
                        eq(invoice.orderId, order.id),
                        eq(invoice.invoiceType, "main"),
                    ),
                )
                .where(and(eq(order.userId, userId), sql`${order.warehouseId} is not null`));

            if (supplierOrders.length === 0) {
                return {
                    summary: {
                        totalSuppliers: 0,
                        payableSuppliers: 0,
                        totalPayable: 0,
                    },
                    suppliers: [],
                };
            }

            const supplierMap = new Map<
                string,
                {
                    warehouseId: string;
                    totalOrders: number;
                    totalPurchased: number;
                    totalPaid: number;
                    totalPayable: number;
                    payableOrders: number;
                    pendingCount: number;
                    lastOrderDate: Date | null;
                    lastPurchaseAmount: number;
                }
            >();

            for (const row of supplierOrders) {
                const warehouseId = row.warehouseId;
                if (!warehouseId) continue;

                const total = toSafeNumber(row.total);
                const existing = supplierMap.get(warehouseId) ?? {
                    warehouseId,
                    totalOrders: 0,
                    totalPurchased: 0,
                    totalPaid: 0,
                    totalPayable: 0,
                    payableOrders: 0,
                    pendingCount: 0,
                    lastOrderDate: null,
                    lastPurchaseAmount: 0,
                };

                existing.totalOrders += 1;

                if (
                    !existing.lastOrderDate
                    || (row.createdAt && row.createdAt > existing.lastOrderDate)
                ) {
                    existing.lastOrderDate = row.createdAt;
                    existing.lastPurchaseAmount = total;
                }

                if (["pending", "confirmed", "processing"].includes(row.status)) {
                    existing.pendingCount += 1;
                }

                if (isPurchaseOrderStatus(row.status)) {
                    existing.totalPurchased += total;
                }

                if (isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)) {
                    existing.totalPaid += total;
                }

                if (
                    isPayableOrder(
                        row.status,
                        row.paymentStatus,
                        row.invoicePaymentStatus,
                    )
                ) {
                    existing.totalPayable += total;
                    existing.payableOrders += 1;
                }

                supplierMap.set(warehouseId, existing);
            }

            const allSuppliers = Array.from(supplierMap.values());
            const baseSummary = {
                totalSuppliers: allSuppliers.length,
                payableSuppliers: allSuppliers.filter((supplier) => supplier.totalPayable > 0)
                    .length,
                totalPayable: allSuppliers.reduce(
                    (total, supplier) => total + supplier.totalPayable,
                    0,
                ),
            };

            const whIds = Array.from(supplierMap.keys());
            const warehouseUsers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    shopName: user.shopName,
                    warehouseName: user.warehouseName,
                    phoneNumber: user.phoneNumber,
                    email: user.email,
                })
                .from(user)
                .where(inArray(user.id, whIds));

            const connections = await db
                .select({
                    warehouseId: shopWarehouseConnection.warehouseId,
                    connectedAt: shopWarehouseConnection.connectedAt,
                    lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                    status: shopWarehouseConnection.status,
                })
                .from(shopWarehouseConnection)
                .where(
                    and(
                        eq(shopWarehouseConnection.shopId, userId),
                        inArray(shopWarehouseConnection.warehouseId, whIds),
                    ),
                );

            const userMap = new Map(warehouseUsers.map((u) => [u.id, u]));
            const connectionMap = new Map(
                connections.map((connection) => [connection.warehouseId, connection]),
            );

            let suppliers = Array.from(supplierMap.values()).map((supplier) => {
                const u = userMap.get(supplier.warehouseId);
                const connection = connectionMap.get(supplier.warehouseId);
                return {
                    warehouseId: supplier.warehouseId,
                    name: u?.warehouseName || u?.shopName || u?.name || "Unknown",
                    phone: u?.phoneNumber || null,
                    email: u?.email || null,
                    totalOrders: supplier.totalOrders,
                    totalPurchased: supplier.totalPurchased,
                    totalPaid: supplier.totalPaid,
                    totalPayable: supplier.totalPayable,
                    payableOrders: supplier.payableOrders,
                    pendingCount: supplier.pendingCount,
                    lastOrderDate: supplier.lastOrderDate,
                    lastPurchaseAmount: supplier.lastPurchaseAmount,
                    hasDue: supplier.totalPayable > 0,
                    connectionStatus: connection?.status || null,
                    connectedAt: connection?.connectedAt || null,
                    lastOrderedAt: connection?.lastOrderedAt || null,
                };
            });

            if (input.search) {
                const s = input.search.toLowerCase();
                suppliers = suppliers.filter((sup) =>
                    [sup.name, sup.phone, sup.email]
                        .filter(Boolean)
                        .some((value) => value!.toLowerCase().includes(s)),
                );
            }

            if (input.status === "with_due") {
                suppliers = suppliers.filter((sup) => sup.hasDue);
            } else if (input.status === "no_due") {
                suppliers = suppliers.filter((sup) => !sup.hasDue);
            }

            suppliers.sort((a, b) => {
                if (Number(b.hasDue) !== Number(a.hasDue)) {
                    return Number(b.hasDue) - Number(a.hasDue);
                }

                if (b.totalPayable !== a.totalPayable) {
                    return b.totalPayable - a.totalPayable;
                }

                if (b.totalPurchased !== a.totalPurchased) {
                    return b.totalPurchased - a.totalPurchased;
                }

                return (
                    (b.lastOrderDate?.getTime() || 0) - (a.lastOrderDate?.getTime() || 0)
                );
            });

            return {
                summary: baseSummary,
                suppliers,
            };
        }),

    /**
     * Full supplier detail: financial summary, order stats, pending orders,
     * recent history, top products, performance metrics.
     */
    getSupplierDetail: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/supplier-detail",
            tags: ["Shop Owner"],
            summary: "Get full supplier profile",
        })
        .input(z.object({ warehouseId: z.string() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const whId = input.warehouseId;

            const [shopUser] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    shopName: user.shopName,
                    shopAddress: user.shopAddress,
                    serviceArea: user.serviceArea,
                })
                .from(user)
                .where(eq(user.id, userId))
                .limit(1);

            const [whUser] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    shopName: user.shopName,
                    warehouseName: user.warehouseName,
                    phoneNumber: user.phoneNumber,
                    email: user.email,
                    address: user.warehouseAddress,
                })
                .from(user)
                .where(eq(user.id, whId))
                .limit(1);

            if (!whUser) {
                throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
            }

            const [connection] = await db
                .select({
                    status: shopWarehouseConnection.status,
                    connectedAt: shopWarehouseConnection.connectedAt,
                    lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                })
                .from(shopWarehouseConnection)
                .where(
                    and(
                        eq(shopWarehouseConnection.shopId, userId),
                        eq(shopWarehouseConnection.warehouseId, whId),
                    ),
                )
                .limit(1);

            const supplierOrders = await db
                .select({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    total: order.total,
                    createdAt: order.createdAt,
                    deliveredAt: order.deliveredAt,
                    modifiedByWarehouseAt: order.modifiedByWarehouseAt,
                    shippingAddress: order.shippingAddress,
                    shippingCity: order.shippingCity,
                    shippingArea: order.shippingArea,
                    invoicePaymentStatus: invoice.paymentStatus,
                })
                .from(order)
                .leftJoin(
                    invoice,
                    and(
                        eq(invoice.orderId, order.id),
                        eq(invoice.invoiceType, "main"),
                    ),
                )
                .where(and(eq(order.userId, userId), eq(order.warehouseId, whId)))
                .orderBy(desc(order.createdAt));

            const orderStats = {
                total: supplierOrders.length,
                pending: 0,
                confirmed: 0,
                processing: 0,
                delivered: 0,
                returned: 0,
                cancelled: 0,
            };

            let totalPurchased = 0;
            let totalPaid = 0;
            let totalDue = 0;
            let payableOrders = 0;

            for (const row of supplierOrders) {
                const total = toSafeNumber(row.total);

                if (row.status === "pending") orderStats.pending += 1;
                if (row.status === "confirmed") orderStats.confirmed += 1;
                if (row.status === "processing") orderStats.processing += 1;
                if (row.status === "delivered") orderStats.delivered += 1;
                if (row.status === "returned") orderStats.returned += 1;
                if (row.status === "cancelled") orderStats.cancelled += 1;

                if (isPurchaseOrderStatus(row.status)) {
                    totalPurchased += total;
                }

                if (
                    isPurchaseOrderStatus(row.status)
                    && isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
                ) {
                    totalPaid += total;
                }

                if (
                    isPayableOrder(
                        row.status,
                        row.paymentStatus,
                        row.invoicePaymentStatus,
                    )
                ) {
                    totalDue += total;
                    payableOrders += 1;
                }
            }

            const latestOrder = supplierOrders[0] || null;

            const pendingOrders = await db.query.order.findMany({
                where: and(
                    eq(order.userId, userId),
                    eq(order.warehouseId, whId),
                    inArray(order.status, ["pending", "confirmed", "processing"]),
                ),
                with: {
                    items: {
                        columns: { id: true, productName: true, productImage: true, quantity: true, modifiedQty: true },
                    },
                },
                orderBy: [desc(order.createdAt)],
                limit: 5,
            });

            const historyOrderRows = supplierOrders.slice(0, 8);
            const historyOrderIds = historyOrderRows.map((row) => row.id);
            const historyItems = historyOrderIds.length
                ? await db
                    .select({
                        orderId: orderItem.orderId,
                        productName: orderItem.productName,
                    })
                    .from(orderItem)
                    .where(inArray(orderItem.orderId, historyOrderIds))
                : [];

            const historyItemMap = new Map<number, string[]>();
            for (const item of historyItems) {
                const existing = historyItemMap.get(item.orderId) ?? [];
                existing.push(item.productName);
                historyItemMap.set(item.orderId, existing);
            }

            const purchaseHistory = historyOrderRows.map((row) => {
                const total = toSafeNumber(row.total);
                const productNames = historyItemMap.get(row.id) ?? [];
                const productSummary = productNames.length <= 2
                    ? productNames.join(", ")
                    : `${productNames[0]}, ${productNames[1]} +${productNames.length - 2} more`;
                const paid = isOrderPaid(row.paymentStatus, row.invoicePaymentStatus);
                const dueAmount = isPayableOrder(
                    row.status,
                    row.paymentStatus,
                    row.invoicePaymentStatus,
                )
                    ? total
                    : 0;

                return {
                    id: row.id,
                    orderNumber: row.orderNumber,
                    date: row.createdAt,
                    productSummary: productSummary || "Multiple products",
                    amount: total,
                    orderStatus: row.status,
                    paymentStatus: paid
                        ? "paid"
                        : dueAmount > 0
                            ? "due"
                            : "pending",
                    dueAmount,
                };
            });

            const recentHistory = supplierOrders
                .filter((row) =>
                    ["delivered", "cancelled", "returned"].includes(row.status),
                )
                .slice(0, 5)
                .map((row) => ({
                    id: row.id,
                    orderNumber: row.orderNumber,
                    status: row.status,
                    createdAt: row.createdAt,
                    total: row.total,
                }));

            const topProducts = await db
                .select({
                    productName: orderItem.productName,
                    productImage: orderItem.productImage,
                    totalQty: sql<number>`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity}))`.as("tq"),
                    orderCount: count(),
                })
                .from(orderItem)
                .innerJoin(order, eq(orderItem.orderId, order.id))
                .where(and(eq(order.userId, userId), eq(order.warehouseId, whId)))
                .groupBy(orderItem.productName, orderItem.productImage)
                .orderBy(sql`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity})) DESC`)
                .limit(10);

            const perfData = await db
                .select({
                    avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${order.deliveredAt} - ${order.createdAt})) / 86400)`.as("ad"),
                    modifiedCount: sql<number>`count(*) filter (where ${order.modifiedByWarehouseAt} is not null)`.as("mc"),
                    deliveredTotal: sql<number>`count(*) filter (where ${order.status} = 'delivered')`.as("dt"),
                })
                .from(order)
                .where(
                    and(
                        eq(order.userId, userId),
                        eq(order.warehouseId, whId),
                        eq(order.status, "delivered"),
                    ),
                );

            const avgDeliveryDays = Math.round(Number(perfData[0]?.avgDays) || 0);
            const deliveredTotal = Number(perfData[0]?.deliveredTotal) || 1;
            const modifiedRate = Math.round(((Number(perfData[0]?.modifiedCount) || 0) / deliveredTotal) * 100);

            const assignment = await db.query.customerAssignment.findFirst({
                where: eq(customerAssignment.customerId, userId),
                with: {
                    salesman: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                            role: true,
                            warehouseId: true,
                            banned: true,
                        },
                    },
                },
            });

            const assignedSalesman = assignment?.salesman
                && assignment.salesman.role === "salesman"
                && assignment.salesman.warehouseId === whId
                ? {
                    id: assignment.salesman.id,
                    name: assignment.salesman.name,
                    phone: assignment.salesman.phoneNumber,
                    status: assignment.salesman.banned ? "inactive" : "active",
                }
                : null;

            const warehouseAreas = await db.query.deliveryArea.findMany({
                where: and(
                    eq(deliveryArea.warehouseId, whId),
                    eq(deliveryArea.status, "active"),
                ),
                with: {
                    schedules: {
                        where: eq(deliverySchedule.isActive, true),
                        with: {
                            defaultRider: {
                                columns: {
                                    name: true,
                                    phoneNumber: true,
                                },
                            },
                        },
                        orderBy: [asc(deliverySchedule.dayOfWeek)],
                    },
                },
                orderBy: [asc(deliveryArea.sortOrder), asc(deliveryArea.name)],
            });

            const deliveryHints = [
                {
                    source: "shipping_area",
                    value: latestOrder?.shippingArea || null,
                },
                {
                    source: "shipping_city",
                    value: latestOrder?.shippingCity || null,
                },
                {
                    source: "service_area",
                    value: shopUser?.serviceArea || null,
                },
                {
                    source: "shop_address",
                    value: shopUser?.shopAddress || latestOrder?.shippingAddress || null,
                },
            ].filter((hint) => normalizeDeliveryText(hint.value).length > 0);

            let matchedArea: (typeof warehouseAreas)[number] | null = null;
            let matchSource: string | null = null;

            for (const areaRow of warehouseAreas) {
                const areaTerms = [
                    areaRow.name,
                    areaRow.slug,
                    areaRow.description,
                ]
                    .map((value) => normalizeDeliveryText(value))
                    .filter(Boolean);

                const matchedHint = deliveryHints.find((hint) => {
                    const normalizedHint = normalizeDeliveryText(hint.value);
                    return areaTerms.some((term) =>
                        normalizedHint.includes(term) || term.includes(normalizedHint)
                    );
                });

                if (matchedHint) {
                    matchedArea = areaRow;
                    matchSource = matchedHint.source;
                    break;
                }
            }

            const warehouseScheduleMap = new Map<
                number,
                {
                    dayOfWeek: number;
                    dayName: string;
                    areaNames: string[];
                    riderName: string | null;
                    riderPhone: string | null;
                }
            >();

            for (const areaRow of warehouseAreas) {
                for (const schedule of areaRow.schedules) {
                    const existing = warehouseScheduleMap.get(schedule.dayOfWeek) ?? {
                        dayOfWeek: schedule.dayOfWeek,
                        dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
                        areaNames: [],
                        riderName: schedule.defaultRider?.name ?? null,
                        riderPhone: schedule.defaultRider?.phoneNumber ?? null,
                    };

                    if (!existing.areaNames.includes(areaRow.name)) {
                        existing.areaNames.push(areaRow.name);
                    }

                    if (!existing.riderName && schedule.defaultRider?.name) {
                        existing.riderName = schedule.defaultRider.name;
                    }

                    if (!existing.riderPhone && schedule.defaultRider?.phoneNumber) {
                        existing.riderPhone = schedule.defaultRider.phoneNumber;
                    }

                    warehouseScheduleMap.set(schedule.dayOfWeek, existing);
                }
            }

            const warehouseWeeklyDays = Array.from(warehouseScheduleMap.values()).sort(
                (a, b) => a.dayOfWeek - b.dayOfWeek,
            );
            const matchedWeeklyDays = matchedArea
                ? matchedArea.schedules.map((schedule) => ({
                    dayOfWeek: schedule.dayOfWeek,
                    dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
                    areaNames: [matchedArea!.name],
                    riderName: schedule.defaultRider?.name ?? null,
                    riderPhone: schedule.defaultRider?.phoneNumber ?? null,
                }))
                : [];
            const deliveryScope = matchedWeeklyDays.length > 0
                ? "matched_area"
                : warehouseWeeklyDays.length > 0
                    ? "warehouse"
                    : "none";
            const effectiveWeeklyDays = deliveryScope === "matched_area"
                ? matchedWeeklyDays
                : warehouseWeeklyDays;
            const today = new Date();
            const todayDayOfWeek = today.getDay();
            const hasDeliveryToday = effectiveWeeklyDays.some(
                (day) => day.dayOfWeek === todayDayOfWeek,
            );
            const nextDelivery = findNextDeliveryDate(
                effectiveWeeklyDays.map((day) => day.dayOfWeek),
                today,
            );

            return {
                identity: {
                    warehouseId: whUser.id,
                    name: whUser.warehouseName || whUser.shopName || whUser.name,
                    phone: whUser.phoneNumber,
                    email: whUser.email,
                    address: whUser.address,
                    connectionStatus: connection?.status || null,
                    connectedAt: connection?.connectedAt || null,
                    lastOrderedAt: connection?.lastOrderedAt || null,
                },
                financial: {
                    totalPurchased,
                    totalPaid,
                    totalDue,
                    payableOrders,
                },
                business: {
                    name: whUser.warehouseName || whUser.shopName || whUser.name,
                    phone: whUser.phoneNumber,
                    email: whUser.email,
                    location: whUser.address,
                    yourShopName: shopUser?.shopName || shopUser?.name || null,
                    yourAddress: shopUser?.shopAddress || latestOrder?.shippingAddress || null,
                },
                orderStats,
                salesman: assignedSalesman,
                delivery: {
                    scope: deliveryScope,
                    matchSource,
                    yourAddress: shopUser?.shopAddress || latestOrder?.shippingAddress || null,
                    areaHint: latestOrder?.shippingArea || latestOrder?.shippingCity || shopUser?.serviceArea || null,
                    matchedArea: matchedArea
                        ? {
                            id: matchedArea.id,
                            name: matchedArea.name,
                            description: matchedArea.description,
                        }
                        : null,
                    availableAreas: warehouseAreas.map((areaRow) => areaRow.name),
                    weeklyDays: effectiveWeeklyDays,
                    hasDeliveryToday,
                    todayDayName: DAY_NAMES[todayDayOfWeek],
                    nextDelivery,
                    cutoffTime: null,
                },
                accountSummary: {
                    totalPurchase: totalPurchased,
                    paid: totalPaid,
                    payable: totalDue,
                    payableOrders,
                },
                purchaseHistory,
                quickInfo: {
                    lastOrderNumber: latestOrder?.orderNumber || null,
                    lastOrderStatus: latestOrder?.status || null,
                    pendingOrders:
                        orderStats.pending + orderStats.confirmed + orderStats.processing,
                    activeOrders:
                        orderStats.pending + orderStats.confirmed + orderStats.processing,
                    payableOrders,
                    lastDeliveredAt:
                        supplierOrders.find((row) => row.status === "delivered")
                            ?.deliveredAt || null,
                },
                pendingOrders: pendingOrders.map((o: any) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    createdAt: o.createdAt,
                    total: o.total,
                    items: o.items,
                })),
                recentHistory: recentHistory.map((o: any) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    createdAt: o.createdAt,
                    total: o.total,
                })),
                topProducts: topProducts.map((p) => ({
                    name: p.productName,
                    image: p.productImage,
                    totalQty: Number(p.totalQty),
                    orderCount: Number(p.orderCount),
                })),
                performance: {
                    avgDeliveryDays,
                    modificationRate: modifiedRate,
                    orderAccuracy: 100 - modifiedRate,
                    deliverySpeed: avgDeliveryDays <= 1 ? "Fast" : avgDeliveryDays <= 3 ? "Normal" : "Slow",
                },
            };
        }),

    /**
     * Get dashboard summary stats for the shop owner.
     */
    getDashboardStats: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/dashboard-stats",
            tags: ["Shop Owner"],
            summary: "Get shop owner dashboard summary stats",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Total B2B orders placed
            const [orderStats] = await db
                .select({
                    totalOrders: count(order.id),
                    totalSpent: sum(order.total),
                })
                .from(order)
                .where(eq(order.userId, userId));

            // Pending orders
            const [pendingStats] = await db
                .select({ count: count(order.id) })
                .from(order)
                .where(
                    and(
                        eq(order.userId, userId),
                        eq(order.status, "pending"),
                    ),
                );

            // Delivered orders
            const [deliveredStats] = await db
                .select({ count: count(order.id) })
                .from(order)
                .where(
                    and(
                        eq(order.userId, userId),
                        eq(order.status, "delivered"),
                    ),
                );

            // Retail catalog size (inventory items)
            const [inventoryStats] = await db
                .select({
                    totalProducts: count(inventory.id),
                    totalStock: sum(inventory.availableQty),
                })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "shop"),
                        eq(inventory.ownerId, userId),
                    ),
                );

            return {
                totalOrders: orderStats?.totalOrders || 0,
                totalSpent: Number(orderStats?.totalSpent || 0),
                pendingOrders: pendingStats?.count || 0,
                deliveredOrders: deliveredStats?.count || 0,
                retailProducts: inventoryStats?.totalProducts || 0,
                totalStock: Number(inventoryStats?.totalStock || 0),
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Incoming B2C Orders (consumers buying from this shop)
// ────────────────────────────────────────────────────────────────

const incomingOrderQueries = {
    /** List B2C consumer orders placed to this shop */
    getIncomingOrders: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/incoming-orders",
            tags: ["Shop Owner"],
            summary: "Get incoming B2C consumer orders for this shop",
        })
        .input(
            z.object({
                status: z.enum(["all", "pending", "confirmed", "processing", "delivered", "cancelled"]).default("all"),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const page = input.page;
            const limit = input.limit;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [
                eq(order.shopId, userId),
                eq(order.orderType, "b2c"),
            ];

            if (input.status !== "all") {
                conditions.push(eq(order.status, input.status));
            }

            const where = and(...conditions);

            const [orders, countResult] = await Promise.all([
                db
                    .select({
                        id: order.id,
                        orderNumber: order.orderNumber,
                        status: order.status,
                        total: order.total,
                        paymentMethod: order.paymentMethod,
                        paymentStatus: order.paymentStatus,
                        shippingName: order.shippingName,
                        shippingPhone: order.shippingPhone,
                        shippingAddress: order.shippingAddress,
                        shippingCity: order.shippingCity,
                        shippingArea: order.shippingArea,
                        customerNote: order.customerNote,
                        locationLat: order.locationLat,
                        locationLng: order.locationLng,
                        consumerAreaId: order.consumerAreaId,
                        createdAt: order.createdAt,
                        customerId: order.userId,
                        customerName: user.name,
                    })
                    .from(order)
                    .leftJoin(user, eq(order.userId, user.id))
                    .where(where)
                    .orderBy(desc(order.createdAt))
                    .limit(limit)
                    .offset(offset),
                db
                    .select({ count: count() })
                    .from(order)
                    .where(where),
            ]);

            // Fetch items for each order
            const orderIds = orders.map((o) => o.id);
            const items = orderIds.length > 0
                ? await db
                    .select()
                    .from(orderItem)
                    .where(inArray(orderItem.orderId, orderIds))
                : [];

            const itemsByOrder = new Map<number, typeof items>();
            for (const item of items) {
                const existing = itemsByOrder.get(item.orderId) || [];
                existing.push(item);
                itemsByOrder.set(item.orderId, existing);
            }

            const totalCount = Number(countResult[0]?.count) || 0;

            return {
                orders: orders.map((o) => ({
                    ...o,
                    items: itemsByOrder.get(o.id) || [],
                })),
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /** Update status of an incoming B2C order (confirm / cancel) */
    updateIncomingOrderStatus: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/incoming-orders/update-status",
            tags: ["Shop Owner"],
            summary: "Update status of an incoming B2C order",
        })
        .input(
            z.object({
                orderId: z.number(),
                status: z.enum(["confirmed", "processing", "delivered", "cancelled"]),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(
                    eq(order.id, input.orderId),
                    eq(order.shopId, userId),
                    eq(order.orderType, "b2c"),
                ),
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Order not found or not owned by your shop",
                });
            }

            const updateData: Record<string, any> = {
                status: input.status,
            };

            if (input.status === "confirmed") updateData.confirmedAt = new Date();
            if (input.status === "delivered") updateData.deliveredAt = new Date();
            if (input.status === "cancelled") updateData.cancelledAt = new Date();

            await db
                .update(order)
                .set(updateData)
                .where(eq(order.id, input.orderId));

            return {
                success: true,
                message: `Order ${existingOrder.orderNumber} updated to ${input.status}`,
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Warehouse Order Queries (Shop ordering from Warehouses)
// ────────────────────────────────────────────────────────────────

const warehouseOrderQueries = {
    /**
     * Place an order to a warehouse.
     * Creates order + items. Warehouse inventory is reserved during approval.
     */
    placeWarehouseOrder: shopOwnerProcedure
        .input(
            z.object({
                warehouseSlug: z.string(),
                items: z.array(
                    z.object({
                        variantId: z.number(),
                        quantity: z.number().min(1),
                        supplyMode: warehouseOrderModeSchema.optional(),
                        fulfillmentMode: warehouseOrderModeSchema.optional(),
                        targetVariantId: z.number().optional().nullable(),
                    }),
                ).min(1),
                shippingName: z.string().min(1),
                shippingPhone: z.string().min(1),
                shippingAddress: z.string().min(1),
                shippingCity: z.string().min(1),
                shippingArea: z.string().optional(),
                customerNote: z.string().optional(),
                paymentMethod: z.enum(["cash_on_delivery", "bkash", "nagad", "bank_transfer", "card"]).default("cash_on_delivery"),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Find warehouse
            const warehouseUser = await db
                .select({ id: user.id, name: user.name, warehouseName: user.warehouseName })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseSlug, input.warehouseSlug),
                        eq(user.role, "warehouse"),
                    ),
                )
                .limit(1);

            if (warehouseUser.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
            }

            const warehouseId = warehouseUser[0]!.id;

            // 1.5 Enforce explicit approval: check for an active connection
            const connection = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.shopId, userId),
                    eq(shopWarehouseConnection.warehouseId, warehouseId),
                    eq(shopWarehouseConnection.status, "active")
                )
            });

            if (!connection) {
                throw new ORPCError("FORBIDDEN", {
                    message: "You must be approved by this warehouse to place an order.",
                });
            }

            // 2. Validate each item: check inventory + get prices
            const validatedItems: {
                variantId: number;
                quantity: number;
                unitPrice: string;
                totalPrice: string;
                productName: string;
                productImage: string;
                productSize: string;
                productId: number;
                inventoryId: number;
                currentQty: string;
                supplyMode: string;
                targetVariantId: number | null;
            }[] = [];

            for (const item of input.items) {
                // Find inventory record
                const inv = await db.query.inventory.findFirst({
                    where: and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, warehouseId),
                        eq(inventory.variantId, item.variantId),
                    ),
                    with: {
                        variant: {
                            with: {
                                product: {
                                    columns: {
                                        id: true,
                                        name: true,
                                        image: true,
                                        size: true,
                                        trackingType: true,
                                        isReturnablePack: true,
                                    },
                                    with: {
                                        category: {
                                            columns: { id: true, name: true, slug: true },
                                            with: {
                                                type: {
                                                    columns: {
                                                        id: true,
                                                        name: true,
                                                        slug: true,
                                                        inventoryBehaviour: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                });

                if (!inv) {
                    throw new ORPCError("NOT_FOUND", {
                        message: `Variant ${item.variantId} is not available in this warehouse`,
                    });
                }

                const availableQty = Number(inv.availableQty);
                const [cartonCountResult] = await db
                    .select({ cnt: count() })
                    .from(carton)
                    .where(and(
                        eq(carton.warehouseId, warehouseId),
                        eq(carton.variantId, item.variantId),
                        eq(carton.status, "active"),
                    ));
                const activeCartonCount = cartonCountResult?.cnt ?? 0;
                const requestedMode = item.fulfillmentMode ?? item.supplyMode ?? "loose";
                const resolvedMode = resolveWarehouseOrderMode({
                    requestedMode,
                    fallbackMode: "loose",
                    activeCartonCount,
                    productType: {
                        typeName: inv.variant?.product?.category?.type?.name,
                        typeSlug: inv.variant?.product?.category?.type?.slug,
                        inventoryBehaviour:
                            inv.variant?.product?.category?.type?.inventoryBehaviour,
                        trackingType: inv.variant?.product?.trackingType,
                        isReturnablePack: inv.variant?.product?.isReturnablePack,
                    },
                });

                if (requestedMode && !resolvedMode.supportsRequestedMode) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `${requestedMode} mode is not supported for ${inv.variant?.product?.name || "this product type"}. Supported modes: ${resolvedMode.profile.supportedModes.join(", ")}`,
                    });
                }

                // Stock validation depends on the resolved fulfillment strategy:
                // - container_count: quantity is the number of cartons/boxes/bundles/drums
                // - direct_quantity: quantity is the number of direct units or loose units
                if (resolvedMode.stockStrategy === "container_count") {
                    if (activeCartonCount < item.quantity) {
                        throw new ORPCError("BAD_REQUEST", {
                            message: `Not enough ${resolvedMode.mode}s for ${inv.variant?.product?.name || "product"}. Available containers: ${activeCartonCount}, requested: ${item.quantity}`,
                        });
                    }
                } else {
                    if (availableQty < item.quantity) {
                        throw new ORPCError("BAD_REQUEST", {
                            message: `Insufficient ${resolvedMode.mode} stock for ${inv.variant?.product?.name || "product"}. Available: ${availableQty}, requested: ${item.quantity}`,
                        });
                    }
                }

                const rp = Number(inv.retailPrice || 0);
                const vp = Number(inv.variant?.price || 0);
                let unitPrice = rp > 0 ? inv.retailPrice! : vp > 0 ? inv.variant!.price! : "0";

                const isLooseVariant = (inv.variant?.packType || "").toLowerCase() === "loose";
                const isLooseOrder = resolvedMode.mode === "loose";
                const usesContainerPricing =
                    resolvedMode.stockStrategy === "container_count";

                if (isLooseOrder) {
                    // ═══ LOOSE ORDER: Use variant's base price directly — no carton calculation ═══
                    console.log(`[ORDER-PRICE] variant=${item.variantId}: Loose order — using base variant price: ${unitPrice}`);
                } else if (usesContainerPricing) {
                    // ═══ PACK/CARTON ORDER: Resolve per-carton price ═══

                    // Look up carton and config for carton pricing
                    const activeCarton = await db.query.carton.findFirst({
                        where: and(
                            eq(carton.warehouseId, warehouseId),
                            eq(carton.variantId, item.variantId),
                            eq(carton.status, "active"),
                        ),
                        with: {
                            config: {
                                columns: { cartonPrice: true, deliveryCostPerCarton: true },
                            },
                        },
                    });

                    // Also look up cartonConfig directly as fallback
                    const variantConfig = await db.query.cartonConfig.findFirst({
                        where: and(
                            eq(cartonConfig.variantId, item.variantId),
                            eq(cartonConfig.isActive, true),
                        ),
                        orderBy: [desc(cartonConfig.isDefault)],
                    });

                    // Price resolution: carton.cartonPrice → carton.config.cartonPrice → cartonConfig.cartonPrice → calculated
                    const cartonRecordPrice = Number(activeCarton?.cartonPrice || 0);
                    const linkedConfigPrice = Number((activeCarton as any)?.config?.cartonPrice || 0);
                    const directConfigPrice = Number(variantConfig?.cartonPrice || 0);

                    if (cartonRecordPrice > 0) {
                        unitPrice = activeCarton!.cartonPrice!;
                        console.log(`[ORDER-PRICE] variant=${item.variantId}: Using carton record price: ${unitPrice}`);
                    } else if (linkedConfigPrice > 0) {
                        unitPrice = (activeCarton as any).config.cartonPrice;
                        console.log(`[ORDER-PRICE] variant=${item.variantId}: Using linked config price: ${unitPrice}`);
                    } else if (directConfigPrice > 0) {
                        unitPrice = variantConfig!.cartonPrice;
                        console.log(`[ORDER-PRICE] variant=${item.variantId}: Using direct config price: ${unitPrice}`);
                    } else if (isLooseVariant && activeCarton) {
                        // Loose fallback: calculate from per-KG price × carton weight
                        const variantWeightKg = Number(inv.variant?.weightKg || 0);
                        const rawUnitPrice = Number(unitPrice);
                        const cartonWeightKg = Number(activeCarton.totalWeightKg) || 0;
                        const perKg = variantWeightKg > 0 ? rawUnitPrice / variantWeightKg : rawUnitPrice;
                        unitPrice = (perKg * cartonWeightKg).toFixed(2);
                        console.log(`[ORDER-PRICE] variant=${item.variantId}: Loose calc: perKg=${perKg}, cartonKg=${cartonWeightKg}, price=${unitPrice}`);
                    } else if (!isLooseVariant && activeCarton) {
                        // Pack fallback: multiply per-pack price by packs per carton
                        const packsPerCarton = activeCarton.totalPacks || 0;
                        if (packsPerCarton > 0) {
                            unitPrice = (Number(unitPrice) * packsPerCarton).toFixed(2);
                            console.log(`[ORDER-PRICE] variant=${item.variantId}: Pack calc: packPrice=${inv.retailPrice || inv.variant?.price} × ${packsPerCarton} = ${unitPrice}`);
                        }
                    } else {
                        console.log(`[ORDER-PRICE] variant=${item.variantId}: No carton found, using raw pack price: ${unitPrice}`);
                    }
                } else {
                    console.log(
                        `[ORDER-PRICE] variant=${item.variantId}: Direct ${resolvedMode.mode} order — using base variant price: ${unitPrice}`,
                    );
                }

                const totalPrice = (Number(unitPrice) * item.quantity).toFixed(2);

                // Validate targetVariantId for pack mode
                let resolvedTargetVariantId: number | null = item.targetVariantId ?? null;
                if (item.supplyMode === "pack" && item.targetVariantId) {
                    const targetVar = await db.query.productVariant.findFirst({
                        where: and(
                            eq(productVariant.id, item.targetVariantId),
                            eq(productVariant.productId, inv.variant?.product?.id || 0),
                        ),
                    });
                    if (!targetVar) {
                        throw new ORPCError("BAD_REQUEST", {
                            message: `Target variant ${item.targetVariantId} not found for product ${inv.variant?.product?.name}`,
                        });
                    }
                }

                validatedItems.push({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitPrice,
                    totalPrice,
                    productName: inv.variant?.product?.name || "Unknown",
                    productImage: inv.variant?.product?.image || "",
                    productSize: inv.variant?.unitLabel || inv.variant?.product?.size || "",
                    productId: inv.variant?.product?.id || 0,
                    inventoryId: inv.id,
                    currentQty: inv.availableQty,
                    supplyMode: resolvedMode.mode,
                    targetVariantId: resolvedTargetVariantId,
                });
            }

            // 3. Calculate totals
            const subtotal = validatedItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
            const total = subtotal; // No shipping cost for B2B

            // 4. Generate order number
            const orderNumber = `WO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

            // 5. Create order + items + deduct inventory in a transaction
            const result = await db.transaction(async (tx) => {
                // Create order
                const [newOrder] = await tx
                    .insert(order)
                    .values({
                        orderNumber,
                        userId,
                        orderType: "b2b",
                        orderSource: "direct",
                        warehouseId,
                        subtotal: subtotal.toFixed(2),
                        total: total.toFixed(2),
                        status: "pending",
                        paymentStatus: "pending",
                        paymentMethod: input.paymentMethod,
                        shippingName: input.shippingName,
                        shippingPhone: input.shippingPhone,
                        shippingAddress: input.shippingAddress,
                        shippingCity: input.shippingCity,
                        shippingArea: input.shippingArea || null,
                        customerNote: input.customerNote || null,
                    })
                    .returning();

                // Create order items
                for (const item of validatedItems) {
                    await tx.insert(orderItem).values({
                        orderId: newOrder!.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        productName: item.productName,
                        productImage: item.productImage,
                        productSize: item.productSize,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                        supplyMode: item.supplyMode,
                        targetVariantId: item.targetVariantId,
                        conversionStatus: "pending",
                    });
                }

                return newOrder!;
            });

            // 6. Upsert shop↔warehouse connection (smart memory)
            const existing = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.shopId, userId),
                    eq(shopWarehouseConnection.warehouseId, warehouseId),
                ),
            });
            if (existing) {
                await db
                    .update(shopWarehouseConnection)
                    .set({ lastOrderedAt: new Date() })
                    .where(eq(shopWarehouseConnection.id, existing.id));
            } else {
                await db.insert(shopWarehouseConnection).values({
                    shopId: userId,
                    warehouseId,
                    status: "active",
                    connectedAt: new Date(),
                    lastOrderedAt: new Date(),
                });
            }

            return {
                success: true,
                order: result,
                message: `Order ${orderNumber} placed successfully to ${warehouseUser[0]!.warehouseName || warehouseUser[0]!.name}`,
            };
        }),

    /**
     * Get orders the shop placed to warehouses.
     */
    getMyWarehouseOrders: shopOwnerProcedure
        .input(
            z.object({
                status: z.enum(["pending", "confirmed", "processing", "delivered", "cancelled"]).optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { page, limit } = input;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [
                eq(order.userId, userId),
                sql`${order.warehouseId} IS NOT NULL`,
            ];
            if (input.status) conditions.push(eq(order.status, input.status));

            const where = and(...conditions);

            const [orders, countResult] = await Promise.all([
                db.query.order.findMany({
                    where,
                    with: {
                        items: {
                            columns: {
                                id: true,
                                productName: true,
                                productImage: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                            },
                        },
                    },
                    orderBy: [desc(order.createdAt)],
                    limit,
                    offset,
                }),
                db
                    .select({ count: count() })
                    .from(order)
                    .where(where),
            ]);

            // Get warehouse names
            const warehouseIds = [...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean))];
            let warehouseMap = new Map<string, string>();
            if (warehouseIds.length > 0) {
                const warehouses = await db
                    .select({ id: user.id, warehouseName: user.warehouseName, name: user.name })
                    .from(user)
                    .where(inArray(user.id, warehouseIds as string[]));
                for (const w of warehouses) {
                    warehouseMap.set(w.id, w.warehouseName || w.name || "Unknown");
                }
            }

            const totalCount = countResult[0]?.count || 0;

            return {
                orders: orders.map((o: any) => ({
                    ...o,
                    warehouseName: warehouseMap.get(o.warehouseId) || "Unknown Warehouse",
                })),
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(Number(totalCount) / limit),
                },
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Open Order Endpoints (Shop Owner bidding)
// ────────────────────────────────────────────────────────────────

const openOrderEndpoints = {
    /** List available open orders for this shop (broadcasts) */
    getOpenOrderPool: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/open-orders/pool",
            tags: ["Shop Owner", "Open Order"],
            summary: "Get available open order broadcasts",
        })
        .handler(async ({ context }) => {
            const shopId = context.session.user.id;

            // Get all bids for this shop that are available or locked (by this shop)
            const bids = await db
                .select({
                    bidId: openOrderBid.id,
                    subOrderId: openOrderBid.subOrderId,
                    status: openOrderBid.status,
                    rank: openOrderBid.rank,
                    distanceKm: openOrderBid.distanceKm,
                    lockedAt: openOrderBid.lockedAt,
                    expiresAt: openOrderBid.expiresAt,
                    timeoutSeconds: openOrderBid.timeoutSeconds,
                    createdAt: openOrderBid.createdAt,
                    // Order data
                    orderNumber: order.orderNumber,
                    orderSubtotal: order.subtotal,
                    subOrderLabel: order.subOrderLabel,
                    broadcastExpiresAt: order.broadcastExpiresAt,
                    shippingAddress: order.shippingAddress,
                    shippingCity: order.shippingCity,
                    shippingArea: order.shippingArea,
                })
                .from(openOrderBid)
                .innerJoin(order, eq(order.id, openOrderBid.subOrderId))
                .where(
                    and(
                        eq(openOrderBid.shopId, shopId),
                        inArray(openOrderBid.status, ["available", "locked"]),
                        inArray(order.status, ["matching_shop", "negotiating"]),
                    ),
                )
                .orderBy(asc(openOrderBid.createdAt));

            // For each bid, get the order items
            const result = await Promise.all(
                bids.map(async (bid) => {
                    // Check for expired locks lazily
                    if (bid.status === "locked" && bid.expiresAt && new Date() > bid.expiresAt) {
                        await db
                            .update(openOrderBid)
                            .set({ status: "expired" })
                            .where(eq(openOrderBid.id, bid.bidId));
                        return null; // Skip expired bids
                    }

                    const items = await db.query.orderItem.findMany({
                        where: eq(orderItem.orderId, bid.subOrderId),
                    });

                    return {
                        bidId: bid.bidId,
                        subOrderId: bid.subOrderId,
                        status: bid.status,
                        rank: bid.rank,
                        distanceKm: bid.distanceKm,
                        orderNumber: bid.orderNumber,
                        subOrderLabel: bid.subOrderLabel,
                        subtotal: bid.orderSubtotal,
                        broadcastExpiresAt: bid.broadcastExpiresAt?.toISOString() ?? null,
                        lockedAt: bid.lockedAt?.toISOString() ?? null,
                        expiresAt: bid.expiresAt?.toISOString() ?? null,
                        timeoutSeconds: bid.timeoutSeconds,
                        shippingArea: bid.shippingArea ?? bid.shippingCity,
                        items: items.map((i) => ({
                            id: i.id,
                            productName: i.productName,
                            productImage: i.productImage,
                            productSize: i.productSize,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                            totalPrice: i.totalPrice,
                        })),
                    };
                }),
            );

            return { pool: result.filter(Boolean) };
        }),

    /** Lock a bid — starts the countdown timer */
    lockOpenOrder: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/open-orders/lock",
            tags: ["Shop Owner", "Open Order"],
            summary: "Lock an open order bid to start negotiating",
        })
        .input(z.object({ bidId: z.number() }))
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            // Get the bid
            const bid = await db.query.openOrderBid.findFirst({
                where: and(
                    eq(openOrderBid.id, input.bidId),
                    eq(openOrderBid.shopId, shopId),
                ),
            });

            if (!bid) {
                throw new ORPCError("NOT_FOUND", { message: "Bid not found" });
            }
            if (bid.status !== "available") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Cannot lock bid with status '${bid.status}'`,
                });
            }

            const now = new Date();
            const expiresAt = new Date(now.getTime() + bid.timeoutSeconds * 1000);

            // Lock the bid
            const [updated] = await db
                .update(openOrderBid)
                .set({
                    status: "locked",
                    lockedAt: now,
                    expiresAt,
                })
                .where(eq(openOrderBid.id, bid.id))
                .returning();

            // Update sub-order status to negotiating
            await db
                .update(order)
                .set({ status: "negotiating" })
                .where(eq(order.id, bid.subOrderId));

            // Get bid items
            const bidItems = await db.query.openOrderBidItem.findMany({
                where: eq(openOrderBidItem.bidId, bid.id),
            });

            return {
                success: true,
                bid: {
                    id: updated!.id,
                    status: updated!.status,
                    lockedAt: updated!.lockedAt?.toISOString(),
                    expiresAt: updated!.expiresAt?.toISOString(),
                    timeoutSeconds: updated!.timeoutSeconds,
                },
                items: bidItems.map((bi) => ({
                    id: bi.id,
                    orderItemId: bi.orderItemId,
                    platformPrice: bi.platformPrice,
                    sellerPrice: bi.sellerPrice,
                })),
            };
        }),

    /** Submit an offer with per-item prices and delivery charge */
    submitOffer: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/open-orders/submit",
            tags: ["Shop Owner", "Open Order"],
            summary: "Submit a bid offer with prices",
        })
        .input(
            z.object({
                bidId: z.number(),
                deliveryCharge: z.string(),
                items: z.array(
                    z.object({
                        bidItemId: z.number(),
                        sellerPrice: z.string(),
                    }),
                ),
            }),
        )
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            // Get the bid
            const bid = await db.query.openOrderBid.findFirst({
                where: and(
                    eq(openOrderBid.id, input.bidId),
                    eq(openOrderBid.shopId, shopId),
                ),
            });

            if (!bid) {
                throw new ORPCError("NOT_FOUND", { message: "Bid not found" });
            }
            if (bid.status !== "locked") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Cannot submit offer on bid with status '${bid.status}'`,
                });
            }

            // Check if lock has expired
            if (bid.expiresAt && new Date() > bid.expiresAt) {
                await db
                    .update(openOrderBid)
                    .set({ status: "expired" })
                    .where(eq(openOrderBid.id, bid.id));
                throw new ORPCError("BAD_REQUEST", {
                    message: "Lock has expired. Please try a new order.",
                });
            }

            // Update seller prices on each bid item
            let totalItemCost = 0;
            for (const item of input.items) {
                // Get the bid item to know the quantity
                const bidItem = await db.query.openOrderBidItem.findFirst({
                    where: eq(openOrderBidItem.id, item.bidItemId),
                });
                if (!bidItem) continue;

                await db
                    .update(openOrderBidItem)
                    .set({ sellerPrice: item.sellerPrice })
                    .where(eq(openOrderBidItem.id, item.bidItemId));

                // Get quantity from the order item
                const oi = await db.query.orderItem.findFirst({
                    where: eq(orderItem.id, bidItem.orderItemId),
                });
                totalItemCost += Number(item.sellerPrice) * (oi?.quantity ?? 1);
            }

            const totalBid = totalItemCost + Number(input.deliveryCharge);

            // Update bid: submitted
            const [updated] = await db
                .update(openOrderBid)
                .set({
                    status: "submitted",
                    submittedAt: new Date(),
                    deliveryCharge: input.deliveryCharge,
                    totalBid: totalBid.toFixed(2),
                })
                .where(eq(openOrderBid.id, bid.id))
                .returning();

            return {
                success: true,
                bid: {
                    id: updated!.id,
                    status: updated!.status,
                    totalBid: updated!.totalBid,
                    deliveryCharge: updated!.deliveryCharge,
                    submittedAt: updated!.submittedAt?.toISOString(),
                },
            };
        }),

    /** Release a locked bid — order goes back to pool */
    releaseOpenOrder: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/open-orders/release",
            tags: ["Shop Owner", "Open Order"],
            summary: "Release a locked open order bid",
        })
        .input(z.object({ bidId: z.number() }))
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            const bid = await db.query.openOrderBid.findFirst({
                where: and(
                    eq(openOrderBid.id, input.bidId),
                    eq(openOrderBid.shopId, shopId),
                ),
            });

            if (!bid) {
                throw new ORPCError("NOT_FOUND", { message: "Bid not found" });
            }
            if (bid.status !== "locked") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Cannot release bid with status '${bid.status}'`,
                });
            }

            await db
                .update(openOrderBid)
                .set({
                    status: "released",
                    lockedAt: null,
                    expiresAt: null,
                })
                .where(eq(openOrderBid.id, bid.id));

            return { success: true };
        }),
};

// ────────────────────────────────────────────────────────────────
// Warehouse Connection & Category Matching (Steps 2-7)
// ────────────────────────────────────────────────────────────────

const warehouseConnectionEndpoints = {
    /**
     * Preview warehouse details before connecting
     */
    lookupWarehouseByCode: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/lookup-warehouse",
            tags: ["Shop Owner"],
            summary: "Lookup warehouse by code/slug without connecting",
        })
        .input(
            z.object({
                warehouseSlug: z.string().min(1),
            }),
        )
        .handler(async ({ input }) => {
            const warehouseUser = await db
                .select({
                    id: user.id,
                    name: user.name,
                    warehouseName: user.warehouseName,
                    warehouseAddress: user.warehouseAddress,
                    warehouseSlug: user.warehouseSlug,
                    image: user.image,
                })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseSlug, input.warehouseSlug),
                        eq(user.role, "warehouse"),
                    ),
                )
                .limit(1);

            if (warehouseUser.length === 0) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Warehouse not found",
                });
            }

            const wh = warehouseUser[0]!;

            // Get product count
            const [countResult] = await db
                .select({ count: count() })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, wh.id),
                        sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
                    ),
                );

            return {
                warehouse: {
                    ...wh,
                    productCount: countResult?.count || 0,
                },
            };
        }),

    /**
     * Connect to a warehouse (Request Access).
     * Always creates a pending request requiring manual approval.
     */
    connectToWarehouse: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/connect-to-warehouse",
            tags: ["Shop Owner"],
            summary: "Request access to a warehouse",
        })
        .input(
            z.object({
                warehouseSlug: z.string().min(1),
            }),
        )
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            // 1. Validate warehouse exists
            const warehouseUser = await db
                .select({
                    id: user.id,
                    name: user.name,
                    warehouseName: user.warehouseName,
                    warehouseAddress: user.warehouseAddress,
                    warehouseSlug: user.warehouseSlug,
                })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseSlug, input.warehouseSlug),
                        eq(user.role, "warehouse"),
                    ),
                )
                .limit(1);

            if (warehouseUser.length === 0) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Invalid Warehouse — warehouse not found",
                });
            }

            const warehouseId = warehouseUser[0]!.id;

            // 2. Check existing connection status
            const existingConn = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.shopId, shopId),
                    eq(shopWarehouseConnection.warehouseId, warehouseId),
                ),
            });

            if (existingConn) {
                if (existingConn.status === "active") {
                    return {
                        status: "already_connected" as const,
                        connectionId: existingConn.id,
                        warehouse: warehouseUser[0]!,
                        message: "You are already connected to this warehouse.",
                    };
                }
                
                if (existingConn.status === "pending") {
                    return {
                        status: "already_pending" as const,
                        connectionId: existingConn.id,
                        warehouse: warehouseUser[0]!,
                        message: "Your request is already pending approval.",
                    };
                }

                // If disconnected, reactivate as pending
                await db
                    .update(shopWarehouseConnection)
                    .set({ status: "pending", connectedAt: null })
                    .where(eq(shopWarehouseConnection.id, existingConn.id));
                
                return {
                    status: "pending" as const,
                    warehouse: warehouseUser[0]!,
                    message: "Connection request sent successfully.",
                };
            }

            // 3. Create new pending connection request
            await db.insert(shopWarehouseConnection).values({
                shopId,
                warehouseId,
                status: "pending",
            });

            return {
                status: "pending" as const,
                warehouse: warehouseUser[0]!,
                message: "Connection request sent successfully.",
            };
        }),

    /**
     * Get all connected/pending warehouses for this shop
     */
    getMyWarehouses: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/my-warehouses",
            tags: ["Shop Owner"],
            summary: "Get all warehouse connections (active/pending/rejected)",
        })
        .input(
            z.object({
                status: z.enum(["all", "active", "pending", "disconnected"]).default("all"),
            }).optional(),
        )
        .handler(
            async ({ context, input }) => {
                const shopId = context.session.user.id;
                const statusFilter = input?.status || "all";

                const conditions: SQL[] = [eq(shopWarehouseConnection.shopId, shopId)];
                if (statusFilter !== "all") {
                    conditions.push(eq(shopWarehouseConnection.status, statusFilter));
                }

                const connections = await db
                    .select({
                        connectionId: shopWarehouseConnection.id,
                        status: shopWarehouseConnection.status,
                        connectedAt: shopWarehouseConnection.connectedAt,
                        lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                        warehouseId: user.id,
                        warehouseName: user.warehouseName,
                        warehouseSlug: user.warehouseSlug,
                        warehouseAddress: user.warehouseAddress,
                        name: user.name,
                        image: user.image,
                    })
                    .from(shopWarehouseConnection)
                    .innerJoin(
                        user,
                        eq(shopWarehouseConnection.warehouseId, user.id),
                    )
                    .where(and(...conditions))
                    .orderBy(desc(shopWarehouseConnection.lastOrderedAt), desc(shopWarehouseConnection.connectedAt));

                // Get product counts for active warehouses
                const result = await Promise.all(
                    connections.map(async (conn) => {
                        if (conn.status !== "active") {
                            return { ...conn, productCount: 0 };
                        }
                        
                        const [countResult] = await db
                            .select({ count: count() })
                            .from(inventory)
                            .where(
                                and(
                                    eq(inventory.ownerType, "warehouse"),
                                    eq(inventory.ownerId, conn.warehouseId),
                                    sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
                                ),
                            );

                        return {
                            ...conn,
                            productCount: countResult?.count || 0,
                        };
                    }),
                );

                return { warehouses: result };
            },
        ),

    /**
     * Cancel a pending warehouse connection request
     */
    cancelWarehouseRequest: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/cancel-warehouse-request",
            tags: ["Shop Owner"],
            summary: "Cancel a pending warehouse request",
        })
        .input(
            z.object({
                connectionId: z.number(),
            }),
        )
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            const existingConn = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.id, input.connectionId),
                    eq(shopWarehouseConnection.shopId, shopId),
                    eq(shopWarehouseConnection.status, "pending")
                ),
            });

            if (!existingConn) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Pending request not found",
                });
            }

            await db.delete(shopWarehouseConnection).where(eq(shopWarehouseConnection.id, input.connectionId));

            return { success: true, message: "Request cancelled" };
        }),

    /**
     * Disconnect from an active warehouse
     */
    disconnectWarehouse: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/shop-owner/disconnect-warehouse",
            tags: ["Shop Owner"],
            summary: "Disconnect from an active warehouse",
        })
        .input(
            z.object({
                connectionId: z.number(),
            }),
        )
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            const existingConn = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.id, input.connectionId),
                    eq(shopWarehouseConnection.shopId, shopId),
                    eq(shopWarehouseConnection.status, "active")
                ),
            });

            if (!existingConn) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Active connection not found",
                });
            }

            await db
                .update(shopWarehouseConnection)
                .set({ status: "disconnected" })
                .where(eq(shopWarehouseConnection.id, input.connectionId));

            return { success: true, message: "Disconnected successfully" };
        }),

    /**
     * Step 7: Get recently connected warehouses (smart memory).
     * Sorted by lastOrderedAt descending. (Alias for backwards compatibility)
     */
    getConnectedWarehouses: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/connected-warehouses",
            tags: ["Shop Owner"],
            summary: "Get recently connected warehouses (smart memory)",
        })
        .handler(
            async ({ context }) => {
                const shopId = context.session.user.id;

                const connections = await db
                    .select({
                        connectionId: shopWarehouseConnection.id,
                        status: shopWarehouseConnection.status,
                        connectedAt: shopWarehouseConnection.connectedAt,
                        lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                        warehouseId: user.id,
                        warehouseName: user.warehouseName,
                        warehouseSlug: user.warehouseSlug,
                        warehouseAddress: user.warehouseAddress,
                        name: user.name,
                    })
                    .from(shopWarehouseConnection)
                    .innerJoin(
                        user,
                        eq(shopWarehouseConnection.warehouseId, user.id),
                    )
                    .where(
                        and(
                            eq(shopWarehouseConnection.shopId, shopId),
                            eq(shopWarehouseConnection.status, "active"),
                        ),
                    )
                    .orderBy(desc(shopWarehouseConnection.lastOrderedAt));

                // Get product counts for each warehouse
                const result = await Promise.all(
                    connections.map(async (conn) => {
                        const [countResult] = await db
                            .select({ count: count() })
                            .from(inventory)
                            .where(
                                and(
                                    eq(inventory.ownerType, "warehouse"),
                                    eq(inventory.ownerId, conn.warehouseId),
                                    sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
                                ),
                            );

                        return {
                            ...conn,
                            productCount: countResult?.count || 0,
                        };
                    }),
                );

                return { warehouses: result };
            },
        ),

    /**
     * Step 4: Get warehouse products filtered by shop's allowed categories.
     * Products in shop's allowed categories → canOrder: true
     * Products outside → canOrder: false ("Request Access")
     */
    getWarehouseProductsFiltered: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/shop-owner/warehouse-products-filtered",
            tags: ["Shop Owner"],
            summary: "Get warehouse products filtered by shop allowed categories",
        })
        .input(
            z.object({
                warehouseSlug: z.string().min(1),
                search: z.string().optional(),
                page: z.string().default("1"),
                limit: z.string().default("50"),
            }),
        )
        .handler(async ({ context, input }) => {
            const shopId = context.session.user.id;

            // Find warehouse
            const warehouseUser = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseSlug, input.warehouseSlug),
                        eq(user.role, "warehouse"),
                    ),
                )
                .limit(1);

            if (warehouseUser.length === 0) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Warehouse not found",
                });
            }

            const warehouseId = warehouseUser[0]!.id;

            // Enforce explicit approval: check for an active connection
            const connection = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.shopId, shopId),
                    eq(shopWarehouseConnection.warehouseId, warehouseId),
                    eq(shopWarehouseConnection.status, "active")
                )
            });

            if (!connection) {
                throw new ORPCError("FORBIDDEN", {
                    message: "You must be approved by this warehouse to view its catalog",
                });
            }

            // Get shop's allowed subcategory IDs and category IDs
            const shopAssignments = await db
                .select({
                    categoryId: shopCategoryAssignment.categoryId,
                    subcategoryId: shopCategoryAssignment.subcategoryId,
                })
                .from(shopCategoryAssignment)
                .where(eq(shopCategoryAssignment.shopId, shopId));

            const allowedSubcatIds = new Set(
                shopAssignments
                    .map((a) => a.subcategoryId)
                    .filter(Boolean) as number[],
            );
            const allowedCatIds = new Set(
                shopAssignments.map((a) => a.categoryId),
            );
            const hasAssignments = shopAssignments.length > 0;

            // Get warehouse inventory with product info
            const page = Math.max(1, Number(input.page) || 1);
            const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, warehouseId),
                sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
            ];

            if (input.search) {
                const s = `%${input.search}%`;
                conditions.push(
                    or(
                        ilike(product.name, s),
                        ilike(productVariant.sku ?? "", s),
                    )!,
                );
            }

            const items = await db
                .select({
                    inventoryId: inventory.id,
                    variantId: inventory.variantId,
                    availableQty: inventory.availableQty,
                    inCartonQty: inventory.inCartonQty,
                    retailPrice: inventory.retailPrice,
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    productSize: product.size,
                    productCategoryId: product.categoryId,
                    productSubCategoryId: product.subCategoryId,
                    categoryName: category.name,
                    variantUnitLabel: productVariant.unitLabel,
                    variantWeightKg: productVariant.weightKg,
                    variantSku: productVariant.sku,
                    variantPrice: productVariant.price,
                    variantPackType: productVariant.packType,
                    variantInnerPackSizeKg: productVariant.innerPackSizeKg,
                    variantPackCountInside: productVariant.packCountInside,
                    productUnitSize: product.size,
                    productBrandId: product.brandId,
                    variantBrandId: productVariant.brandId,
                    brandName: brand.name,
                })
                .from(inventory)
                .innerJoin(
                    productVariant,
                    eq(inventory.variantId, productVariant.id),
                )
                .innerJoin(
                    product,
                    eq(productVariant.productId, product.id),
                )
                .leftJoin(
                    category,
                    eq(product.categoryId, category.id),
                )
                // Prefer variant-level brand, fall back to product-level brand
                .leftJoin(
                    brand,
                    eq(brand.id, sql`COALESCE(${productVariant.brandId}, ${product.brandId})`),
                )
                .where(and(...conditions))
                .orderBy(asc(category.name), asc(product.name))
                .limit(limit)
                .offset(offset);

            // Annotate each product with canOrder flag
            const products = items.map((item) => {
                let canOrder = true;
                if (hasAssignments) {
                    const subCatMatch = item.productSubCategoryId
                        ? allowedSubcatIds.has(item.productSubCategoryId)
                        : false;
                    const catMatch = allowedCatIds.has(item.productCategoryId);
                    canOrder = subCatMatch || catMatch;
                }

                const rp = Number(item.retailPrice || 0);
                const vp = Number(item.variantPrice || 0);
                const price = rp > 0 ? String(rp) : vp > 0 ? String(vp) : "0";

                // Track both total pack stock and loose (non-carton) stock
                const rawQty = Number(item.availableQty || 0);
                const inCarton = Number(item.inCartonQty || 0);
                const effectiveQty = Math.max(0, rawQty - inCarton);

                return {
                    inventoryId: item.inventoryId,
                    variantId: item.variantId,
                    availableQty: effectiveQty.toFixed(2),
                    totalPackStock: rawQty.toFixed(2),
                    price,
                    canOrder,
                    product: {
                        id: item.productId,
                        name: item.productName,
                        image: item.productImage,
                        size: item.productSize,
                        unitSize: item.productUnitSize,
                        categoryName: item.categoryName || "Uncategorized",
                    },
                    variant: {
                        unitLabel: item.variantUnitLabel,
                        weightKg: item.variantWeightKg,
                        sku: item.variantSku,
                        price: item.variantPrice,
                        packType: item.variantPackType,
                        innerPackSizeKg: item.variantInnerPackSizeKg,
                        packCountInside: item.variantPackCountInside,
                        brandId: item.variantBrandId ?? item.productBrandId,
                        brandName: item.brandName,
                    },
                };
            });

            // Enrich with carton data per variant (single query)
            const allVariantIds = products.map((p) => p.variantId);
            let cartonMap = new Map<number, { cartonCount: number; totalWeightKg: number }>();
            const cartonOptionsByVariant = new Map<number, { weightKg: number; count: number; totalKg: number; packsPerCarton: number }[]>();

            if (allVariantIds.length > 0) {
                const activeCartons = await db.query.carton.findMany({
                    where: and(
                        eq(carton.warehouseId, warehouseId),
                        eq(carton.status, "active"),
                        inArray(carton.variantId, allVariantIds),
                    ),
                    with: {
                        config: {
                            columns: { cartonPrice: true, deliveryCostPerCarton: true },
                        },
                    },
                });

                // Also query cartonConfig directly for variants without linked config
                const configs = await db.query.cartonConfig.findMany({
                    where: and(
                        inArray(cartonConfig.variantId, allVariantIds),
                        eq(cartonConfig.isActive, true),
                    ),
                });
                const configPriceMap = new Map<number, string>();
                const configDeliveryCostMap = new Map<number, string>();
                for (const cfg of configs) {
                    if (!configPriceMap.has(cfg.variantId) || cfg.isDefault) {
                        configPriceMap.set(cfg.variantId, cfg.cartonPrice);
                        if (cfg.deliveryCostPerCarton) {
                            configDeliveryCostMap.set(cfg.variantId, cfg.deliveryCostPerCarton);
                        }
                    }
                }

                for (const c of activeCartons) {
                    // Build cartonMap (totals per variant)
                    if (!cartonMap.has(c.variantId)) {
                        cartonMap.set(c.variantId, { cartonCount: 0, totalWeightKg: 0 });
                    }
                    const entry = cartonMap.get(c.variantId)!;
                    entry.cartonCount += 1;
                    entry.totalWeightKg += parseFloat(c.totalWeightKg);

                    // Build cartonOptions (grouped by weight per variant)
                    if (!cartonOptionsByVariant.has(c.variantId)) {
                        cartonOptionsByVariant.set(c.variantId, []);
                    }
                    const list = cartonOptionsByVariant.get(c.variantId)!;
                    const wt = parseFloat(c.totalWeightKg);
                    const existing = list.find((o) => o.totalKg === wt);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        // Price priority: carton record → linked config → config by variantId → null
                        const linkedConfigPrice = (c as any).config?.cartonPrice || null;
                        const linkedConfigDelivery = (c as any).config?.deliveryCostPerCarton || null;
                        const resolvedPrice = c.cartonPrice || linkedConfigPrice || configPriceMap.get(c.variantId) || null;
                        const resolvedDelivery = c.deliveryCostPerUnit || linkedConfigDelivery || configDeliveryCostMap.get(c.variantId) || null;

                        console.log(`[CARTON PRICE DEBUG] variant=${c.variantId} carton.cartonPrice=${c.cartonPrice} linkedConfig=${linkedConfigPrice} configMap=${configPriceMap.get(c.variantId)} → resolved=${resolvedPrice}`);

                        list.push({
                            weightKg: wt,
                            totalKg: wt,
                            count: 1,
                            packsPerCarton: c.totalPacks || 0,
                            cartonPrice: resolvedPrice,
                            deliveryCost: resolvedDelivery,
                        });
                    }
                }
            }

            const enrichedProducts = products.map((p) => {
                const cd = cartonMap.get(p.variantId);
                const opts = cartonOptionsByVariant.get(p.variantId) || [];
                return {
                    ...p,
                    variant: {
                        ...p.variant,
                        cartonCount: cd?.cartonCount ?? 0,
                        totalCartonCount: cd?.cartonCount ?? 0,
                        cartonWeightKg: (cd?.totalWeightKg ?? 0).toFixed(1),
                        cartonOptions: opts,
                    },
                };
            });

            return { products: enrichedProducts };
        }),
};

// ────────────────────────────────────────────────────────────────
// Public Shop Storefront Queries (accessible by anyone with the shopSlug)
// ────────────────────────────────────────────────────────────────

const shopStorefrontEndpoints = {
    /**
     * Get shop info by slug (public).
     */
    getShopStorefrontBySlug: publicProcedure
        .route({
            method: "GET",
            path: "/shopOwner/storefront/{slug}",
            tags: ["Shop Storefront"],
            summary: "Get shop storefront info by slug",
        })
        .input(z.object({ slug: z.string() }))
        .handler(async ({ input }) => {
            const shopUser = await db
                .select({
                    id: user.id,
                    name: user.name,
                    shopName: user.shopName,
                    shopSlug: user.shopSlug,
                    shopAddress: user.shopAddress,
                    image: user.image,
                })
                .from(user)
                .where(
                    and(
                        eq(user.shopSlug, input.slug),
                        eq(user.isSeller, true),
                    ),
                )
                .limit(1);

            if (shopUser.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
            }

            const shop = shopUser[0]!;

            // Count products in this shop's inventory
            const [productCount] = await db
                .select({ count: count() })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "shop"),
                        eq(inventory.ownerId, shop.id),
                        sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                    ),
                );

            return {
                ...shop,
                productCount: productCount?.count || 0,
            };
        }),

    /**
     * Get categories available in a shop storefront (public).
     */
    getShopStorefrontCategories: publicProcedure
        .route({
            method: "GET",
            path: "/shopOwner/storefront/{slug}/categories",
            tags: ["Shop Storefront"],
            summary: "Get shop storefront categories",
        })
        .input(z.object({ slug: z.string() }))
        .handler(async ({ input }) => {
            const shopUser = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.shopSlug, input.slug),
                        eq(user.isSeller, true),
                    ),
                )
                .limit(1);

            if (shopUser.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
            }

            const shopId = shopUser[0]!.id;

            // Get all inventory with product/category info
            const inventoryItems = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, shopId),
                    sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { id: true, name: true, slug: true } },
                                },
                            },
                        },
                    },
                },
            });

            // Extract unique categories
            const categoryMap = new Map<number, { id: number; name: string; slug: string; productCount: number }>();
            for (const inv of inventoryItems) {
                const cat = inv.variant?.product?.category;
                if (!cat) continue;
                const existing = categoryMap.get(cat.id);
                if (existing) {
                    existing.productCount++;
                } else {
                    categoryMap.set(cat.id, {
                        id: cat.id,
                        name: cat.name,
                        slug: cat.slug,
                        productCount: 1,
                    });
                }
            }

            return { categories: Array.from(categoryMap.values()) };
        }),

    /**
     * Get products available in a shop storefront (public).
     * Returns products from the shop's inventory with retail prices.
     */
    getShopStorefrontProducts: publicProcedure
        .route({
            method: "GET",
            path: "/shopOwner/storefront/{slug}/products",
            tags: ["Shop Storefront"],
            summary: "Get shop storefront products",
        })
        .input(
            z.object({
                slug: z.string(),
            }).merge(productFiltersSchema),
        )
        .handler(async ({ input }) => {
            const {
                slug,
                category: categorySlug,
                search,
                sort = "newest",
                page: pageStr = "1",
                limit: limitStr = "12",
            } = input;

            // Find shop user
            const shopUser = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.shopSlug, slug),
                        eq(user.isSeller, true),
                    ),
                )
                .limit(1);

            if (shopUser.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
            }

            const shopId = shopUser[0]!.id;
            const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
            const limit = Math.min(50, Math.max(1, parseInt(limitStr ?? "12", 10) || 12));
            const offset = (page - 1) * limit;

            // Get shop inventory with variant + product info
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, shopId),
                    sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { id: true, name: true, slug: true } },
                                    images: { limit: 1 },
                                    brand: { columns: { id: true, name: true, slug: true } },
                                },
                            },
                        },
                    },
                },
            });

            // Group inventory items by product
            const productMap = new Map<number, {
                product: any;
                variants: Array<{
                    variantId: number;
                    unitLabel: string;
                    weightKg: string;
                    packType: string | null;
                    price: number;
                    retailPrice: number | null;
                    availableQty: string;
                    sku: string | null;
                }>;
                minPrice: number;
            }>();

            for (const inv of shopInventory) {
                const variant = inv.variant;
                const prod = variant?.product;
                if (!prod || !variant) continue;

                // Apply category filter
                if (categorySlug && prod.category?.slug !== categorySlug) continue;

                // Apply search filter
                if (search && !prod.name.toLowerCase().includes(search.toLowerCase())) continue;

                const variantPrice = Number(variant.price) || 0;
                const retailPrice = inv.retailPrice ? Number(inv.retailPrice) : null;
                const effectivePrice = retailPrice ?? variantPrice;

                const existing = productMap.get(prod.id);
                const variantData = {
                    variantId: variant.id,
                    unitLabel: variant.unitLabel || "",
                    weightKg: variant.weightKg || "0",
                    packType: variant.packType,
                    price: variantPrice,
                    retailPrice,
                    availableQty: inv.availableQty,
                    sku: variant.sku,
                };

                if (existing) {
                    existing.variants.push(variantData);
                    if (effectivePrice < existing.minPrice) {
                        existing.minPrice = effectivePrice;
                    }
                } else {
                    productMap.set(prod.id, {
                        product: {
                            id: prod.id,
                            name: prod.name,
                            slug: prod.slug,
                            image: prod.image,
                            categoryName: prod.category?.name || "",
                            categorySlug: prod.category?.slug || "",
                            brandName: (prod as any).brand?.name || null,
                        },
                        variants: [variantData],
                        minPrice: effectivePrice,
                    });
                }
            }

            // Convert to array and sort
            let products = Array.from(productMap.values());

            products.sort((a, b) => {
                switch (sort) {
                    case "price_asc":
                    case "price-asc":
                        return a.minPrice - b.minPrice;
                    case "price_desc":
                    case "price-desc":
                        return b.minPrice - a.minPrice;
                    default:
                        return 0; // newest: rely on insertion order
                }
            });

            const totalCount = products.length;
            const paginated = products.slice(offset, offset + limit);

            return {
                products: paginated.map((p) => ({
                    ...p.product,
                    price: p.minPrice,
                    variants: p.variants,
                })),
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Public Product Catalog (Browse-Only)
// ────────────────────────────────────────────────────────────────

const publicCatalogEndpoints = {
    /**
     * Get the full product hierarchy: Type → Category → SubCategory → Core Identity.
     * Public-facing, no auth required. Used for the catalog browse page.
     */
    getPublicCatalogHierarchy: publicProcedure
        .input(
            z.object({
                typeId: z.number().nullish(),
                categoryId: z.number().nullish(),
                subCategoryId: z.number().nullish(),
                search: z.string().nullish(),
                page: z.number().optional().default(1),
                limit: z.number().optional().default(50),
            }),
        )
        .handler(async ({ input }) => {
            const page = input.page ?? 1;
            const limit = input.limit ?? 50;
            const offset = (page - 1) * limit;

            // 1. Build conditions for core products
            const conditions: SQL[] = [];

            if (input.search?.trim()) {
                conditions.push(ilike(coreProductIdentity.name, `%${input.search.trim()}%`));
            }

            // 2. If filters provided, narrow by category/subcategory
            if (input.subCategoryId) {
                conditions.push(eq(coreProductIdentity.subCategoryId, input.subCategoryId));
            } else if (input.categoryId) {
                conditions.push(eq(coreProductIdentity.categoryId, input.categoryId));
            } else if (input.typeId) {
                // Get all category IDs under this type
                const typeCats = await db
                    .select({ id: category.id })
                    .from(category)
                    .where(eq(category.typeId, input.typeId));
                const catIds = typeCats.map((c) => c.id);
                if (catIds.length > 0) {
                    conditions.push(inArray(coreProductIdentity.categoryId, catIds));
                } else {
                    return {
                        items: [],
                        pagination: { page, limit, totalCount: 0, totalPages: 0 },
                    };
                }
            }

            const where = conditions.length > 0 ? and(...conditions) : undefined;

            // 3. Fetch core products with relations
            const [coreProducts, countResult] = await Promise.all([
                db.query.coreProductIdentity.findMany({
                    where,
                    orderBy: [coreProductIdentity.name],
                    limit,
                    offset,
                    with: {
                        category: {
                            columns: { id: true, name: true, slug: true, typeId: true, skuCode: true },
                            with: {
                                type: { columns: { id: true, name: true, slug: true, skuCode: true } },
                            },
                        },
                        subCategory: {
                            columns: { id: true, name: true, slug: true, skuCode: true },
                        },
                    },
                }),
                db
                    .select({ count: count() })
                    .from(coreProductIdentity)
                    .where(where),
            ]);

            // 4. Compose hierarchical SKU and format
            const items = coreProducts.map((cp) => {
                const typeCode = cp.category?.type?.skuCode || "??";
                const catCode = cp.category?.skuCode || "???";
                const subCatCode = cp.subCategory?.skuCode || "???";
                const coreCode = cp.sku || "???";
                const composedSku = `${typeCode}-${catCode}-${subCatCode}-${coreCode}`;

                return {
                    id: cp.id,
                    name: cp.name,
                    slug: cp.slug,
                    sku: composedSku,
                    image: cp.image,
                    description: cp.description,
                    supportsPack: cp.supportsPack,
                    supportsLoose: cp.supportsLoose,
                    type: cp.category?.type
                        ? { id: cp.category.type.id, name: cp.category.type.name, slug: cp.category.type.slug }
                        : null,
                    category: cp.category
                        ? { id: cp.category.id, name: cp.category.name, slug: cp.category.slug }
                        : null,
                    subCategory: cp.subCategory
                        ? { id: cp.subCategory.id, name: cp.subCategory.name, slug: cp.subCategory.slug }
                        : null,
                };
            });

            const totalCount = Number(countResult[0]?.count) || 0;

            return {
                items,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /**
     * Get detailed view of a core product identity.
     * Returns the core product info + all linked products with their variants,
     * brands, and seller count.
     */
    getCoreProductDetail: publicProcedure
        .input(z.object({ coreProductId: z.number() }))
        .handler(async ({ input }) => {
            // 1. Get core product
            const coreProduct = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, input.coreProductId),
                with: {
                    category: {
                        columns: { id: true, name: true, slug: true, typeId: true },
                        with: {
                            type: { columns: { id: true, name: true, slug: true } },
                        },
                    },
                    subCategory: {
                        columns: { id: true, name: true, slug: true },
                    },
                },
            });

            if (!coreProduct) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Core product identity not found",
                });
            }

            // 2. Get all linked products (active ones created by warehouses)
            const linkedProducts = await db.query.product.findMany({
                where: and(
                    eq(product.coreProductId, input.coreProductId),
                    eq(product.status, "active"),
                ),
                with: {
                    brand: { columns: { id: true, name: true, slug: true } },
                    images: { limit: 5 },
                    variants: {
                        where: eq(productVariant.isActive, true),
                        columns: {
                            id: true,
                            sku: true,
                            unitLabel: true,
                            weightKg: true,
                            price: true,
                            packType: true,
                            packWeightKg: true,
                            innerPackSizeKg: true,
                            packCountInside: true,
                            sellUnit: true,
                            color: true,
                            size: true,
                            brandId: true,
                            variantType: true,
                            isPackReturnRequired: true,
                            packDepositAmount: true,
                            sortOrder: true,
                        },
                        with: {
                            brand: { columns: { id: true, name: true } },
                        },
                        orderBy: [productVariant.sortOrder],
                    },
                },
            });

            // 3. Count sellers (shops with stock > 0 for any variant of these products)
            const allVariantIds = linkedProducts.flatMap((p) => p.variants.map((v) => v.id));
            let sellerCount = 0;
            if (allVariantIds.length > 0) {
                const sellerResult = await db
                    .select({
                        distinctShops: sql<number>`COUNT(DISTINCT ${inventory.ownerId})`,
                    })
                    .from(inventory)
                    .where(
                        and(
                            eq(inventory.ownerType, "shop"),
                            inArray(inventory.variantId, allVariantIds),
                            sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                        ),
                    );
                sellerCount = Number(sellerResult[0]?.distinctShops) || 0;
            }

            // 4. Get review stats for linked products
            const productIds = linkedProducts.map((p) => p.id);
            let reviewStats = { avgRating: 0, reviewCount: 0 };
            if (productIds.length > 0) {
                const [stats] = await db
                    .select({
                        avgRating: avg(productReview.rating),
                        reviewCount: count(),
                    })
                    .from(productReview)
                    .where(inArray(productReview.productId, productIds));
                reviewStats = {
                    avgRating: Number(stats?.avgRating) || 0,
                    reviewCount: Number(stats?.reviewCount) || 0,
                };
            }

            // 5. Extract unique brands across all linked products
            const brandMap = new Map<number, { id: number; name: string }>();
            for (const p of linkedProducts) {
                if (p.brand) {
                    brandMap.set(p.brand.id, { id: p.brand.id, name: p.brand.name });
                }
                for (const v of p.variants) {
                    if (v.brand) {
                        brandMap.set(v.brand.id, { id: v.brand.id, name: v.brand.name });
                    }
                }
            }

            // 6. Flatten all variants with brand info
            const allVariants = linkedProducts.flatMap((p) =>
                p.variants.map((v) => ({
                    ...v,
                    productId: p.id,
                    productName: p.name,
                    productImage: p.image,
                    brand: v.brand || p.brand || null,
                })),
            );

            return {
                coreProduct: {
                    id: coreProduct.id,
                    name: coreProduct.name,
                    slug: coreProduct.slug,
                    sku: coreProduct.sku,
                    image: coreProduct.image,
                    description: coreProduct.description,
                    supportsPack: coreProduct.supportsPack,
                    supportsLoose: coreProduct.supportsLoose,
                    type: coreProduct.category?.type || null,
                    category: coreProduct.category
                        ? { id: coreProduct.category.id, name: coreProduct.category.name, slug: coreProduct.category.slug }
                        : null,
                    subCategory: coreProduct.subCategory || null,
                },
                products: linkedProducts.map((p) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    image: p.image,
                    images: p.images,
                    brand: p.brand,
                    variantCount: p.variants.length,
                })),
                variants: allVariants,
                brands: Array.from(brandMap.values()),
                sellerCount,
                reviewStats,
            };
        }),

    /**
     * Get filter options for the catalog: active types, categories, subcategories.
     */
    getPublicFilterOptions: publicProcedure
        .handler(async () => {
            const [types, categories, subCategories, brands] = await Promise.all([
                db.query.productType.findMany({
                    where: eq(productType.isActive, true),
                    orderBy: [productType.displayOrder, productType.name],
                    columns: { id: true, name: true, slug: true },
                }),
                db.query.category.findMany({
                    where: eq(category.isActive, true),
                    orderBy: [category.displayOrder, category.name],
                    columns: { id: true, name: true, slug: true, typeId: true },
                }),
                db.query.subCategory.findMany({
                    where: eq(subCategory.isActive, true),
                    orderBy: [subCategory.displayOrder, subCategory.name],
                    columns: { id: true, name: true, slug: true, categoryId: true },
                }),
                db.query.brand.findMany({
                    orderBy: [brand.name],
                    columns: { id: true, name: true },
                }),
            ]);

            return { types, categories, subCategories, brands };
        }),

    /**
     * Submit a product identity request (shop owner only).
     * Used when a shop owner can't find a product in the catalog.
     */
    submitProductIdentityRequest: shopOwnerProcedure
        .input(
            z.object({
                typeName: z.string().optional(),
                categoryName: z.string().optional(),
                subCategoryName: z.string().optional(),
                productName: z.string().min(1),
                description: z.string().optional(),
                referenceImage: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [created] = await db
                .insert(productIdentityRequest)
                .values({
                    requestedBy: userId,
                    typeName: input.typeName || null,
                    categoryName: input.categoryName || null,
                    subCategoryName: input.subCategoryName || null,
                    productName: input.productName,
                    description: input.description || null,
                    referenceImage: input.referenceImage || null,
                    status: "pending",
                })
                .returning();

            return {
                success: true,
                request: created,
                message: "Product identity request submitted. Admin will review it.",
            };
        }),

    /**
     * Get my product identity requests (shop owner only).
     */
    getMyProductRequests: shopOwnerProcedure
        .input(
            z.object({
                status: z.enum(["pending", "approved", "rejected"]).optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const conditions: SQL[] = [
                eq(productIdentityRequest.requestedBy, userId),
            ];
            if (input.status) {
                conditions.push(eq(productIdentityRequest.status, input.status));
            }

            const requests = await db.query.productIdentityRequest.findMany({
                where: and(...conditions),
                orderBy: [desc(productIdentityRequest.createdAt)],
            });

            return { requests };
        }),
};

// ────────────────────────────────────────────────────────────────
// Shop Product Management (Retail Control Panel)
// ────────────────────────────────────────────────────────────────

const shopProductEndpoints = {
    /**
     * Get shop owner's products — aggregated by product (not variant).
     * Each row = one product with variant count, total stock, stock status.
     */
    getShopProducts: shopOwnerProcedure
        .input(
            z.object({
                search: z.string().optional(),
                categoryId: z.number().optional(),
                stockStatus: z.enum(["all", "in_stock", "low", "out_of_stock"]).default("all"),
                brandId: z.number().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;
            const { search, categoryId, stockStatus, brandId, page, limit } = input;
            const offset = (page - 1) * limit;

            // Get all inventory for this shop owner with product+variant info
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        columns: {
                            id: true,
                            productId: true,
                            sku: true,
                            unitLabel: true,
                            weightKg: true,
                            price: true,
                            packType: true,
                            brandId: true,
                            color: true,
                            size: true,
                            isActive: true,
                        },
                        with: {
                            product: {
                                columns: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    image: true,
                                    categoryId: true,
                                    coreProductId: true,
                                    status: true,
                                    reorderLevel: true,
                                },
                                with: {
                                    category: { columns: { id: true, name: true } },
                                    coreProduct: { columns: { id: true, name: true } },
                                },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            // Group by productId
            const productMap = new Map<number, {
                product: typeof shopInventory[0]["variant"]["product"];
                variants: Array<{
                    variantId: number;
                    sku: string | null;
                    unitLabel: string;
                    weightKg: string;
                    brandName: string | null;
                    brandId: number | null;
                    availableQty: string;
                    reservedQty: string;
                    retailPrice: string | null;
                }>;
                totalStock: number;
                variantCount: number;
            }>();

            for (const inv of shopInventory) {
                if (!inv.variant?.product) continue;
                const pid = inv.variant.product.id;

                if (!productMap.has(pid)) {
                    productMap.set(pid, {
                        product: inv.variant.product,
                        variants: [],
                        totalStock: 0,
                        variantCount: 0,
                    });
                }

                const entry = productMap.get(pid)!;
                entry.variants.push({
                    variantId: inv.variant.id,
                    sku: inv.variant.sku,
                    unitLabel: inv.variant.unitLabel,
                    weightKg: inv.variant.weightKg,
                    brandName: inv.variant.brand?.name ?? null,
                    brandId: inv.variant.brandId,
                    availableQty: inv.availableQty,
                    reservedQty: inv.reservedQty,
                    retailPrice: inv.retailPrice,
                });
                entry.totalStock += Number(inv.availableQty);
                entry.variantCount += 1;
            }

            // Convert to array and apply filters
            let items = Array.from(productMap.values());

            // Search filter
            if (search?.trim()) {
                const s = search.toLowerCase();
                items = items.filter(
                    (item) =>
                        item.product.name.toLowerCase().includes(s) ||
                        item.product.slug.toLowerCase().includes(s) ||
                        item.variants.some((v) => v.sku?.toLowerCase().includes(s)),
                );
            }

            // Category filter
            if (categoryId) {
                items = items.filter((item) => item.product.categoryId === categoryId);
            }

            // Brand filter
            if (brandId) {
                items = items.filter((item) =>
                    item.variants.some((v) => v.brandId === brandId),
                );
            }

            // Stock status filter
            const REORDER_THRESHOLD = 10;
            if (stockStatus === "in_stock") {
                items = items.filter((item) => item.totalStock > REORDER_THRESHOLD);
            } else if (stockStatus === "low") {
                items = items.filter(
                    (item) => item.totalStock > 0 && item.totalStock <= REORDER_THRESHOLD,
                );
            } else if (stockStatus === "out_of_stock") {
                items = items.filter((item) => item.totalStock <= 0);
            }

            const totalCount = items.length;

            // Sort by name
            items.sort((a, b) => a.product.name.localeCompare(b.product.name));

            // Paginate
            const paginated = items.slice(offset, offset + limit);

            // Build response with stock status
            const result = paginated.map((item) => {
                const reorderLevel = item.product.reorderLevel || REORDER_THRESHOLD;
                let status: "in_stock" | "low" | "out_of_stock";
                if (item.totalStock <= 0) status = "out_of_stock";
                else if (item.totalStock <= reorderLevel) status = "low";
                else status = "in_stock";

                return {
                    productId: item.product.id,
                    name: item.product.name,
                    slug: item.product.slug,
                    image: item.product.image,
                    category: item.product.category,
                    coreProduct: item.product.coreProduct,
                    variantCount: item.variantCount,
                    totalStock: item.totalStock,
                    stockStatus: status,
                    productStatus: item.product.status,
                    unit: item.variants[0]?.unitLabel ?? "pcs",
                };
            });

            return {
                items: result,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /**
     * KPI summary: total products, in-stock, low, out-of-stock.
     */
    getShopProductKPIs: shopOwnerProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                columns: { variantId: true, availableQty: true },
                with: {
                    variant: {
                        columns: { id: true, productId: true },
                        with: {
                            product: { columns: { id: true, reorderLevel: true } },
                        },
                    },
                },
            });

            // Group by product
            const productStockMap = new Map<number, number>();
            const productReorderMap = new Map<number, number>();

            for (const inv of shopInventory) {
                if (!inv.variant?.product) continue;
                const pid = inv.variant.product.id;
                productStockMap.set(pid, (productStockMap.get(pid) ?? 0) + Number(inv.availableQty));
                if (!productReorderMap.has(pid)) {
                    productReorderMap.set(pid, inv.variant.product.reorderLevel || 10);
                }
            }

            let totalProducts = 0;
            let inStock = 0;
            let lowStock = 0;
            let outOfStock = 0;

            for (const [pid, totalQty] of productStockMap) {
                totalProducts++;
                const reorder = productReorderMap.get(pid) ?? 10;
                if (totalQty <= 0) outOfStock++;
                else if (totalQty <= reorder) lowStock++;
                else inStock++;
            }

            return { totalProducts, inStock, lowStock, outOfStock };
        }),

    /**
     * Detailed view of a single product — all variants with per-variant stock.
     */
    getShopProductDetail: shopOwnerProcedure
        .input(z.object({ productId: z.number() }))
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            const prod = await db.query.product.findFirst({
                where: eq(product.id, input.productId),
                with: {
                    category: { columns: { id: true, name: true, slug: true } },
                    subCategory: { columns: { id: true, name: true } },
                    coreProduct: { columns: { id: true, name: true, sku: true, image: true } },
                    images: true,
                    productBrands: {
                        with: { brand: { columns: { id: true, name: true, logo: true } } },
                    },
                },
            });

            if (!prod) throw new ORPCError("NOT_FOUND", { message: "Product not found" });

            // Get inventory for this product's variants
            const variants = await db.query.productVariant.findMany({
                where: eq(productVariant.productId, input.productId),
                with: {
                    brand: { columns: { id: true, name: true } },
                },
            });

            const variantIds = variants.map((v) => v.id);
            const inventoryRows = variantIds.length > 0
                ? await db.query.inventory.findMany({
                    where: and(
                        eq(inventory.ownerType, "shop"),
                        eq(inventory.ownerId, userId),
                        inArray(inventory.variantId, variantIds),
                    ),
                })
                : [];

            const invMap = new Map(inventoryRows.map((inv) => [inv.variantId, inv]));

            const variantDetails = variants.map((v) => {
                const inv = invMap.get(v.id);
                const availableQty = Number(inv?.availableQty ?? 0);
                const reorderLevel = v.reorderLevel || 10;
                let status: "in_stock" | "low" | "out_of_stock";
                if (availableQty <= 0) status = "out_of_stock";
                else if (availableQty <= reorderLevel) status = "low";
                else status = "in_stock";

                return {
                    variantId: v.id,
                    sku: v.sku,
                    unitLabel: v.unitLabel,
                    weightKg: v.weightKg,
                    price: v.price,
                    packType: v.packType,
                    color: v.color,
                    size: v.size,
                    brandId: v.brandId,
                    brandName: v.brand?.name ?? null,
                    availableQty,
                    reservedQty: Number(inv?.reservedQty ?? 0),
                    retailPrice: inv?.retailPrice ?? null,
                    stockStatus: status,
                    isActive: v.isActive,
                };
            });

            const totalStock = variantDetails.reduce((sum, v) => sum + v.availableQty, 0);

            return {
                product: {
                    id: prod.id,
                    name: prod.name,
                    slug: prod.slug,
                    image: prod.image,
                    description: prod.description,
                    status: prod.status,
                    visibility: prod.visibility,
                    expiryEnabled: prod.expiryEnabled,
                    damageControlEnabled: prod.damageControlEnabled,
                    trackingType: prod.trackingType,
                    isReturnablePack: prod.isReturnablePack,
                    reorderLevel: prod.reorderLevel,
                    category: prod.category,
                    subCategory: prod.subCategory,
                    coreProduct: prod.coreProduct,
                    images: prod.images,
                    brands: prod.productBrands.map((pb) => pb.brand),
                },
                variants: variantDetails,
                totalStock,
            };
        }),

    /**
     * Get options for the Create Product form (cascading selects).
     * Returns types, categories, subcategories, core products, brands, variant options.
     */
    getCreateProductOptions: shopOwnerProcedure
        .input(
            z.object({
                typeId: z.number().optional(),
                categoryId: z.number().optional(),
                subCategoryId: z.number().optional(),
            }),
        )
        .handler(async ({ input }) => {
            // Types
            const types = await db.query.productType.findMany({
                where: eq(productType.isActive, true),
                orderBy: [productType.displayOrder, productType.name],
                columns: { id: true, name: true, slug: true },
            });

            // Categories filtered by type
            const catFilter = input.typeId
                ? and(eq(category.isActive, true), eq(category.typeId, input.typeId))
                : eq(category.isActive, true);
            const categories = await db.query.category.findMany({
                where: catFilter,
                orderBy: [category.displayOrder, category.name],
                columns: { id: true, name: true, slug: true, typeId: true },
            });

            // SubCategories filtered by category
            const subCatFilter = input.categoryId
                ? and(eq(subCategory.isActive, true), eq(subCategory.categoryId, input.categoryId))
                : eq(subCategory.isActive, true);
            const subCategories = await db.query.subCategory.findMany({
                where: subCatFilter,
                orderBy: [subCategory.displayOrder, subCategory.name],
                columns: { id: true, name: true, slug: true, categoryId: true },
            });

            // Core products filtered by category+subcategory
            const cpConditions: SQL[] = [];
            if (input.categoryId) cpConditions.push(eq(coreProductIdentity.categoryId, input.categoryId));
            if (input.subCategoryId) cpConditions.push(eq(coreProductIdentity.subCategoryId, input.subCategoryId));
            const coreProducts = await db.query.coreProductIdentity.findMany({
                where: cpConditions.length > 0 ? and(...cpConditions) : undefined,
                columns: { id: true, name: true, sku: true, image: true, supportsPack: true, supportsLoose: true, categoryId: true, subCategoryId: true },
                orderBy: [coreProductIdentity.name],
            });

            // Brands
            const brands = await db.query.brand.findMany({
                orderBy: [brand.displayOrder, brand.name],
                columns: { id: true, name: true, slug: true, logo: true },
            });

            // Variant options — filtered by type+category scope
            const voConditions: SQL[] = [eq(variantOption.isActive, true)];
            if (input.typeId) {
                // Include global options (typeId=null) + type-specific + category-specific
                voConditions.push(
                    or(
                        sql`${variantOption.typeId} IS NULL`,
                        eq(variantOption.typeId, input.typeId),
                    )!,
                );
            }
            if (input.categoryId) {
                voConditions.push(
                    or(
                        sql`${variantOption.categoryId} IS NULL`,
                        eq(variantOption.categoryId, input.categoryId),
                    )!,
                );
            }
            const variantOptions = await db.query.variantOption.findMany({
                where: and(...voConditions),
                orderBy: [variantOption.sortOrder, variantOption.name],
                columns: { id: true, name: true, unit: true, size: true, variantType: true },
            });

            return { types, categories, subCategories, coreProducts, brands, variantOptions };
        }),

    /**
     * Create a new shop product — full 8-step data.
     * Creates product, product_brand links, product_variants, and initial inventory.
     */
    createShopProduct: shopOwnerProcedure
        .input(
            z.object({
                // Step 1-2: Classification & Core Identity
                coreProductId: z.number(),
                categoryId: z.number(),
                subCategoryId: z.number().optional(),

                // Step 3: Brand & Variant selection
                brandIds: z.array(z.number()).min(1),
                variantSelections: z.array(
                    z.object({
                        variantOptionId: z.number(),
                        brandId: z.number(),
                    }),
                ).min(1),

                // Step 4: Pricing per brand×variant
                pricing: z.array(
                    z.object({
                        variantOptionId: z.number(),
                        brandId: z.number(),
                        retailPrice: z.string(), // decimal
                    }),
                ),

                // Step 5: Product rules
                isReturnablePack: z.boolean().default(false),
                expiryEnabled: z.boolean().default(false),
                damageControlEnabled: z.boolean().default(false),
                stockTrackingEnabled: z.boolean().default(true),
                trackingType: z.enum(["none", "batch", "serial"]).default("none"),

                // Step 6: Opening stock per brand×variant
                openingStock: z.array(
                    z.object({
                        variantOptionId: z.number(),
                        brandId: z.number(),
                        quantity: z.number().default(0),
                    }),
                ).optional(),

                // Step 7: Customization
                displayName: z.string().optional(),
                shortNote: z.string().optional(),

                // Step 8: Visibility
                status: z.enum(["active", "inactive", "draft"]).default("active"),
                availableForSale: z.boolean().default(true),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // 1. Fetch core product for defaults
            const core = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, input.coreProductId),
            });
            if (!core) throw new ORPCError("NOT_FOUND", { message: "Core product not found" });

            // 2. Create the product row
            const productName = input.displayName || core.name;
            const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();

            const [newProduct] = await db
                .insert(product)
                .values({
                    name: productName,
                    slug,
                    categoryId: input.categoryId,
                    subCategoryId: input.subCategoryId ?? null,
                    coreProductId: input.coreProductId,
                    image: core.image ?? "",
                    size: "default",
                    price: "0",
                    status: input.status,
                    shortDescription: input.shortNote ?? null,
                    isReturnablePack: input.isReturnablePack,
                    expiryEnabled: input.expiryEnabled,
                    damageControlEnabled: input.damageControlEnabled,
                    stockTrackingEnabled: input.stockTrackingEnabled,
                    trackingType: input.trackingType,
                    availableForSale: input.availableForSale,
                })
                .returning({ id: product.id });

            if (!newProduct) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create product" });

            // 3. Insert product_brand links
            if (input.brandIds.length > 0) {
                await db.insert(productBrand).values(
                    input.brandIds.map((bid) => ({
                        productId: newProduct.id,
                        brandId: bid,
                    })),
                );
            }

            // 4. Create product_variant + product_variant_price for each brand×variant
            const createdVariants: Array<{ variantId: number; variantOptionId: number; brandId: number }> = [];

            for (const sel of input.variantSelections) {
                // Fetch variant option for defaults
                const vo = await db.query.variantOption.findFirst({
                    where: eq(variantOption.id, sel.variantOptionId),
                });
                if (!vo) continue;

                // Get pricing for this combo
                const priceEntry = input.pricing.find(
                    (p) => p.variantOptionId === sel.variantOptionId && p.brandId === sel.brandId,
                );
                const retailPrice = priceEntry?.retailPrice ?? "0";

                // Create product variant
                const [pv] = await db
                    .insert(productVariant)
                    .values({
                        productId: newProduct.id,
                        unitLabel: vo.name,
                        weightKg: vo.size ?? "0",
                        packagingType: vo.variantType === "loose" ? "loose" : "packet",
                        price: retailPrice,
                        brandId: sel.brandId,
                        pricingType: "per_unit",
                        sourceVariantOptionId: vo.id,
                    })
                    .returning({ id: productVariant.id });

                if (!pv) continue;

                // Create product_variant_price link
                await db.insert(productVariantPrice).values({
                    productId: newProduct.id,
                    variantOptionId: sel.variantOptionId,
                    brandId: sel.brandId,
                    consumerPrice: retailPrice,
                });

                createdVariants.push({
                    variantId: pv.id,
                    variantOptionId: sel.variantOptionId,
                    brandId: sel.brandId,
                });
            }

            // 5. Create initial inventory rows
            for (const cv of createdVariants) {
                const stockEntry = input.openingStock?.find(
                    (s) => s.variantOptionId === cv.variantOptionId && s.brandId === cv.brandId,
                );
                const qty = stockEntry?.quantity ?? 0;

                // Get retail price
                const priceEntry = input.pricing.find(
                    (p) => p.variantOptionId === cv.variantOptionId && p.brandId === cv.brandId,
                );

                await db.insert(inventory).values({
                    ownerType: "shop",
                    ownerId: userId,
                    variantId: cv.variantId,
                    availableQty: String(qty),
                    reservedQty: "0",
                    retailPrice: priceEntry?.retailPrice ?? null,
                });
            }

            return {
                productId: newProduct.id,
                variantsCreated: createdVariants.length,
            };
        }),

    /**
     * Get full store preview data for the "My Store" consumer view.
     * Returns store identity, categories, and products with variants/brands.
     */
    getMyStorePreview: shopOwnerProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // 1. Get store identity from user row
            const storeUser = await db.query.user.findFirst({
                where: eq(user.id, userId),
                columns: {
                    id: true,
                    name: true,
                    shopName: true,
                    shopSlug: true,
                    shopAddress: true,
                    shopLat: true,
                    shopLng: true,
                    phoneNumber: true,
                    ownerName: true,
                    image: true,
                },
            });

            if (!storeUser) throw new ORPCError("NOT_FOUND", { message: "User not found" });

            // 2. Get all inventory for this shop owner with full product+variant+brand info
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        columns: {
                            id: true,
                            productId: true,
                            sku: true,
                            unitLabel: true,
                            weightKg: true,
                            price: true,
                            packType: true,
                            brandId: true,
                            color: true,
                            size: true,
                            isActive: true,
                            isPackReturnRequired: true,
                            packDepositAmount: true,
                            sourceVariantOptionId: true,
                        },
                        with: {
                            product: {
                                columns: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    image: true,
                                    categoryId: true,
                                    coreProductId: true,
                                    status: true,
                                    reorderLevel: true,
                                    shortDescription: true,
                                    isReturnablePack: true,
                                },
                                with: {
                                    category: { columns: { id: true, name: true, slug: true } },
                                },
                            },
                            brand: { columns: { id: true, name: true, logo: true } },
                        },
                    },
                },
            });

            // 3. Group by product
            type VariantInfo = {
                variantId: number;
                sku: string | null;
                unitLabel: string;
                weightKg: string;
                packType: string | null;
                brandId: number | null;
                brandName: string | null;
                brandLogo: string | null;
                retailPrice: string | null;
                availableQty: number;
                isPackReturnRequired: boolean | null;
                packDepositAmount: string | null;
            };

            const productMap = new Map<number, {
                product: typeof shopInventory[0]["variant"]["product"];
                variants: VariantInfo[];
                totalStock: number;
                brands: Map<number, { id: number; name: string; logo: string | null }>;
            }>();

            for (const inv of shopInventory) {
                if (!inv.variant?.product) continue;
                const pid = inv.variant.product.id;

                if (!productMap.has(pid)) {
                    productMap.set(pid, {
                        product: inv.variant.product,
                        variants: [],
                        totalStock: 0,
                        brands: new Map(),
                    });
                }

                const entry = productMap.get(pid)!;
                const qty = Number(inv.availableQty);
                entry.totalStock += qty;

                entry.variants.push({
                    variantId: inv.variant.id,
                    sku: inv.variant.sku,
                    unitLabel: inv.variant.unitLabel,
                    weightKg: inv.variant.weightKg,
                    packType: inv.variant.packagingType,
                    brandId: inv.variant.brandId,
                    brandName: inv.variant.brand?.name ?? null,
                    brandLogo: inv.variant.brand?.logo ?? null,
                    retailPrice: inv.retailPrice,
                    availableQty: qty,
                    isPackReturnRequired: inv.variant.isPackReturnRequired,
                    packDepositAmount: inv.variant.packDepositAmount,
                });

                if (inv.variant.brand) {
                    entry.brands.set(inv.variant.brand.id, {
                        id: inv.variant.brand.id,
                        name: inv.variant.brand.name,
                        logo: inv.variant.brand.logo,
                    });
                }
            }

            // 4. Derive categories
            const categoryMap = new Map<number, { id: number; name: string; slug: string; productCount: number }>();
            for (const entry of productMap.values()) {
                const cat = entry.product.category;
                if (cat) {
                    const existing = categoryMap.get(cat.id);
                    if (existing) {
                        existing.productCount++;
                    } else {
                        categoryMap.set(cat.id, { ...cat, productCount: 1 });
                    }
                }
            }

            // 5. Build product list
            const REORDER_THRESHOLD = 10;
            const products = Array.from(productMap.values())
                .sort((a, b) => a.product.name.localeCompare(b.product.name))
                .map((entry) => {
                    const reorderLevel = entry.product.reorderLevel || REORDER_THRESHOLD;
                    let stockStatus: "in_stock" | "low" | "out_of_stock";
                    if (entry.totalStock <= 0) stockStatus = "out_of_stock";
                    else if (entry.totalStock <= reorderLevel) stockStatus = "low";
                    else stockStatus = "in_stock";

                    // Lowest retail price across variants
                    const prices = entry.variants
                        .map((v) => Number(v.retailPrice))
                        .filter((p) => p > 0);
                    const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;

                    return {
                        productId: entry.product.id,
                        name: entry.product.name,
                        slug: entry.product.slug,
                        image: entry.product.image,
                        shortDescription: entry.product.shortDescription,
                        isReturnablePack: entry.product.isReturnablePack,
                        category: entry.product.category,
                        brands: Array.from(entry.brands.values()),
                        variants: entry.variants,
                        totalStock: entry.totalStock,
                        stockStatus,
                        lowestPrice,
                        variantCount: entry.variants.length,
                    };
                });

            return {
                store: {
                    name: storeUser.shopName || storeUser.name,
                    slug: storeUser.shopSlug,
                    address: storeUser.shopAddress,
                    lat: storeUser.shopLat,
                    lng: storeUser.shopLng,
                    phoneNumber: storeUser.phoneNumber,
                    ownerName: storeUser.ownerName,
                    image: storeUser.image,
                },
                categories: Array.from(categoryMap.values()),
                products,
                totalProducts: products.length,
            };
        }),

    /**
     * Get store KPI stats: total orders, customers, avg rating.
     */
    getMyStoreStats: shopOwnerProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Count B2C orders for this shop
            const [orderStats] = await db
                .select({
                    totalOrders: count(),
                    totalCustomers: sql<number>`COUNT(DISTINCT ${order.userId})`,
                })
                .from(order)
                .where(
                    and(
                        eq(order.shopId, userId),
                        eq(order.orderType, "b2c"),
                    ),
                );

            // Get average product rating from reviews on shop's products
            const shopVariantIds = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                columns: { variantId: true },
            });

            const variantIds = shopVariantIds.map((i) => i.variantId);
            let avgRating = 0;
            let reviewCount = 0;

            if (variantIds.length > 0) {
                // Get product IDs from variant IDs
                const variants = await db.query.productVariant.findMany({
                    where: inArray(productVariant.id, variantIds),
                    columns: { productId: true },
                });
                const productIds = [...new Set(variants.map((v) => v.productId))];

                if (productIds.length > 0) {
                    const [stats] = await db
                        .select({
                            avgRating: avg(productReview.rating),
                            reviewCount: count(),
                        })
                        .from(productReview)
                        .where(inArray(productReview.productId, productIds));

                    avgRating = Number(stats?.avgRating) || 0;
                    reviewCount = Number(stats?.reviewCount) || 0;
                }
            }

            return {
                totalOrders: Number(orderStats?.totalOrders) || 0,
                totalCustomers: Number(orderStats?.totalCustomers) || 0,
                avgRating: Math.round(avgRating * 10) / 10,
                reviewCount,
            };
        }),

    /**
     * Search shop products for stock entry — returns products with their variants
     * and current inventory quantities for the logged-in shop owner.
     */
    getShopProductsForStock: shopOwnerProcedure
        .input(
            z.object({
                search: z.string().optional(),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Get all inventory for this shop, grouped by product
            const shopInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                columns: { id: true, name: true, slug: true, image: true, categoryId: true },
                                with: {
                                    category: { columns: { id: true, name: true } },
                                    productBrands: {
                                        with: { brand: { columns: { id: true, name: true } } },
                                    },
                                },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            // Group by product
            const productMap = new Map<number, {
                id: number;
                name: string;
                image: string | null;
                category: { id: number; name: string } | null;
                variants: {
                    variantId: number;
                    inventoryId: number;
                    unitLabel: string;
                    weightKg: string;
                    brandName: string | null;
                    currentStock: number;
                    retailPrice: string | null;
                }[];
            }>();

            for (const inv of shopInventory) {
                if (!inv.variant?.product) continue;
                const prod = inv.variant.product;
                const pid = prod.id;

                if (!productMap.has(pid)) {
                    productMap.set(pid, {
                        id: pid,
                        name: prod.name,
                        image: prod.image,
                        category: prod.category,
                        variants: [],
                    });
                }

                // Resolve brand
                const brandName = inv.variant.brand?.name
                    || (prod as any).productBrands?.[0]?.brand?.name
                    || null;

                productMap.get(pid)!.variants.push({
                    variantId: inv.variant.id,
                    inventoryId: inv.id,
                    unitLabel: inv.variant.unitLabel,
                    weightKg: inv.variant.weightKg,
                    brandName,
                    currentStock: Number(inv.availableQty),
                    retailPrice: inv.retailPrice,
                });
            }

            // Filter by search
            let products = Array.from(productMap.values());
            if (input.search?.trim()) {
                const s = input.search.toLowerCase();
                products = products.filter(
                    (p) =>
                        p.name.toLowerCase().includes(s) ||
                        p.variants.some((v) => v.brandName?.toLowerCase().includes(s)),
                );
            }

            return {
                products: products.slice(0, input.limit),
                total: products.length,
            };
        }),

    /**
     * Add stock to shop inventory — supports adding to multiple variants at once.
     */
    addShopStock: shopOwnerProcedure
        .input(
            z.object({
                entries: z.array(
                    z.object({
                        inventoryId: z.number().int(),
                        addQuantity: z.number().min(0),
                    }),
                ).min(1, "At least one entry is required"),
                stockType: z.enum(["purchase", "return", "adjustment", "opening"]).default("purchase"),
                note: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Validate all inventory rows belong to this shop
            const inventoryIds = input.entries.map((e) => e.inventoryId);
            const ownedInventory = await db.query.inventory.findMany({
                where: and(
                    inArray(inventory.id, inventoryIds),
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
            });

            if (ownedInventory.length !== inventoryIds.length) {
                throw new ORPCError("FORBIDDEN", {
                    message: "Some inventory items do not belong to your shop",
                });
            }

            // Build a lookup
            const invLookup = new Map(ownedInventory.map((inv) => [inv.id, inv]));

            // Update quantities in a transaction
            const results = await db.transaction(async (tx) => {
                const updated: { inventoryId: number; oldQty: number; newQty: number }[] = [];

                for (const entry of input.entries) {
                    if (entry.addQuantity <= 0) continue;

                    const existing = invLookup.get(entry.inventoryId)!;
                    const oldQty = Number(existing.availableQty);
                    const newQty = oldQty + entry.addQuantity;

                    await tx
                        .update(inventory)
                        .set({ availableQty: String(newQty) })
                        .where(eq(inventory.id, entry.inventoryId));

                    updated.push({
                        inventoryId: entry.inventoryId,
                        oldQty,
                        newQty,
                    });
                }

                return updated;
            });

            return {
                updated: results,
                stockType: input.stockType,
                note: input.note || null,
                message: `Stock updated for ${results.length} variant(s)`,
            };
        }),

    // ────────────────────────────────────────────────────────────────
    // STOCK ADJUSTMENT ENDPOINTS
    // ────────────────────────────────────────────────────────────────

    /**
     * Search shop inventory variants for the adjustment product picker.
     * Returns variant-level results with current stock.
     */
    searchShopVariantsForAdjustment: shopOwnerProcedure
        .input(
            z.object({
                search: z.string().optional(),
                limit: z.number().int().min(1).max(50).default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const conditions: (typeof sql)[] = [];
            const baseConditions = and(
                eq(inventory.ownerType, "shop"),
                eq(inventory.ownerId, userId),
            );

            let searchCondition;
            if (input.search?.trim()) {
                const term = `%${input.search.trim()}%`;
                searchCondition = or(
                    ilike(product.name, term),
                    ilike(productVariant.sku ?? "", term),
                    ilike(brand.name ?? "", term),
                );
            }

            const rows = await db
                .select({
                    variantId: productVariant.id,
                    inventoryId: inventory.id,
                    sku: productVariant.sku,
                    unitLabel: productVariant.unitLabel,
                    weightKg: productVariant.weightKg,
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    brandName: brand.name,
                    availableQty: inventory.availableQty,
                    retailPrice: inventory.retailPrice,
                    variantPrice: productVariant.price,
                })
                .from(inventory)
                .innerJoin(
                    productVariant,
                    eq(inventory.variantId, productVariant.id),
                )
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(brand, eq(productVariant.brandId, brand.id))
                .where(
                    searchCondition
                        ? and(baseConditions, searchCondition)
                        : baseConditions,
                )
                .orderBy(product.name)
                .limit(input.limit);

            return {
                variants: rows.map((r) => ({
                    variantId: r.variantId,
                    inventoryId: r.inventoryId,
                    sku: r.sku,
                    unitLabel: r.unitLabel,
                    weightKg: r.weightKg,
                    productId: r.productId,
                    productName: r.productName,
                    productImage: r.productImage,
                    brandName: r.brandName,
                    availableQty: parseFloat(r.availableQty || "0"),
                    retailPrice: parseFloat(r.retailPrice || "0") || parseFloat(r.variantPrice || "0"),
                })),
            };
        }),

    /**
     * Create a stock adjustment for the shop — auto-submitted, applies to inventory.
     * Uses "actual stock" input: adjustQty = actualQty - currentQty.
     */
    createShopAdjustment: shopOwnerProcedure
        .input(
            z.object({
                adjustmentType: z.enum([
                    "increase",
                    "decrease",
                    "damage",
                    "loss",
                    "correction",
                ]),
                reason: z.enum([
                    "physical_count",
                    "damage",
                    "expired",
                    "theft",
                    "system_error",
                    "other",
                ]),
                referenceNote: z.string().optional(),
                adjustmentDate: z.string(),
                items: z
                    .array(
                        z.object({
                            inventoryId: z.number().int(),
                            actualQty: z.number().min(0),
                            note: z.string().optional(),
                        }),
                    )
                    .min(1, "At least one item is required"),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Validate all inventory rows belong to this shop
            const inventoryIds = input.items.map((i) => i.inventoryId);
            const ownedInventory = await db.query.inventory.findMany({
                where: and(
                    inArray(inventory.id, inventoryIds),
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
            });

            if (ownedInventory.length !== inventoryIds.length) {
                throw new ORPCError("FORBIDDEN", {
                    message: "Some inventory items do not belong to your shop",
                });
            }

            const invLookup = new Map(
                ownedInventory.map((inv) => [inv.id, inv]),
            );

            // 2. Generate adjustment number (ADJ-S-xxxx for shop)
            const [maxResult] = await db
                .select({
                    maxNo: sql<string>`MAX(${stockAdjustment.adjustmentNo})`,
                })
                .from(stockAdjustment)
                .where(eq(stockAdjustment.warehouseId, userId));

            const lastNum = maxResult?.maxNo
                ? parseInt(maxResult.maxNo.replace(/^ADJ-S?-?/, ""), 10) || 0
                : 0;
            const adjustmentNo = `ADJ-S-${String(lastNum + 1).padStart(4, "0")}`;

            // 3. Build line items with auto-calculated adjustQty
            const lineItems = input.items.map((item) => {
                const inv = invLookup.get(item.inventoryId)!;
                const currentQty = parseFloat(inv.availableQty || "0");
                const adjustQty = item.actualQty - currentQty;
                return {
                    variantId: inv.variantId,
                    currentQty: String(currentQty),
                    adjustQty: String(adjustQty),
                    afterQty: String(item.actualQty),
                    note: item.note || null,
                    inventoryId: inv.id,
                    actualQty: item.actualQty,
                };
            });

            // Filter out items with zero change
            const changedItems = lineItems.filter(
                (li) => parseFloat(li.adjustQty) !== 0,
            );

            if (changedItems.length === 0) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "No stock changes detected — all actual quantities match current stock",
                });
            }

            const totalQtyChange = changedItems.reduce(
                (sum, li) => sum + parseFloat(li.adjustQty),
                0,
            );

            // 4. Transaction: insert adjustment + items + update inventory
            const result = await db.transaction(async (tx) => {
                // Insert header
                const [header] = await tx
                    .insert(stockAdjustment)
                    .values({
                        adjustmentNo,
                        warehouseId: userId,
                        adjustmentType: input.adjustmentType,
                        reason: input.reason,
                        referenceNote: input.referenceNote || null,
                        adjustmentDate: input.adjustmentDate,
                        status: "submitted",
                        totalItems: changedItems.length,
                        totalQtyChange: String(totalQtyChange),
                        createdById: userId,
                    })
                    .returning();

                // Insert line items
                await tx.insert(stockAdjustmentItem).values(
                    changedItems.map((li) => ({
                        adjustmentId: header!.id,
                        variantId: li.variantId,
                        currentQty: li.currentQty,
                        adjustQty: li.adjustQty,
                        afterQty: li.afterQty,
                        note: li.note,
                    })),
                );

                // Update inventory quantities
                for (const li of changedItems) {
                    await tx
                        .update(inventory)
                        .set({ availableQty: li.afterQty })
                        .where(eq(inventory.id, li.inventoryId));
                }

                return header!;
            });

            return {
                success: true,
                adjustmentId: result.id,
                adjustmentNo: result.adjustmentNo,
                totalItems: changedItems.length,
                totalQtyChange,
                message: `Adjustment ${result.adjustmentNo} applied — ${changedItems.length} item(s) updated`,
            };
        }),

    /**
     * List shop adjustment history (paginated).
     */
    getShopAdjustments: shopOwnerProcedure
        .input(
            z.object({
                search: z.string().optional(),
                adjustmentType: z
                    .enum(["increase", "decrease", "damage", "loss", "correction"])
                    .optional(),
                page: z.number().int().min(1).default(1),
                pageSize: z.number().int().min(1).max(100).default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const offset = (input.page - 1) * input.pageSize;

            const conditions: SQL[] = [
                eq(stockAdjustment.warehouseId, userId),
            ];

            if (input.adjustmentType) {
                conditions.push(
                    eq(stockAdjustment.adjustmentType, input.adjustmentType),
                );
            }
            if (input.search?.trim()) {
                const term = `%${input.search.trim()}%`;
                conditions.push(
                    ilike(stockAdjustment.adjustmentNo, term),
                );
            }

            const where = and(...conditions);

            const [rows, countResult] = await Promise.all([
                db
                    .select({
                        id: stockAdjustment.id,
                        adjustmentNo: stockAdjustment.adjustmentNo,
                        adjustmentType: stockAdjustment.adjustmentType,
                        reason: stockAdjustment.reason,
                        status: stockAdjustment.status,
                        adjustmentDate: stockAdjustment.adjustmentDate,
                        totalItems: stockAdjustment.totalItems,
                        totalQtyChange: stockAdjustment.totalQtyChange,
                        referenceNote: stockAdjustment.referenceNote,
                        createdAt: stockAdjustment.createdAt,
                    })
                    .from(stockAdjustment)
                    .where(where)
                    .orderBy(desc(stockAdjustment.createdAt))
                    .limit(input.pageSize)
                    .offset(offset),
                db
                    .select({ count: sql<number>`COUNT(*)::int` })
                    .from(stockAdjustment)
                    .where(where),
            ]);

            const totalCount = countResult[0]?.count ?? 0;

            return {
                items: rows,
                totalCount,
                page: input.page,
                pageSize: input.pageSize,
                totalPages: Math.ceil(totalCount / input.pageSize),
            };
        }),

    // ────────────────────────────────────────────────────────────────
    // DAMAGE MANAGEMENT ENDPOINTS
    // ────────────────────────────────────────────────────────────────

    /**
     * Create a damage entry — deducts inventory, calculates financial loss.
     */
    createDamageEntry: shopOwnerProcedure
        .input(
            z.object({
                damageType: z.enum(["physical", "expired", "lost"]),
                description: z.string().optional(),
                proofImages: z.array(z.string()).default([]),
                enteredByName: z.string().optional(),
                entryDate: z.string(),
                items: z
                    .array(
                        z.object({
                            inventoryId: z.number().int(),
                            qty: z.number().int().min(1),
                            unitPrice: z.number().min(0).optional(),
                            note: z.string().optional(),
                        }),
                    )
                    .min(1, "At least one item is required"),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Validate all inventory rows belong to this shop
            const inventoryIds = input.items.map((i) => i.inventoryId);
            const ownedInventory = await db.query.inventory.findMany({
                where: and(
                    inArray(inventory.id, inventoryIds),
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, userId),
                ),
            });

            if (ownedInventory.length !== inventoryIds.length) {
                throw new ORPCError("FORBIDDEN", {
                    message: "Some inventory items do not belong to your shop",
                });
            }

            const invLookup = new Map(
                ownedInventory.map((inv) => [inv.id, inv]),
            );

            // 2. Validate stock is sufficient
            for (const item of input.items) {
                const inv = invLookup.get(item.inventoryId)!;
                const available = parseFloat(inv.availableQty || "0");
                if (item.qty > available) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Insufficient stock for inventory ${item.inventoryId}: available=${available}, requested=${item.qty}`,
                    });
                }
            }

            // 2b. Fetch variant base prices as fallback
            const variantIds = ownedInventory.map((inv) => inv.variantId);
            const variantRows = await db
                .select({ id: productVariant.id, price: productVariant.price })
                .from(productVariant)
                .where(inArray(productVariant.id, variantIds));
            const variantPriceLookup = new Map(
                variantRows.map((v) => [v.id, parseFloat(v.price || "0")]),
            );

            // 3. Generate entry number (DMG-0001)
            const [maxResult] = await db
                .select({
                    maxNo: sql<string>`MAX(${damageEntry.entryNo})`,
                })
                .from(damageEntry)
                .where(eq(damageEntry.shopId, userId));

            const lastNum = maxResult?.maxNo
                ? parseInt(maxResult.maxNo.replace(/^DMG-/, ""), 10) || 0
                : 0;
            const entryNo = `DMG-${String(lastNum + 1).padStart(4, "0")}`;

            // 4. Build line items
            const lineItems = input.items.map((item) => {
                const inv = invLookup.get(item.inventoryId)!;
                const retailPrice = parseFloat(inv.retailPrice || "0");
                const variantBasePrice = variantPriceLookup.get(inv.variantId) ?? 0;
                const unitPrice =
                    item.unitPrice ?? (retailPrice > 0 ? retailPrice : variantBasePrice);
                return {
                    inventoryId: inv.id,
                    variantId: inv.variantId,
                    qty: item.qty,
                    unitPrice: String(unitPrice),
                    totalValue: String(item.qty * unitPrice),
                    note: item.note || null,
                };
            });

            const totalQty = lineItems.reduce((s, li) => s + li.qty, 0);
            const totalLossValue = lineItems.reduce(
                (s, li) => s + parseFloat(li.totalValue),
                0,
            );

            // 5. Transaction: insert entry + items + deduct inventory
            const result = await db.transaction(async (tx) => {
                const [header] = await tx
                    .insert(damageEntry)
                    .values({
                        entryNo,
                        shopId: userId,
                        damageType: input.damageType,
                        description: input.description || null,
                        proofImages: input.proofImages,
                        totalQty,
                        totalLossValue: String(totalLossValue),
                        enteredByName: input.enteredByName || null,
                        entryDate: input.entryDate,
                        status: "active",
                        createdById: userId,
                    })
                    .returning();

                await tx.insert(damageEntryItem).values(
                    lineItems.map((li) => ({
                        damageEntryId: header!.id,
                        inventoryId: li.inventoryId,
                        variantId: li.variantId,
                        qty: li.qty,
                        unitPrice: li.unitPrice,
                        totalValue: li.totalValue,
                        note: li.note,
                    })),
                );

                // Deduct inventory
                for (const li of lineItems) {
                    await tx
                        .update(inventory)
                        .set({
                            availableQty: sql`CAST(${inventory.availableQty} AS numeric) - ${li.qty}`,
                        })
                        .where(eq(inventory.id, li.inventoryId));
                }

                return header!;
            });

            return {
                success: true,
                entryId: result.id,
                entryNo: result.entryNo,
                totalQty,
                totalLossValue,
                message: `Damage entry ${result.entryNo} recorded — ${totalQty} item(s), ৳${totalLossValue} loss`,
            };
        }),

    /**
     * List damage entries (paginated, filterable).
     */
    getDamageEntries: shopOwnerProcedure
        .input(
            z.object({
                search: z.string().optional(),
                damageType: z
                    .enum(["physical", "expired", "lost"])
                    .optional(),
                page: z.number().int().min(1).default(1),
                pageSize: z.number().int().min(1).max(100).default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const offset = (input.page - 1) * input.pageSize;

            const conditions: SQL[] = [
                eq(damageEntry.shopId, userId),
                eq(damageEntry.status, "active"),
            ];

            if (input.damageType) {
                conditions.push(
                    eq(damageEntry.damageType, input.damageType),
                );
            }
            if (input.search?.trim()) {
                const term = `%${input.search.trim()}%`;
                conditions.push(ilike(damageEntry.entryNo, term));
            }

            const where = and(...conditions);

            const [rows, countResult] = await Promise.all([
                db
                    .select({
                        id: damageEntry.id,
                        entryNo: damageEntry.entryNo,
                        damageType: damageEntry.damageType,
                        totalQty: damageEntry.totalQty,
                        totalLossValue: damageEntry.totalLossValue,
                        enteredByName: damageEntry.enteredByName,
                        entryDate: damageEntry.entryDate,
                        createdAt: damageEntry.createdAt,
                    })
                    .from(damageEntry)
                    .where(where)
                    .orderBy(desc(damageEntry.createdAt))
                    .limit(input.pageSize)
                    .offset(offset),
                db
                    .select({ count: sql<number>`COUNT(*)::int` })
                    .from(damageEntry)
                    .where(where),
            ]);

            const totalCount = countResult[0]?.count ?? 0;

            return {
                items: rows,
                totalCount,
                page: input.page,
                pageSize: input.pageSize,
                totalPages: Math.ceil(totalCount / input.pageSize),
            };
        }),

    /**
     * Get single damage entry detail with line items.
     */
    getDamageEntryDetail: shopOwnerProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const entry = await db
                .select()
                .from(damageEntry)
                .where(
                    and(
                        eq(damageEntry.id, input.id),
                        eq(damageEntry.shopId, userId),
                    ),
                )
                .limit(1);

            if (!entry[0]) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Damage entry not found",
                });
            }

            const items = await db
                .select({
                    id: damageEntryItem.id,
                    variantId: damageEntryItem.variantId,
                    qty: damageEntryItem.qty,
                    unitPrice: damageEntryItem.unitPrice,
                    totalValue: damageEntryItem.totalValue,
                    note: damageEntryItem.note,
                    sku: productVariant.sku,
                    unitLabel: productVariant.unitLabel,
                    weightKg: productVariant.weightKg,
                    productName: product.name,
                    productImage: product.image,
                    brandName: brand.name,
                    categoryName: category.name,
                })
                .from(damageEntryItem)
                .innerJoin(
                    productVariant,
                    eq(damageEntryItem.variantId, productVariant.id),
                )
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(brand, eq(productVariant.brandId, brand.id))
                .leftJoin(category, eq(product.categoryId, category.id))
                .where(eq(damageEntryItem.damageEntryId, input.id))
                .orderBy(damageEntryItem.id);

            return { ...entry[0], items };
        }),

    /**
     * KPI summary for damage management.
     */
    getDamageSummary: shopOwnerProcedure
        .input(z.void())
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const [result] = await db
                .select({
                    totalEntries: sql<number>`COUNT(*)::int`,
                    totalDamageQty: sql<number>`COALESCE(SUM(${damageEntry.totalQty}), 0)::int`,
                    totalLossValue: sql<string>`COALESCE(SUM(${damageEntry.totalLossValue}::numeric), 0)::text`,
                })
                .from(damageEntry)
                .where(
                    and(
                        eq(damageEntry.shopId, userId),
                        eq(damageEntry.status, "active"),
                    ),
                );

            return {
                totalEntries: result?.totalEntries ?? 0,
                totalDamageQty: result?.totalDamageQty ?? 0,
                totalLossValue: parseFloat(result?.totalLossValue ?? "0"),
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Export combined router
// ────────────────────────────────────────────────────────────────

export const shopOwnerRouter = {
    ...b2bQueries,
    ...managementQueries,
    ...mutations,
    ...orderQueries,
    ...incomingOrderQueries,
    ...warehouseOrderQueries,
    ...openOrderEndpoints,
    ...warehouseConnectionEndpoints,
    ...shopStorefrontEndpoints,
    ...publicCatalogEndpoints,
    ...shopProductEndpoints,
};
