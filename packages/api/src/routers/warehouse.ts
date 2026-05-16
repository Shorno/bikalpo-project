/**
 * Warehouse ORPC Router
 *
 * Contains:
 * - Public storefront queries (anyone with the slug can browse)
 * - Management queries (warehouse role only — inventory, orders, stats)
 * - Mutations (warehouse role only — update order status)
 */

import { db } from "@bikalpo-project/db";
import {
    deliveryGroup,
    deliveryGroupInvoice,
    inventory,
    invoice,
    order,
    orderItem,
    shopWarehouseConnection,
    user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { localDateStamp } from "../utils/date";
import {
    and,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    lte,
    or,
    sql,
    sum,
    type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, warehouseProcedure } from "../index";
import { convertB2bOrderToRetailInventory } from "./helpers/b2b-conversion";

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

// ────────────────────────────────────────────────────────────────
// Public Storefront Queries (accessible by anyone with the slug)
// ────────────────────────────────────────────────────────────────

const storefrontQueries = {
    /**
     * Get warehouse info by slug (public).
     * Returns warehouse name, product count. NOT listed in any public discovery.
     */
    getStorefrontBySlug: publicProcedure
        .route({
            method: "GET",
            path: "/warehouse/storefront/{slug}",
            tags: ["Warehouse Storefront"],
            summary: "Get warehouse storefront info by slug",
        })
        .input(z.object({ slug: z.string() }))
        .handler(async ({ input }) => {
            const warehouseUser = await db
                .select({
                    id: user.id,
                    name: user.name,
                    warehouseName: user.warehouseName,
                    warehouseSlug: user.warehouseSlug,
                    warehouseAddress: user.warehouseAddress,
                    image: user.image,
                })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseSlug, input.slug),
                        eq(user.role, "warehouse"),
                    ),
                )
                .limit(1);

            if (warehouseUser.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
            }

            const warehouse = warehouseUser[0]!;

            // Count products in this warehouse's inventory
            const [productCount] = await db
                .select({ count: count() })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, warehouse.id),
                    ),
                );

            return {
                ...warehouse,
                productCount: productCount?.count || 0,
            };
        }),

    /**
     * Get products available in a warehouse storefront (public).
     */
    getStorefrontProducts: publicProcedure
        .route({
            method: "GET",
            path: "/warehouse/storefront/{slug}/products",
            tags: ["Warehouse Storefront"],
            summary: "Get warehouse storefront products",
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
                subcategory,
                brand: brandSlug,
                minPrice,
                maxPrice,
                search,
                sort = "newest",
                page: pageStr = "1",
                limit: limitStr = "12",
            } = input;

            // Find warehouse user
            const warehouseUser = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseSlug, slug),
                        eq(user.role, "warehouse"),
                    ),
                )
                .limit(1);

            if (warehouseUser.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
            }

            const warehouseId = warehouseUser[0]!.id;
            const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
            const limit = Math.min(50, Math.max(1, parseInt(limitStr ?? "12", 10) || 12));
            const offset = (page - 1) * limit;

            // Get inventory items for this warehouse with product details
            const warehouseInventory = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, warehouseId),
                    sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                ),
                with: {
                    variant: {
                        with: {
                            product: {
                                with: {
                                    category: { columns: { name: true, slug: true } },
                                    subCategory: { columns: { name: true, slug: true } },
                                    images: { limit: 1 },
                                },
                            },
                        },
                    },
                },
            });

            // Filter in application layer
            const filtered = warehouseInventory.filter((inv) => {
                const prod = inv.variant?.product;
                if (!prod) return false;

                if (categorySlug) {
                    if (prod.category?.slug !== categorySlug) return false;
                }
                if (subcategory) {
                    const slugs = subcategory.split(",").filter(Boolean);
                    if (!prod.subCategory?.slug || !slugs.includes(prod.subCategory.slug)) return false;
                }
                if (brandSlug) {
                    // Filter by product-level brand
                    const productBrand = (inv.variant?.product as any)?.brand;
                    if (productBrand?.slug !== brandSlug) return false;
                }
                if (search) {
                    if (!prod.name.toLowerCase().includes(search.toLowerCase())) return false;
                }
                if (minPrice) {
                    if (Number(inv.variant.price) < Number(minPrice)) return false;
                }
                if (maxPrice) {
                    if (Number(inv.variant.price) > Number(maxPrice)) return false;
                }
                return true;
            });

            // Sort
            filtered.sort((a, b) => {
                const prodA = a.variant?.product;
                const prodB = b.variant?.product;
                if (!prodA || !prodB) return 0;
                switch (sort) {
                    case "price_asc":
                        return Number(a.variant.price) - Number(b.variant.price);
                    case "price_desc":
                        return Number(b.variant.price) - Number(a.variant.price);
                    case "oldest":
                        return new Date(prodA.createdAt).getTime() - new Date(prodB.createdAt).getTime();
                    case "newest":
                    default:
                        return new Date(prodB.createdAt).getTime() - new Date(prodA.createdAt).getTime();
                }
            });

            const totalCount = filtered.length;
            const paginated = filtered.slice(offset, offset + limit);

            return {
                products: paginated.map((inv) => ({
                    inventoryId: inv.id,
                    availableQty: inv.availableQty,
                    retailPrice: inv.retailPrice,
                    variant: inv.variant,
                    product: inv.variant?.product,
                })),
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /**
     * Get categories available in a warehouse storefront (public).
     */
    getStorefrontCategories: publicProcedure
        .route({
            method: "GET",
            path: "/warehouse/storefront/{slug}/categories",
            tags: ["Warehouse Storefront"],
            summary: "Get warehouse storefront categories",
        })
        .input(z.object({ slug: z.string() }))
        .handler(async ({ input }) => {
            // Find warehouse user
            const warehouseUser = await db
                .select({ id: user.id })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseSlug, input.slug),
                        eq(user.role, "warehouse"),
                    ),
                )
                .limit(1);

            if (warehouseUser.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
            }

            const warehouseId = warehouseUser[0]!.id;

            // Get all categories that have items in this warehouse's inventory
            const inventoryItems = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, warehouseId),
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
};

// ────────────────────────────────────────────────────────────────
// Store Connections (Store Requests & Connected Stores)
// ────────────────────────────────────────────────────────────────

const storeConnectionQueries = {
    /**
     * Get store access requests (pending, rejected, disconnected)
     */
    getStoreRequests: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/store-requests",
            tags: ["Warehouse"],
            summary: "Get store access requests",
        })
        .input(
            z.object({
                status: z.enum(["all", "pending", "active", "disconnected"]).default("all"),
                search: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            try {
            const userId = context.session.user.id;
            const { status, search, page, limit } = input;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [eq(shopWarehouseConnection.warehouseId, userId)];
            
            if (status !== "all") {
                conditions.push(eq(shopWarehouseConnection.status, status));
            }

            // Filtering by search
            let whereClause = and(...conditions);
            if (search?.trim()) {
                const s = `%${search.toLowerCase()}%`;
                whereClause = and(
                    ...conditions,
                    sql`(LOWER(${user.shopName}) LIKE ${s} OR LOWER(${user.name}) LIKE ${s} OR ${user.phoneNumber} LIKE ${s})`
                );
            }

            // Build two independent queries (Drizzle builders are mutable, can't reuse)
            const [items, countResult] = await Promise.all([
                db
                    .select({
                        connectionId: shopWarehouseConnection.id,
                        status: shopWarehouseConnection.status,
                        connectedAt: shopWarehouseConnection.connectedAt,
                        createdAt: shopWarehouseConnection.createdAt,
                        shopId: user.id,
                        shopName: user.shopName,
                        name: user.name,
                        phone: user.phoneNumber,
                        address: user.shopAddress,
                        shopLat: user.shopLat,
                        shopLng: user.shopLng,
                        image: user.image,
                    })
                    .from(shopWarehouseConnection)
                    .innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
                    .where(whereClause!)
                    .orderBy(desc(shopWarehouseConnection.createdAt))
                    .limit(limit)
                    .offset(offset),
                db
                    .select({ count: count() })
                    .from(shopWarehouseConnection)
                    .innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
                    .where(whereClause!),
            ]);

            const totalCount = Number(countResult[0]?.count || 0);

            return {
                items,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
            } catch (err) {
                console.error("[getStoreRequests] ERROR:", err);
                throw err;
            }
        }),

    /**
     * Get KPI stats for store requests
     */
    getStoreRequestStats: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/store-requests/stats",
            tags: ["Warehouse"],
            summary: "Get stats for store access requests",
        })
        .handler(async ({ context }) => {
            try {
            const userId = context.session.user.id;

            const [stats] = await db
                .select({
                    total: count(),
                    pending: sql<number>`COALESCE(SUM(CASE WHEN ${shopWarehouseConnection.status} = 'pending' THEN 1 ELSE 0 END), 0)`.mapWith(Number),
                    approved: sql<number>`COALESCE(SUM(CASE WHEN ${shopWarehouseConnection.status} = 'active' THEN 1 ELSE 0 END), 0)`.mapWith(Number),
                    rejected: sql<number>`COALESCE(SUM(CASE WHEN ${shopWarehouseConnection.status} = 'disconnected' THEN 1 ELSE 0 END), 0)`.mapWith(Number),
                })
                .from(shopWarehouseConnection)
                .where(eq(shopWarehouseConnection.warehouseId, userId));

            return {
                total: stats?.total ?? 0,
                pending: stats?.pending ?? 0,
                approved: stats?.approved ?? 0,
                rejected: stats?.rejected ?? 0,
            };
            } catch (err) {
                console.error("[getStoreRequestStats] ERROR:", err);
                throw err;
            }
        }),

    /**
     * Get details for a single store request
     */
    getStoreRequestDetail: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/store-requests/{connectionId}",
            tags: ["Warehouse"],
            summary: "Get details for a store request",
        })
        .input(z.object({ connectionId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const conn = await db
                .select({
                    connectionId: shopWarehouseConnection.id,
                    status: shopWarehouseConnection.status,
                    connectedAt: shopWarehouseConnection.connectedAt,
                    createdAt: shopWarehouseConnection.createdAt,
                    shopId: user.id,
                    shopName: user.shopName,
                    name: user.name,
                    phone: user.phoneNumber,
                    address: user.shopAddress,
                    shopLat: user.shopLat,
                    shopLng: user.shopLng,
                    area: sql<string | null>`NULL`,
                    image: user.image,
                })
                .from(shopWarehouseConnection)
                .innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
                .where(
                    and(
                        eq(shopWarehouseConnection.id, input.connectionId),
                        eq(shopWarehouseConnection.warehouseId, userId)
                    )
                )
                .limit(1);

            if (conn.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Request not found" });
            }

            const shopData = conn[0]!;

            // Get total orders and spent from this shop
            const [orderStats] = await db
                .select({
                    totalOrders: count(order.id),
                    totalSpent: sum(order.total),
                })
                .from(order)
                .where(
                    and(
                        eq(order.userId, shopData.shopId),
                        eq(order.warehouseId, userId),
                        inArray(order.status, ["confirmed", "processing", "delivered"])
                    )
                );

            return {
                ...shopData,
                totalOrders: Number(orderStats?.totalOrders || 0),
                totalSpent: Number(orderStats?.totalSpent || 0),
            };
        }),

    /**
     * Approve a store request
     */
    approveStoreRequest: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/store-requests/{connectionId}/approve",
            tags: ["Warehouse"],
            summary: "Approve a store request",
        })
        .input(z.object({ connectionId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existing = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.id, input.connectionId),
                    eq(shopWarehouseConnection.warehouseId, userId)
                )
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Request not found" });
            }

            await db
                .update(shopWarehouseConnection)
                .set({
                    status: "active",
                    connectedAt: new Date(),
                })
                .where(eq(shopWarehouseConnection.id, input.connectionId));

            return { success: true, message: "Store approved" };
        }),

    /**
     * Reject a store request
     */
    rejectStoreRequest: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/store-requests/{connectionId}/reject",
            tags: ["Warehouse"],
            summary: "Reject a store request",
        })
        .input(z.object({ connectionId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existing = await db.query.shopWarehouseConnection.findFirst({
                where: and(
                    eq(shopWarehouseConnection.id, input.connectionId),
                    eq(shopWarehouseConnection.warehouseId, userId)
                )
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Request not found" });
            }

            await db
                .update(shopWarehouseConnection)
                .set({
                    status: "disconnected",
                })
                .where(eq(shopWarehouseConnection.id, input.connectionId));

            return { success: true, message: "Store rejected" };
        }),

    /**
     * Get all connected stores
     */
    getConnectedStores: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/connected-stores",
            tags: ["Warehouse"],
            summary: "Get connected stores",
        })
        .input(
            z.object({
                search: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { search, page, limit } = input;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [
                eq(shopWarehouseConnection.warehouseId, userId),
                eq(shopWarehouseConnection.status, "active")
            ];

            // Filtering by search
            let whereClause = and(...conditions);
            if (search?.trim()) {
                const s = `%${search.toLowerCase()}%`;
                whereClause = and(
                    ...conditions,
                    sql`(LOWER(${user.shopName}) LIKE ${s} OR LOWER(${user.name}) LIKE ${s} OR ${user.phoneNumber} LIKE ${s})`
                );
            }

            // Build two independent queries (Drizzle builders are mutable, can't reuse)
            const [items, countResult] = await Promise.all([
                db
                    .select({
                        connectionId: shopWarehouseConnection.id,
                        connectedAt: shopWarehouseConnection.connectedAt,
                        lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                        shopId: user.id,
                        shopName: user.shopName,
                        name: user.name,
                        phone: user.phoneNumber,
                        address: user.shopAddress,
                        shopLat: user.shopLat,
                        shopLng: user.shopLng,
                        image: user.image,
                    })
                    .from(shopWarehouseConnection)
                    .innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
                    .where(whereClause!)
                    .orderBy(desc(shopWarehouseConnection.lastOrderedAt), desc(shopWarehouseConnection.connectedAt))
                    .limit(limit)
                    .offset(offset),
                db
                    .select({ count: count() })
                    .from(shopWarehouseConnection)
                    .innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
                    .where(whereClause!),
            ]);

            // Enrich with order stats for each connected store
            const enrichedItems = await Promise.all(
                items.map(async (item) => {
                    const [orderStats] = await db
                        .select({
                            totalOrders: count(order.id),
                            totalRevenue: sum(order.total),
                        })
                        .from(order)
                        .where(
                            and(
                                eq(order.userId, item.shopId),
                                eq(order.warehouseId, userId),
                                inArray(order.status, ["confirmed", "processing", "delivered"])
                            )
                        );
                        
                    return {
                        ...item,
                        totalOrders: Number(orderStats?.totalOrders || 0),
                        totalRevenue: Number(orderStats?.totalRevenue || 0),
                    };
                })
            );

            const totalCount = Number(countResult[0]?.count || 0);

            return {
                items: enrichedItems,
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
// Management Queries (warehouse role only)
// ────────────────────────────────────────────────────────────────

const managementQueries = {
    /**
     * Get warehouse's own inventory.
     */
    getMyInventory: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/inventory",
            tags: ["Warehouse"],
            summary: "Get warehouse inventory",
        })
        .input(
            z.object({
                search: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { search, page, limit } = input;
            const offset = (page - 1) * limit;

            const items = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            brand: { columns: { id: true, name: true } },
                            product: {
                                with: {
                                    category: { columns: { name: true, slug: true } },
                                    images: { limit: 1 },
                                },
                            },
                        },
                    },
                },
            });

            // Filter by search if needed
            let filtered = items;
            if (search?.trim()) {
                const s = search.toLowerCase();
                filtered = items.filter(
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
     * Get dashboard summary stats for the warehouse.
     */
    getDashboardStats: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/dashboard-stats",
            tags: ["Warehouse"],
            summary: "Get warehouse dashboard stats",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Total outgoing orders (shop owners / warehouses buying from this warehouse)
            const [outgoingStats] = await db
                .select({
                    totalOrders: count(order.id),
                    totalRevenue: sum(order.total),
                })
                .from(order)
                .where(eq(order.warehouseId, userId));

            // Pending incoming orders
            const [pendingStats] = await db
                .select({ count: count(order.id) })
                .from(order)
                .where(
                    and(
                        eq(order.warehouseId, userId),
                        eq(order.status, "pending"),
                    ),
                );

            // Delivered orders
            const [deliveredStats] = await db
                .select({ count: count(order.id) })
                .from(order)
                .where(
                    and(
                        eq(order.warehouseId, userId),
                        eq(order.status, "delivered"),
                    ),
                );

            // Inventory stats
            const [inventoryStats] = await db
                .select({
                    totalProducts: count(inventory.id),
                    totalStock: sum(inventory.availableQty),
                })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, userId),
                    ),
                );

            return {
                totalOrders: outgoingStats?.totalOrders || 0,
                totalRevenue: Number(outgoingStats?.totalRevenue || 0),
                pendingOrders: pendingStats?.count || 0,
                deliveredOrders: deliveredStats?.count || 0,
                totalProducts: inventoryStats?.totalProducts || 0,
                totalStock: Number(inventoryStats?.totalStock || 0),
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Order Queries (warehouse role only)
// ────────────────────────────────────────────────────────────────

const orderSourceInput = z
    .enum(["all", "direct", "salesman", "estimate", "pre_order"])
    .default("all");

const orderOverviewStatusInput = z
    .enum(["all", "pending", "accepted", "processing", "rejected"])
    .default("all");

const orderPaymentFilterInput = z
    .enum(["all", "paid", "due", "partial"])
    .default("all");

const orderDateFilterInput = z
    .enum(["today", "this_month", "custom", "all"])
    .default("all");

function getOrderStatusCondition(status: z.infer<typeof orderOverviewStatusInput>) {
    switch (status) {
        case "pending":
            return eq(order.status, "pending");
        case "accepted":
            return eq(order.status, "confirmed");
        case "processing":
            return eq(order.status, "processing");
        case "rejected":
            return eq(order.status, "cancelled");
        default:
            return null;
    }
}

function getDateFilterRange(input: {
    dateRange: z.infer<typeof orderDateFilterInput>;
    dateFrom?: string;
    dateTo?: string;
}) {
    if (input.dateRange === "all") return null;

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (input.dateRange === "today") {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
    }

    if (input.dateRange === "this_month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
    }

    if (input.dateRange === "custom") {
        start = input.dateFrom ? new Date(input.dateFrom) : null;
        end = input.dateTo ? new Date(input.dateTo) : null;
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);
    }

    return { start, end };
}

function getEffectiveItemQty(item: { quantity: number; modifiedQty: number | null }) {
    return item.modifiedQty ?? item.quantity;
}

function getEffectiveItemPrice(item: {
    unitPrice: string;
    modifiedUnitPrice: string | null;
}) {
    return item.modifiedUnitPrice ?? item.unitPrice;
}

const orderQueries = {
    /**
     * Direct order overview for warehouse order management.
     */
    getOrderOverview: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/order-management",
            tags: ["Warehouse"],
            summary: "Get order management overview",
        })
        .input(
            z.object({
                source: orderSourceInput,
                status: orderOverviewStatusInput,
                payment: orderPaymentFilterInput,
                dateRange: orderDateFilterInput,
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
                search: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const page = Math.max(1, input.page);
            const limit = Math.min(100, Math.max(1, input.limit));
            const offset = (page - 1) * limit;

            const warehouseUser = await db.query.user.findFirst({
                where: eq(user.id, userId),
                columns: { name: true, warehouseName: true },
            });

            const baseConditions: SQL[] = [
                eq(order.warehouseId, userId),
                eq(order.orderType, "b2b"),
            ];

            const sourceSummary = await db
                .select({
                    direct: sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'direct')`.mapWith(Number),
                    salesman: sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'salesman')`.mapWith(Number),
                    estimate: sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'estimate')`.mapWith(Number),
                    preOrder: sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'pre_order')`.mapWith(Number),
                })
                .from(order)
                .where(and(...baseConditions));

            const conditions: SQL[] = [
                ...baseConditions,
            ];

            if (input.source !== "all") {
                conditions.push(eq(order.orderSource, input.source));
            }

            const statusCondition = getOrderStatusCondition(input.status);
            if (statusCondition) conditions.push(statusCondition);

            if (input.payment === "paid") {
                conditions.push(eq(order.paymentStatus, "paid"));
            } else if (input.payment === "due") {
                conditions.push(eq(order.paymentStatus, "pending"));
            } else if (input.payment === "partial") {
                conditions.push(sql`false`);
            }

            const dateRange = getDateFilterRange(input);
            if (dateRange?.start) conditions.push(gte(order.createdAt, dateRange.start));
            if (dateRange?.end) conditions.push(lte(order.createdAt, dateRange.end));

            if (input.search?.trim()) {
                const term = `%${input.search.trim()}%`;
                conditions.push(
                    or(
                        ilike(order.orderNumber, term),
                        ilike(order.shippingName, term),
                        ilike(order.shippingPhone, term),
                        ilike(user.name, term),
                        ilike(user.shopName, term),
                    )!,
                );
            }

            const where = and(...conditions);

            const [orders, countResult] = await Promise.all([
                db
                    .select({
                        id: order.id,
                        orderNumber: order.orderNumber,
                        orderSource: order.orderSource,
                        status: order.status,
                        total: order.total,
                        subtotal: order.subtotal,
                        paymentMethod: order.paymentMethod,
                        paymentStatus: order.paymentStatus,
                        shippingName: order.shippingName,
                        shippingPhone: order.shippingPhone,
                        shippingCity: order.shippingCity,
                        shippingArea: order.shippingArea,
                        createdAt: order.createdAt,
                        confirmedAt: order.confirmedAt,
                        processingStartedAt: order.processingStartedAt,
                        packingStartedAt: order.packingStartedAt,
                        readyAt: order.readyAt,
                        deliveredAt: order.deliveredAt,
                        modifiedByWarehouseAt: order.modifiedByWarehouseAt,
                        modificationAcceptedAt: order.modificationAcceptedAt,
                        buyerId: order.userId,
                        buyerName: user.name,
                        buyerShopName: user.shopName,
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
                    .leftJoin(user, eq(order.userId, user.id))
                    .where(where),
            ]);

            const orderIds = orders.map((o) => o.id);
            const [items, orderInvoices] = orderIds.length
                ? await Promise.all([
                    db
                    .select({
                        orderId: orderItem.orderId,
                        id: orderItem.id,
                        productName: orderItem.productName,
                    })
                    .from(orderItem)
                    .where(inArray(orderItem.orderId, orderIds)),
                    db
                    .select({
                        id: invoice.id,
                        orderId: invoice.orderId,
                        invoiceNumber: invoice.invoiceNumber,
                        deliveryStatus: invoice.deliveryStatus,
                        paymentStatus: invoice.paymentStatus,
                        deliverymanId: invoice.deliverymanId,
                        createdAt: invoice.createdAt,
                    })
                    .from(invoice)
                    .where(
                        and(
                            inArray(invoice.orderId, orderIds),
                            eq(invoice.invoiceType, "main"),
                        ),
                    ),
                ])
                : [[], []];

            const invoiceIds = orderInvoices.map((item) => item.id);
            const deliveryLinks = invoiceIds.length
                ? await db
                    .select({
                        invoiceId: deliveryGroupInvoice.invoiceId,
                        groupId: deliveryGroup.id,
                        groupName: deliveryGroup.groupName,
                        groupStatus: deliveryGroup.status,
                        deliverymanId: deliveryGroup.deliverymanId,
                    })
                    .from(deliveryGroupInvoice)
                    .innerJoin(
                        deliveryGroup,
                        eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
                    )
                    .where(inArray(deliveryGroupInvoice.invoiceId, invoiceIds))
                : [];

            const itemCounts = new Map<number, number>();
            const firstItems = new Map<number, string>();
            for (const item of items) {
                itemCounts.set(item.orderId, (itemCounts.get(item.orderId) ?? 0) + 1);
                if (!firstItems.has(item.orderId)) firstItems.set(item.orderId, item.productName);
            }

            const invoiceByOrderId = new Map(
                orderInvoices.map((item) => [item.orderId, item]),
            );
            const deliveryByInvoiceId = new Map(
                deliveryLinks.map((item) => [item.invoiceId, item]),
            );

            const totalCount = Number(countResult[0]?.count) || 0;
            const summary = sourceSummary[0] ?? {
                direct: 0,
                salesman: 0,
                estimate: 0,
                preOrder: 0,
            };

            return {
                warehouse: {
                    label: warehouseUser?.warehouseName || warehouseUser?.name || "Warehouse",
                },
                summary,
                orders: orders.map((o) => {
                    const rowInvoice = invoiceByOrderId.get(o.id);
                    const rowDelivery = rowInvoice
                        ? deliveryByInvoiceId.get(rowInvoice.id)
                        : null;

                    return {
                        ...o,
                        customerName: o.buyerShopName || o.buyerName || o.shippingName,
                        itemCount: itemCounts.get(o.id) ?? 0,
                        firstItemName: firstItems.get(o.id) ?? null,
                        requiresBuyerAcceptance:
                            !!o.modifiedByWarehouseAt
                            && !o.modificationAcceptedAt
                            && o.status !== "cancelled",
                        invoicePrepared: !!rowInvoice,
                        invoiceNumber: rowInvoice?.invoiceNumber ?? null,
                        invoiceDeliveryStatus: rowInvoice?.deliveryStatus ?? null,
                        invoicePaymentStatus: rowInvoice?.paymentStatus ?? null,
                        deliveryGroupId: rowDelivery?.groupId ?? null,
                        deliveryGroupName: rowDelivery?.groupName ?? null,
                        deliveryGroupStatus: rowDelivery?.groupStatus ?? null,
                        deliverymanId:
                            rowDelivery?.deliverymanId
                            ?? rowInvoice?.deliverymanId
                            ?? null,
                    };
                }),
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /**
     * Direct order detail for warehouse approval and dispatch preparation.
     */
    getOrderDetail: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/order-management/{orderId}",
            tags: ["Warehouse"],
            summary: "Get order management detail",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const warehouseUser = await db.query.user.findFirst({
                where: eq(user.id, userId),
                columns: { name: true, warehouseName: true },
            });

            const orderData = await db.query.order.findFirst({
                where: and(
                    eq(order.id, input.orderId),
                    eq(order.warehouseId, userId),
                    eq(order.orderType, "b2b"),
                ),
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                            shopName: true,
                            shopAddress: true,
                        },
                    },
                    items: {
                        with: {
                            product: {
                                columns: {
                                    id: true,
                                    name: true,
                                    image: true,
                                },
                            },
                            variant: {
                                columns: {
                                    id: true,
                                    sku: true,
                                    unitLabel: true,
                                    weightKg: true,
                                    packType: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!orderData) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            const variantIds = orderData.items
                .map((item) => item.variantId)
                .filter((id): id is number => id !== null);

            const inventoryRows = variantIds.length
                ? await db
                    .select({
                        id: inventory.id,
                        variantId: inventory.variantId,
                        availableQty: inventory.availableQty,
                        reservedQty: inventory.reservedQty,
                    })
                    .from(inventory)
                    .where(
                        and(
                            eq(inventory.ownerType, "warehouse"),
                            eq(inventory.ownerId, userId),
                            inArray(inventory.variantId, variantIds),
                        ),
                    )
                : [];

            const inventoryByVariant = new Map(
                inventoryRows.map((row) => [row.variantId, row]),
            );

            const invoices = await db.query.invoice.findMany({
                where: eq(invoice.orderId, orderData.id),
                with: {
                    items: true,
                    deliveryman: {
                        columns: {
                            id: true,
                            name: true,
                            phoneNumber: true,
                        },
                    },
                },
                orderBy: [desc(invoice.createdAt)],
            });

            const invoiceIds = invoices.map((item) => item.id);
            const deliveryLinks = invoiceIds.length
                ? await db
                    .select({
                        invoiceId: deliveryGroupInvoice.invoiceId,
                        groupId: deliveryGroup.id,
                        groupName: deliveryGroup.groupName,
                        groupStatus: deliveryGroup.status,
                        deliverymanId: deliveryGroup.deliverymanId,
                        deliverymanName: user.name,
                        deliverymanPhone: user.phoneNumber,
                    })
                    .from(deliveryGroupInvoice)
                    .innerJoin(
                        deliveryGroup,
                        eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
                    )
                    .leftJoin(user, eq(deliveryGroup.deliverymanId, user.id))
                    .where(inArray(deliveryGroupInvoice.invoiceId, invoiceIds))
                : [];

            const currentInvoice = invoices[0] ?? null;
            const currentDelivery = currentInvoice
                ? deliveryLinks.find((row) => row.invoiceId === currentInvoice.id) ?? null
                : null;

            const items = orderData.items.map((item) => {
                const stock = item.variantId
                    ? inventoryByVariant.get(item.variantId)
                    : undefined;
                const approvedQty = getEffectiveItemQty(item);
                const effectivePrice = Number(getEffectiveItemPrice(item));

                return {
                    ...item,
                    approvedQty,
                    approvedTotal: (approvedQty * effectivePrice).toFixed(2),
                    stock: {
                        availableQty: stock?.availableQty ?? "0",
                        reservedQty: stock?.reservedQty ?? "0",
                    },
                };
            });

            const finalApprovedTotal = items.reduce(
                (sumValue, item) => sumValue + Number(item.approvedTotal),
                0,
            );

            const requiresBuyerAcceptance =
                !!orderData.modifiedByWarehouseAt
                && !orderData.modificationAcceptedAt
                && !orderData.modificationRejectedAt
                && orderData.status !== "cancelled";

            const canPrepareDispatch =
                orderData.status === "confirmed"
                && !requiresBuyerAcceptance
                && !currentInvoice;

            return {
                warehouse: {
                    label: warehouseUser?.warehouseName || warehouseUser?.name || "Warehouse",
                },
                order: {
                    ...orderData,
                    customerName:
                        orderData.user?.shopName
                        || orderData.user?.name
                        || orderData.shippingName,
                    customerPhone:
                        orderData.user?.phoneNumber || orderData.shippingPhone,
                    items,
                    finalApprovedTotal: finalApprovedTotal.toFixed(2),
                    requiresBuyerAcceptance,
                    canPrepareDispatch,
                },
                invoice: currentInvoice
                    ? {
                        id: currentInvoice.id,
                        invoiceNumber: currentInvoice.invoiceNumber,
                        deliveryStatus: currentInvoice.deliveryStatus,
                        paymentStatus: currentInvoice.paymentStatus,
                        deliveryman: currentInvoice.deliveryman,
                    }
                    : null,
                delivery: currentDelivery,
                flow: [
                    { key: "placed", label: "Order Placed", completed: true, date: orderData.createdAt },
                    {
                        key: "review",
                        label: orderData.status === "pending" ? "Review" : "Reviewed",
                        completed: orderData.status !== "pending",
                        date: orderData.confirmedAt || orderData.cancelledAt,
                    },
                    {
                        key: "approved",
                        label: orderData.status === "cancelled" ? "Rejected" : "Approved",
                        completed: ["confirmed", "processing", "delivered", "cancelled"].includes(orderData.status),
                        date: orderData.confirmedAt || orderData.cancelledAt,
                    },
                    {
                        key: "ready",
                        label: "Packing / Ready",
                        completed: !!orderData.packingStartedAt || !!orderData.readyAt,
                        date: orderData.readyAt || orderData.packingStartedAt,
                    },
                    {
                        key: "invoice",
                        label: "Invoice Prepared",
                        completed: !!currentInvoice,
                        date: currentInvoice?.createdAt ?? null,
                    },
                    {
                        key: "dispatch",
                        label: "Dispatch Group",
                        completed: !!currentDelivery,
                        date: null,
                    },
                    {
                        key: "deliveryman",
                        label: "Deliveryman Assigned",
                        completed: !!currentDelivery?.deliverymanId || !!currentInvoice?.deliverymanId,
                        date: null,
                    },
                ],
            };
        }),

    /**
     * Accept/modify or reject a pending direct order.
     */
    reviewOrder: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/order-management/review",
            tags: ["Warehouse"],
            summary: "Review direct order",
        })
        .input(
            z.object({
                orderId: z.number(),
                decision: z.enum(["accept", "reject"]),
                items: z
                    .array(
                        z.object({
                            itemId: z.number(),
                            approvedQty: z.number().int().min(0),
                        }),
                    )
                    .optional(),
                approvalNote: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(
                    eq(order.id, input.orderId),
                    eq(order.warehouseId, userId),
                    eq(order.orderSource, "direct"),
                ),
                with: { items: true },
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", { message: "Direct order not found" });
            }

            if (existingOrder.status !== "pending") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Only pending direct orders can be reviewed",
                });
            }

            if (input.decision === "reject") {
                await db
                    .update(order)
                    .set({
                        status: "cancelled",
                        cancelledAt: new Date(),
                        adminNote: input.approvalNote || existingOrder.adminNote,
                    })
                    .where(eq(order.id, existingOrder.id));

                return {
                    success: true,
                    message: `Order ${existingOrder.orderNumber} rejected`,
                };
            }

            const approvedQtyByItem = new Map(
                (input.items ?? []).map((item) => [item.itemId, item.approvedQty]),
            );

            const reviewItems = existingOrder.items.map((item) => {
                const approvedQty = approvedQtyByItem.get(item.id) ?? item.quantity;
                if (approvedQty > item.quantity) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Approved quantity cannot exceed ordered quantity for ${item.productName}`,
                    });
                }
                return { item, approvedQty };
            });

            const approvedTotalQty = reviewItems.reduce(
                (sumValue, item) => sumValue + item.approvedQty,
                0,
            );

            if (approvedTotalQty <= 0) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "At least one item quantity must be approved",
                });
            }

            const variantIds = reviewItems
                .map(({ item }) => item.variantId)
                .filter((id): id is number => id !== null);

            const inventoryRows = variantIds.length
                ? await db
                    .select()
                    .from(inventory)
                    .where(
                        and(
                            eq(inventory.ownerType, "warehouse"),
                            eq(inventory.ownerId, userId),
                            inArray(inventory.variantId, variantIds),
                        ),
                    )
                : [];

            const inventoryByVariant = new Map(
                inventoryRows.map((row) => [row.variantId, row]),
            );

            for (const { item, approvedQty } of reviewItems) {
                if (approvedQty <= 0) continue;
                if (!item.variantId) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `${item.productName} has no variant for stock reservation`,
                    });
                }
                const stock = inventoryByVariant.get(item.variantId);
                if (!stock || Number(stock.availableQty) < approvedQty) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Insufficient stock for ${item.productName}. Available: ${stock?.availableQty ?? 0}`,
                    });
                }
            }

            const hasModifications = reviewItems.some(
                ({ item, approvedQty }) => approvedQty !== item.quantity,
            );
            const approvedSubtotal = reviewItems.reduce(
                (sumValue, { item, approvedQty }) =>
                    sumValue + approvedQty * Number(getEffectiveItemPrice(item)),
                0,
            );

            await db.transaction(async (tx) => {
                for (const { item, approvedQty } of reviewItems) {
                    await tx
                        .update(orderItem)
                        .set({
                            modifiedQty: approvedQty !== item.quantity ? approvedQty : null,
                            modifiedUnitPrice: null,
                        })
                        .where(eq(orderItem.id, item.id));

                    if (approvedQty > 0 && item.variantId) {
                        await tx
                            .update(inventory)
                            .set({
                                availableQty: sql`CAST(${inventory.availableQty} AS numeric) - ${approvedQty}`,
                                reservedQty: sql`CAST(${inventory.reservedQty} AS numeric) + ${approvedQty}`,
                            })
                            .where(
                                and(
                                    eq(inventory.ownerType, "warehouse"),
                                    eq(inventory.ownerId, userId),
                                    eq(inventory.variantId, item.variantId),
                                ),
                            );
                    }
                }

                await tx
                    .update(order)
                    .set({
                        status: "confirmed",
                        subtotal: approvedSubtotal.toFixed(2),
                        total: approvedSubtotal.toFixed(2),
                        confirmedSubtotal: approvedSubtotal.toFixed(2),
                        confirmedTotal: approvedSubtotal.toFixed(2),
                        confirmedAt: new Date(),
                        modifiedByWarehouseAt: hasModifications ? new Date() : null,
                        modificationAcceptedAt: null,
                        modificationRejectedAt: null,
                        adminNote: input.approvalNote || existingOrder.adminNote,
                    })
                    .where(eq(order.id, existingOrder.id));
            });

            return {
                success: true,
                modified: hasModifications,
                message: hasModifications
                    ? `Order ${existingOrder.orderNumber} accepted with quantity changes`
                    : `Order ${existingOrder.orderNumber} accepted`,
            };
        }),

    /**
     * Prepare an approved order for dispatch by generating its invoice.
     */
    prepareOrderForDispatch: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/order-management/prepare-dispatch",
            tags: ["Warehouse"],
            summary: "Prepare direct order for dispatch",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(
                    eq(order.id, input.orderId),
                    eq(order.warehouseId, userId),
                    eq(order.orderSource, "direct"),
                ),
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", { message: "Direct order not found" });
            }

            if (existingOrder.status !== "confirmed") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Only accepted orders can be prepared for dispatch",
                });
            }

            if (
                existingOrder.modifiedByWarehouseAt
                && !existingOrder.modificationAcceptedAt
                && !existingOrder.modificationRejectedAt
            ) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Retailer must accept the modified quantities before dispatch",
                });
            }

            const existingInvoice = await db.query.invoice.findFirst({
                where: and(eq(invoice.orderId, input.orderId), eq(invoice.invoiceType, "main")),
            });

            if (existingInvoice) {
                return {
                    success: true,
                    invoice: existingInvoice,
                    message: "Invoice already prepared",
                };
            }

            const { generateInvoiceFromOrder } = await import("./helpers/generate-invoice");
            const newInvoice = await generateInvoiceFromOrder(input.orderId);

            await db
                .update(order)
                .set({
                    readyAt: existingOrder.readyAt || new Date(),
                })
                .where(eq(order.id, input.orderId));

            return {
                success: true,
                invoice: newInvoice,
                message: `Invoice ${newInvoice.invoiceNumber} prepared for dispatch`,
            };
        }),

    /**
     * Get incoming orders (shop owners / warehouses buying from this warehouse).
     */
    getIncomingOrders: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/incoming-orders",
            tags: ["Warehouse"],
            summary: "Get incoming orders to this warehouse",
        })
        .input(
            z.object({
                status: z.enum(["all", "pending", "confirmed", "processing", "delivered", "returned", "cancelled"]).default("all"),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const page = input.page;
            const limit = input.limit;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [eq(order.warehouseId, userId)];

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
                        createdAt: order.createdAt,
                        buyerId: order.userId,
                        buyerName: user.name,
                        buyerShopName: user.shopName,
                        buyerWarehouseName: user.warehouseName,
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

    /**
     * Update status of an incoming order (confirm / cancel / deliver).
     */
    updateIncomingOrderStatus: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/incoming-orders/update-status",
            tags: ["Warehouse"],
            summary: "Update status of an incoming order",
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
                    eq(order.warehouseId, userId),
                ),
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Order not found or not assigned to your warehouse",
                });
            }

            const updateData: Record<string, any> = {
                status: input.status,
            };

            if (input.status === "confirmed") updateData.confirmedAt = new Date();
            if (input.status === "delivered") updateData.deliveredAt = new Date();
            if (input.status === "cancelled") updateData.cancelledAt = new Date();

            // Use transaction for delivery to ensure atomic conversion
            await db.transaction(async (tx) => {
                await tx
                    .update(order)
                    .set(updateData)
                    .where(eq(order.id, input.orderId));

                // Auto-convert warehouse inventory → shop retail inventory on delivery
                if (input.status === "delivered") {
                    await convertB2bOrderToRetailInventory(tx, input.orderId);
                }
            });

            return {
                success: true,
                message: `Order ${existingOrder.orderNumber} updated to ${input.status}`,
            };
        }),

    /**
     * Update item quantities on a pending incoming order.
     * Warehouse can adjust quantities before confirming if stock is insufficient.
     */
    updateIncomingOrderItems: warehouseProcedure
        .input(
            z.object({
                orderId: z.number(),
                items: z.array(z.object({
                    itemId: z.number(),
                    quantity: z.number().min(0),
                })),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(
                    eq(order.id, input.orderId),
                    eq(order.warehouseId, userId),
                ),
                with: { items: true },
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Order not found or not assigned to your warehouse",
                });
            }

            if (existingOrder.status !== "pending") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Can only edit items on pending orders",
                });
            }

            await db.transaction(async (tx) => {
                for (const update of input.items) {
                    const existingItem = existingOrder.items.find((i) => i.id === update.itemId);
                    if (!existingItem) continue;

                    if (update.quantity === 0) {
                        // Remove item entirely
                        await tx.delete(orderItem).where(eq(orderItem.id, update.itemId));

                        // Restore inventory
                        if (existingItem.variantId) {
                            await tx
                                .update(inventory)
                                .set({
                                    availableQty: sql`CAST(${inventory.availableQty} AS numeric) + ${existingItem.quantity}`,
                                })
                                .where(
                                    and(
                                        eq(inventory.ownerType, "warehouse"),
                                        eq(inventory.ownerId, userId),
                                        eq(inventory.variantId, existingItem.variantId),
                                    ),
                                );
                        }
                    } else if (update.quantity !== existingItem.quantity) {
                        const diff = update.quantity - existingItem.quantity;
                        const unitPrice = Number(existingItem.unitPrice);
                        const newTotal = (unitPrice * update.quantity).toFixed(2);

                        await tx
                            .update(orderItem)
                            .set({
                                quantity: update.quantity,
                                totalPrice: newTotal,
                            })
                            .where(eq(orderItem.id, update.itemId));

                        // Adjust inventory (negative diff = restore stock, positive = deduct)
                        if (existingItem.variantId) {
                            await tx
                                .update(inventory)
                                .set({
                                    availableQty: sql`CAST(${inventory.availableQty} AS numeric) - ${diff}`,
                                })
                                .where(
                                    and(
                                        eq(inventory.ownerType, "warehouse"),
                                        eq(inventory.ownerId, userId),
                                        eq(inventory.variantId, existingItem.variantId),
                                    ),
                                );
                        }
                    }
                }

                // Recalculate order totals
                const updatedItems = await tx.query.orderItem.findMany({
                    where: eq(orderItem.orderId, input.orderId),
                });

                if (updatedItems.length === 0) {
                    // All items removed → cancel order
                    await tx
                        .update(order)
                        .set({ status: "cancelled", cancelledAt: new Date() })
                        .where(eq(order.id, input.orderId));
                } else {
                    const subtotal = updatedItems.reduce((s, i) => s + Number(i.totalPrice), 0);
                    await tx
                        .update(order)
                        .set({
                            subtotal: subtotal.toFixed(2),
                            total: subtotal.toFixed(2),
                        })
                        .where(eq(order.id, input.orderId));
                }
            });

            return {
                success: true,
                message: "Order items updated",
            };
        }),

    /**
     * Record a partial delivery for an order.
     * Warehouse records how many units were delivered per item in this batch.
     */
    recordPartialDelivery: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/incoming-orders/partial-delivery",
            tags: ["Warehouse"],
            summary: "Record partial delivery for an order",
        })
        .input(
            z.object({
                orderId: z.number(),
                items: z.array(
                    z.object({
                        itemId: z.number(),
                        deliveredQty: z.number().min(0),
                    }),
                ),
                riderName: z.string().optional(),
                riderPhone: z.string().optional(),
                trackingId: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingOrder = await db.query.order.findFirst({
                where: and(
                    eq(order.id, input.orderId),
                    eq(order.warehouseId, userId),
                ),
                with: { items: true },
            });

            if (!existingOrder) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Order not found or not assigned to your warehouse",
                });
            }

            if (!["confirmed", "processing"].includes(existingOrder.status)) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Cannot record delivery for order with status '${existingOrder.status}'`,
                });
            }

            await db.transaction(async (tx) => {
                let allFullyDelivered = true;

                for (const delivery of input.items) {
                    const existingItem = existingOrder.items.find(
                        (i) => i.id === delivery.itemId,
                    );
                    if (!existingItem) continue;

                    const newDelivered =
                        (existingItem.deliveredQty || 0) + delivery.deliveredQty;
                    const targetQty =
                        existingItem.modifiedQty ?? existingItem.quantity;

                    // Cap at target quantity
                    const cappedDelivered = Math.min(newDelivered, targetQty);

                    await tx
                        .update(orderItem)
                        .set({ deliveredQty: cappedDelivered })
                        .where(eq(orderItem.id, delivery.itemId));

                    if (cappedDelivered < targetQty) {
                        allFullyDelivered = false;
                    }
                }

                // Update order: set processing if first delivery, or delivered if all items fully delivered
                const updateData: Record<string, any> = {
                    status: "processing",
                    processingStartedAt:
                        existingOrder.processingStartedAt || new Date(),
                };

                // Update rider/tracking info if provided
                if (input.riderName)
                    updateData.riderName = input.riderName;
                if (input.riderPhone)
                    updateData.riderPhone = input.riderPhone;
                if (input.trackingId)
                    updateData.trackingId = input.trackingId;

                if (allFullyDelivered) {
                    updateData.status = "delivered";
                    updateData.deliveredAt = new Date();
                }

                await tx
                    .update(order)
                    .set(updateData)
                    .where(eq(order.id, input.orderId));

                // If fully delivered, trigger B2B conversion
                if (allFullyDelivered) {
                    try {
                        await convertB2bOrderToRetailInventory(
                            tx,
                            input.orderId,
                        );
                    } catch (err: any) {
                        console.error(
                            `[PARTIAL-DELIVERY] B2B conversion failed for order #${input.orderId}:`,
                            err,
                        );
                    }
                }
            });

            return {
                success: true,
                message: "Partial delivery recorded",
            };
        }),

    /**
     * Get warehouse's own purchase orders (buying from other warehouses).
     */
    getMyOrders: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/my-orders",
            tags: ["Warehouse"],
            summary: "Get warehouse's own purchase orders",
        })
        .input(
            z.object({
                status: z
                    .enum(["pending", "confirmed", "processing", "delivered", "cancelled"])
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
};

// ────────────────────────────────────────────────────────────────
// Supplier CRUD (warehouse role only)
// ────────────────────────────────────────────────────────────────

import {
    supplier,
    purchase,
    purchaseItem,
    product as productTable,
    productVariant,
    category,
} from "@bikalpo-project/db/schema";

// ────────────────────────────────────────────────────────────────
// Product Variant Search (for purchase form)
// ────────────────────────────────────────────────────────────────

const variantQueries = {
    // Search product variants for the purchase form dropdown
    // Optionally filter by supplier's category when supplierId is provided
    searchVariants: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                supplierId: z.number().int().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const conditions: SQL[] = [eq(productTable.status, "active")];

            if (input.search) {
                conditions.push(
                    sql`${productTable.name} ILIKE ${`%${input.search}%`}`,
                );
            }

            // If supplierId provided, filter products to supplier's category
            let supplierCategoryName: string | null = null;
            if (input.supplierId) {
                const sup = await db.query.supplier.findFirst({
                    where: and(
                        eq(supplier.id, input.supplierId),
                        eq(supplier.addedBy, context.session.user.id),
                    ),
                    with: { category: { columns: { id: true, name: true } } },
                });
                if (sup?.categoryId) {
                    conditions.push(eq(productTable.categoryId, sup.categoryId));
                    supplierCategoryName = sup.category?.name ?? null;
                }
            }

            const results = await db
                .select({
                    variantId: productVariant.id,
                    productId: productTable.id,
                    productName: productTable.name,
                    unitLabel: productVariant.unitLabel,
                    weightKg: productVariant.weightKg,
                    price: productVariant.price,
                    sku: productVariant.sku,
                    packagingType: productVariant.packagingType,
                })
                .from(productVariant)
                .innerJoin(productTable, eq(productVariant.productId, productTable.id))
                .where(and(...conditions))
                .orderBy(productTable.name)
                .limit(50);

            return { variants: results, supplierCategoryName };
        }),
};

const supplierQueries = {
    // Get all suppliers for the current warehouse — enriched with category + purchase totals
    getSuppliers: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                status: z.enum(["all", "active", "suspended"]).default("all"),
                categoryId: z.number().int().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const conditions: SQL[] = [eq(supplier.addedBy, userId)];

            if (input.search) {
                conditions.push(
                    sql`(${supplier.name} ILIKE ${`%${input.search}%`} OR ${supplier.company} ILIKE ${`%${input.search}%`} OR ${supplier.phone} ILIKE ${`%${input.search}%`})`,
                );
            }

            if (input.status !== "all") {
                conditions.push(eq(supplier.status, input.status));
            }

            if (input.categoryId) {
                conditions.push(eq(supplier.categoryId, input.categoryId));
            }

            // Fetch suppliers with category relation
            const suppliers = await db.query.supplier.findMany({
                where: and(...conditions),
                with: {
                    category: { columns: { id: true, name: true, slug: true } },
                },
                orderBy: [desc(supplier.createdAt)],
            });

            // Aggregate total purchase per supplier
            const supplierIds = suppliers.map((s) => s.id);
            const purchaseTotals: Record<number, number> = {};

            if (supplierIds.length > 0) {
                const totals = await db
                    .select({
                        supplierId: purchase.supplierId,
                        totalPurchase: sql<string>`COALESCE(SUM(${purchase.total}::numeric), 0)`,
                    })
                    .from(purchase)
                    .where(
                        and(
                            eq(purchase.warehouseId, userId),
                            inArray(purchase.supplierId, supplierIds),
                        ),
                    )
                    .groupBy(purchase.supplierId);

                for (const t of totals) {
                    purchaseTotals[t.supplierId] = parseFloat(t.totalPurchase) || 0;
                }
            }

            return {
                suppliers: suppliers.map((s) => ({
                    ...s,
                    categoryName: s.category?.name ?? null,
                    totalPurchase: purchaseTotals[s.id] ?? 0,
                })),
            };
        }),

    // Financial KPI summary for all suppliers
    getSupplierStats: warehouseProcedure
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Total payable across all active suppliers
            const allSuppliers = await db.query.supplier.findMany({
                where: eq(supplier.addedBy, userId),
                columns: { id: true, currentPayable: true, status: true, isActive: true },
            });

            const activeCount = allSuppliers.filter((s) => s.status === "active").length;
            const totalPayable = allSuppliers.reduce(
                (sum, s) => sum + parseFloat(s.currentPayable),
                0,
            );

            // Total purchases across all suppliers
            const [purchaseStats] = await db
                .select({
                    totalPurchase: sql<string>`COALESCE(SUM(${purchase.total}::numeric), 0)`,
                })
                .from(purchase)
                .where(eq(purchase.warehouseId, userId));

            const totalPurchase = parseFloat(purchaseStats?.totalPurchase ?? "0");
            const totalPaid = totalPurchase - totalPayable;

            return {
                totalPurchase,
                totalPaid: Math.max(0, totalPaid),
                totalPayable,
                activeCount,
                totalCount: allSuppliers.length,
            };
        }),

    // Detailed view for a single supplier
    getSupplierDetail: warehouseProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Fetch supplier with category
            const sup = await db.query.supplier.findFirst({
                where: and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)),
                with: {
                    category: { columns: { id: true, name: true, slug: true } },
                },
            });

            if (!sup) {
                throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
            }

            // ── Purchase History (all purchases with items count) ──
            const purchases = await db.query.purchase.findMany({
                where: and(
                    eq(purchase.warehouseId, userId),
                    eq(purchase.supplierId, input.id),
                ),
                with: {
                    items: {
                        columns: {
                            productName: true,
                            quantity: true,
                            totalCost: true,
                        },
                    },
                },
                orderBy: [desc(purchase.createdAt)],
            });

            // ── Total Purchase Value ──
            const totalPurchaseValue = purchases.reduce(
                (sum, p) => sum + parseFloat(p.total ?? "0"),
                0,
            );

            // ── Payment History from Ledger ──
            const { financialLedger } = await import("@bikalpo-project/db/schema");
            const payments = await db
                .select({
                    id: financialLedger.id,
                    amount: financialLedger.amount,
                    description: financialLedger.description,
                    createdAt: financialLedger.createdAt,
                })
                .from(financialLedger)
                .where(
                    and(
                        eq(financialLedger.ownerId, userId),
                        eq(financialLedger.referenceType, "supplier_payment"),
                        eq(financialLedger.referenceId, input.id),
                    ),
                )
                .orderBy(desc(financialLedger.createdAt));

            const totalPaid = payments.reduce(
                (sum, p) => sum + parseFloat(p.amount ?? "0"),
                0,
            );

            // Also sum cash purchases as "paid" (only credit purchases create payables)
            const cashPurchaseTotal = purchases
                .filter((p) => p.paymentType === "cash")
                .reduce((sum, p) => sum + parseFloat(p.total ?? "0"), 0);

            // ── Product Supply Breakdown ──
            const productMap = new Map<string, { totalQty: number; totalValue: number }>();
            for (const p of purchases) {
                for (const item of p.items) {
                    const name = item.productName;
                    const existing = productMap.get(name) ?? { totalQty: 0, totalValue: 0 };
                    existing.totalQty += parseFloat(item.quantity ?? "0");
                    existing.totalValue += parseFloat(item.totalCost ?? "0");
                    productMap.set(name, existing);
                }
            }
            const productBreakdown = Array.from(productMap.entries())
                .map(([name, data]) => ({
                    productName: name,
                    totalQty: data.totalQty,
                    totalValue: data.totalValue,
                }))
                .sort((a, b) => b.totalValue - a.totalValue)
                .slice(0, 30);

            // ── Due Alert ──
            const currentPayable = parseFloat(sup.currentPayable ?? "0");

            // Build purchase history rows with paid/due
            const purchaseHistory = purchases.map((p) => {
                const total = parseFloat(p.total ?? "0");
                const isCash = p.paymentType === "cash";
                const paid = isCash ? total : 0;
                const due = isCash ? 0 : total;
                return {
                    id: p.id,
                    purchaseNumber: p.purchaseNumber,
                    purchaseDate: p.purchaseDate,
                    itemCount: p.items.length,
                    total,
                    paid,
                    due,
                    status: p.status,
                    paymentType: p.paymentType,
                    discount: p.discount,
                    transportCost: p.transportCost,
                    note: p.note,
                    createdAt: p.createdAt,
                    items: p.items.map((item) => ({
                        productName: item.productName,
                        quantity: item.quantity,
                        totalCost: item.totalCost,
                    })),
                };
            });

            return {
                supplier: {
                    ...sup,
                    categoryName: sup.category?.name ?? null,
                },
                purchaseHistory,
                productBreakdown,
                payments,
                totalPurchaseValue,
                totalPaid: totalPaid + cashPurchaseTotal,
                currentPayable,
            };
        }),

    // Get all categories for supplier form dropdown
    getSupplierCategories: warehouseProcedure
        .handler(async () => {
            const categories = await db
                .select({ id: category.id, name: category.name, slug: category.slug })
                .from(category)
                .where(eq(category.isActive, true))
                .orderBy(category.name);

            return { categories };
        }),

    // Create a new supplier
    createSupplier: warehouseProcedure
        .input(
            z.object({
                name: z.string().min(1),
                company: z.string().optional(),
                contactPerson: z.string().optional(),
                phone: z.string().optional(),
                email: z.string().email().optional().or(z.literal("")),
                address: z.string().optional(),
                notes: z.string().optional(),
                creditLimit: z.string().optional(),
                returnPackAgreement: z.boolean().optional(),
                categoryId: z.number().int().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [created] = await db
                .insert(supplier)
                .values({
                    name: input.name,
                    company: input.company || null,
                    contactPerson: input.contactPerson || null,
                    phone: input.phone || null,
                    email: input.email || null,
                    address: input.address || null,
                    notes: input.notes || null,
                    creditLimit: input.creditLimit || "0",
                    returnPackAgreement: input.returnPackAgreement ?? false,
                    categoryId: input.categoryId ?? null,
                    addedBy: userId,
                })
                .returning();

            return { supplier: created };
        }),

    // Update a supplier
    updateSupplier: warehouseProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().min(1),
                company: z.string().optional(),
                contactPerson: z.string().optional(),
                phone: z.string().optional(),
                email: z.string().email().optional().or(z.literal("")),
                address: z.string().optional(),
                notes: z.string().optional(),
                creditLimit: z.string().optional(),
                returnPackAgreement: z.boolean().optional(),
                categoryId: z.number().int().optional().nullable(),
                isActive: z.boolean().optional(),
                status: z.enum(["active", "suspended"]).optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Only include fields that were explicitly provided
            const updateData: Record<string, any> = { name: input.name };
            if (input.company !== undefined) updateData.company = input.company || null;
            if (input.contactPerson !== undefined) updateData.contactPerson = input.contactPerson || null;
            if (input.phone !== undefined) updateData.phone = input.phone || null;
            if (input.email !== undefined) updateData.email = input.email || null;
            if (input.address !== undefined) updateData.address = input.address || null;
            if (input.notes !== undefined) updateData.notes = input.notes || null;
            if (input.creditLimit !== undefined) updateData.creditLimit = input.creditLimit;
            if (input.returnPackAgreement !== undefined) updateData.returnPackAgreement = input.returnPackAgreement;
            if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
            if (input.isActive !== undefined) updateData.isActive = input.isActive;
            if (input.status !== undefined) updateData.status = input.status;

            const [updated] = await db
                .update(supplier)
                .set(updateData)
                .where(and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)))
                .returning();

            if (!updated) {
                throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
            }

            return { supplier: updated };
        }),

    // Delete a supplier
    deleteSupplier: warehouseProcedure
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            await db
                .delete(supplier)
                .where(and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)));

            return { success: true };
        }),
};

// ────────────────────────────────────────────────────────────────
// Purchase CRUD + Receive Stock (warehouse role only)
// ────────────────────────────────────────────────────────────────

const purchaseQueries = {
    // List purchases for current warehouse
    getPurchases: warehouseProcedure
        .input(
            z.object({
                status: z.enum(["draft", "received", "partial", "cancelled"]).optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { page, limit, status } = input;
            const offset = (page - 1) * limit;

            const conditions: SQL[] = [eq(purchase.warehouseId, userId)];
            if (status) conditions.push(eq(purchase.status, status));

            const [purchases, countResult] = await Promise.all([
                db.query.purchase.findMany({
                    where: and(...conditions),
                    with: {
                        supplier: true,
                        items: true,
                    },
                    orderBy: [desc(purchase.createdAt)],
                    limit,
                    offset,
                }),
                db
                    .select({ count: count() })
                    .from(purchase)
                    .where(and(...conditions)),
            ]);

            return {
                purchases,
                pagination: {
                    page,
                    limit,
                    totalCount: countResult[0]?.count || 0,
                    totalPages: Math.ceil((countResult[0]?.count || 0) / limit),
                },
            };
        }),

    // Create a new purchase order
    createPurchase: warehouseProcedure
        .input(
            z.object({
                supplierId: z.number(),
                supplierInvoiceNo: z.string().optional(),
                purchaseDate: z.string().optional(),
                transportCost: z.string().optional(),
                paymentType: z.enum(["cash", "credit"]).optional(),
                note: z.string().optional(),
                items: z.array(
                    z.object({
                        variantId: z.number().optional(),
                        productName: z.string(),
                        quantity: z.string(),
                        unitCost: z.string(),
                        batchNo: z.string().optional(),
                        expiryDate: z.string().optional(),
                    }),
                ).min(1),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Verify supplier belongs to this warehouse
            const sup = await db.query.supplier.findFirst({
                where: and(eq(supplier.id, input.supplierId), eq(supplier.addedBy, userId)),
            });
            if (!sup) {
                throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
            }

            // Generate purchase number
            const now = new Date();
            const dateStr = localDateStamp(now);
            const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
            const purchaseNumber = `PO-${dateStr}-${randomSuffix}`;

            // Calculate totals
            let subtotal = 0;
            const itemsToInsert = input.items.map((item) => {
                const qty = parseFloat(item.quantity);
                const cost = parseFloat(item.unitCost);
                const totalCost = qty * cost;
                subtotal += totalCost;
                return {
                    variantId: item.variantId || null,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    totalCost: totalCost.toFixed(2),
                    batchNo: item.batchNo || null,
                    expiryDate: item.expiryDate || null,
                };
            });

            const transportCost = parseFloat(input.transportCost || "0");
            const grandTotal = subtotal + transportCost;

            // Create purchase + items in transaction
            const result = await db.transaction(async (tx) => {
                const [created] = await tx
                    .insert(purchase)
                    .values({
                        purchaseNumber,
                        supplierId: input.supplierId,
                        warehouseId: userId,
                        supplierInvoiceNo: input.supplierInvoiceNo || null,
                        purchaseDate: input.purchaseDate || null,
                        subtotal: subtotal.toFixed(2),
                        transportCost: transportCost.toFixed(2),
                        total: grandTotal.toFixed(2),
                        paymentType: input.paymentType || "cash",
                        note: input.note || null,
                        status: "draft",
                    })
                    .returning();

                if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");

                await tx.insert(purchaseItem).values(
                    itemsToInsert.map((item) => ({
                        ...item,
                        purchaseId: created.id,
                    })),
                );

                return created;
            });

            return { purchase: result };
        }),

    // Receive a purchase — adds stock to inventory + creates ledger entries
    receivePurchase: warehouseProcedure
        .input(z.object({ purchaseId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingPurchase = await db.query.purchase.findFirst({
                where: and(
                    eq(purchase.id, input.purchaseId),
                    eq(purchase.warehouseId, userId),
                ),
                with: { items: true },
            });

            if (!existingPurchase) {
                throw new ORPCError("NOT_FOUND", { message: "Purchase not found" });
            }

            if (existingPurchase.status === "received") {
                throw new ORPCError("CONFLICT", { message: "Purchase already received" });
            }

            if (existingPurchase.status === "cancelled") {
                throw new ORPCError("CONFLICT", { message: "Purchase was cancelled" });
            }

            await db.transaction(async (tx) => {
                // For each item, update inventory and create ledger entry
                for (const item of existingPurchase.items) {
                    const qty = parseFloat(item.quantity);

                    // Only update inventory/ledger for items with a linked product variant
                    if (item.variantId) {
                        // Upsert inventory record
                        const existingInv = await tx.query.inventory.findFirst({
                            where: and(
                                eq(inventory.ownerType, "warehouse"),
                                eq(inventory.ownerId, userId),
                                eq(inventory.variantId, item.variantId),
                            ),
                        });

                        if (existingInv) {
                            const newQty = parseFloat(existingInv.availableQty) + qty;
                            await tx
                                .update(inventory)
                                .set({ availableQty: newQty.toFixed(2) })
                                .where(eq(inventory.id, existingInv.id));
                        } else {
                            await tx.insert(inventory).values({
                                ownerType: "warehouse",
                                ownerId: userId,
                                variantId: item.variantId,
                                availableQty: qty.toFixed(2),
                            });
                        }


                    }

                    // Update received qty on purchase item
                    await tx
                        .update(purchaseItem)
                        .set({ receivedQty: item.quantity })
                        .where(eq(purchaseItem.id, item.id));
                }

                // Mark purchase as received
                await tx
                    .update(purchase)
                    .set({
                        status: "received",
                        receivedAt: new Date(),
                    })
                    .where(eq(purchase.id, existingPurchase.id));

                // If payment type is credit, add to supplier's outstanding payable
                if (existingPurchase.paymentType === "credit") {
                    const sup = await tx.query.supplier.findFirst({
                        where: eq(supplier.id, existingPurchase.supplierId),
                    });
                    if (sup) {
                        const newPayable = parseFloat(sup.currentPayable) + parseFloat(existingPurchase.total);
                        await tx
                            .update(supplier)
                            .set({ currentPayable: newPayable.toFixed(2) })
                            .where(eq(supplier.id, sup.id));
                    }
                }
            });

            return { success: true };
        }),

    // Cancel a purchase
    cancelPurchase: warehouseProcedure
        .input(z.object({ purchaseId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [updated] = await db
                .update(purchase)
                .set({ status: "cancelled" })
                .where(
                    and(
                        eq(purchase.id, input.purchaseId),
                        eq(purchase.warehouseId, userId),
                        eq(purchase.status, "draft"),
                    ),
                )
                .returning();

            if (!updated) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Purchase not found or cannot be cancelled",
                });
            }

            return { success: true };
        }),
};

// ────────────────────────────────────────────────────────────────
// Product Activation (Phase C) — browse assigned categories and
// add products to warehouse inventory
// ────────────────────────────────────────────────────────────────

import {
    warehouseCategoryAssignment,
    category as categoryTable,
} from "@bikalpo-project/db/schema";

const productActivation = {
    /**
     * Get products from the warehouse's admin-assigned categories.
     * Each variant is annotated with { inInventory: boolean }.
     */
    getAssignedProducts: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                categoryId: z.number().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Get assigned category IDs for this warehouse
            const assignments = await db.query.warehouseCategoryAssignment.findMany({
                where: eq(warehouseCategoryAssignment.warehouseId, userId),
                columns: { categoryId: true },
            });

            const assignedCategoryIds = [...new Set(assignments.map((a) => a.categoryId))];
            if (assignedCategoryIds.length === 0) {
                return { products: [], assignedCategories: [] };
            }

            // 2. Get assigned categories with names
            const assignedCategories = await db
                .select({ id: categoryTable.id, name: categoryTable.name })
                .from(categoryTable)
                .where(inArray(categoryTable.id, assignedCategoryIds));

            // 3. Filter by categoryId if provided
            const catFilter = input.categoryId
                ? [input.categoryId]
                : assignedCategoryIds;

            // 4. Get products from those categories with variants
            const products = await db.query.product.findMany({
                where: and(
                    inArray(productTable.categoryId, catFilter),
                    eq(productTable.status, "active"),
                    input.search
                        ? sql`${productTable.name} ILIKE ${`%${input.search}%`}`
                        : undefined,
                ),
                with: {
                    category: { columns: { name: true } },
                    subCategory: { columns: { name: true } },
                    images: { limit: 1 },
                    variants: {
                        where: eq(productVariant.isActive, true),
                        columns: {
                            id: true,
                            sku: true,
                            unitLabel: true,
                            weightKg: true,
                            price: true,
                            packagingType: true,
                            packType: true,
                            innerPackSizeKg: true,
                            packCountInside: true,
                            brandId: true,
                        },
                        with: {
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
                orderBy: [productTable.name],
            });

            // 5. Check which variants are already in this warehouse's inventory
            const existingInventory = await db
                .select({ variantId: inventory.variantId })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, userId),
                    ),
                );

            const inventoryVariantIds = new Set(existingInventory.map((i) => i.variantId));

            // 6. Annotate each variant with inInventory flag
            const annotatedProducts = products.map((p) => ({
                ...p,
                variants: p.variants.map((v) => ({
                    ...v,
                    inInventory: inventoryVariantIds.has(v.id),
                })),
            }));

            return {
                products: annotatedProducts,
                assignedCategories,
            };
        }),

    /**
     * Add a product variant to the warehouse's inventory.
     */
    addToInventory: warehouseProcedure
        .input(
            z.object({
                variantId: z.number(),
                retailPrice: z.string().min(1),
                initialStock: z.string().default("0"),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Check if already in inventory
            const existing = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                    eq(inventory.variantId, input.variantId),
                ),
            });

            if (existing) {
                throw new ORPCError("CONFLICT", {
                    message: "This variant is already in your inventory",
                });
            }

            // Verify the variant exists and belongs to an assigned category
            const variant = await db.query.productVariant.findFirst({
                where: eq(productVariant.id, input.variantId),
                with: {
                    product: { columns: { categoryId: true } },
                },
            });

            if (!variant) {
                throw new ORPCError("NOT_FOUND", { message: "Variant not found" });
            }

            // Check category assignment
            const assignment = await db.query.warehouseCategoryAssignment.findFirst({
                where: and(
                    eq(warehouseCategoryAssignment.warehouseId, userId),
                    eq(warehouseCategoryAssignment.categoryId, variant.product.categoryId),
                ),
            });

            if (!assignment) {
                throw new ORPCError("FORBIDDEN", {
                    message: "Your warehouse is not assigned to this product's category",
                });
            }

            const [created] = await db
                .insert(inventory)
                .values({
                    ownerType: "warehouse",
                    ownerId: userId,
                    variantId: input.variantId,
                    availableQty: input.initialStock,
                    retailPrice: input.retailPrice,
                })
                .returning();



            return { inventory: created };
        }),

    /**
     * Update an existing inventory item (price, quantity).
     */
    updateInventoryItem: warehouseProcedure
        .input(
            z.object({
                inventoryId: z.number(),
                retailPrice: z.string().optional(),
                availableQty: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existing = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.id, input.inventoryId),
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                ),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Inventory item not found" });
            }

            const updateData: Record<string, any> = {};
            if (input.retailPrice !== undefined) updateData.retailPrice = input.retailPrice;
            if (input.availableQty !== undefined) updateData.availableQty = input.availableQty;

            const [updated] = await db
                .update(inventory)
                .set(updateData)
                .where(eq(inventory.id, input.inventoryId))
                .returning();



            return { inventory: updated };
        }),

    /**
     * Remove a product variant from warehouse inventory.
     */
    removeFromInventory: warehouseProcedure
        .input(z.object({ inventoryId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [deleted] = await db
                .delete(inventory)
                .where(
                    and(
                        eq(inventory.id, input.inventoryId),
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, userId),
                    ),
                )
                .returning();

            if (!deleted) {
                throw new ORPCError("NOT_FOUND", { message: "Inventory item not found" });
            }

            return { success: true };
        }),
};

// ────────────────────────────────────────────────────────────────
// Catalog Hierarchy Browse (Phase C+) — Type→Category→SubCat→Core
// ────────────────────────────────────────────────────────────────

import {
    coreProductIdentity,
} from "@bikalpo-project/db/schema";

const catalogBrowse = {
    /**
     * Get the FULL system catalog: Type → Category → SubCategory → Core Products.
     * Shows ALL core products (not filtered by warehouse assignments).
     * Annotates each variant with whether it's in the warehouse's inventory.
     */
    getFullCatalog: warehouseProcedure
        .input(
            z.object({
                typeId: z.number().optional(),
                categoryId: z.number().optional(),
                subCategoryId: z.number().optional(),
                search: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Build core product conditions
            const coreConditions: SQL[] = [];
            if (input.categoryId) {
                coreConditions.push(eq(coreProductIdentity.categoryId, input.categoryId));
            }
            if (input.subCategoryId) {
                coreConditions.push(eq(coreProductIdentity.subCategoryId, input.subCategoryId));
            }
            if (input.search?.trim()) {
                coreConditions.push(
                    sql`${coreProductIdentity.name} ILIKE ${`%${input.search.trim()}%`}`,
                );
            }

            // 2. Fetch all core products with category/type hierarchy
            const coreProducts = await db.query.coreProductIdentity.findMany({
                where: coreConditions.length > 0 ? and(...coreConditions) : undefined,
                orderBy: [coreProductIdentity.name],
                with: {
                    category: {
                        columns: { id: true, name: true, slug: true, typeId: true },
                        with: {
                            type: { columns: { id: true, name: true, slug: true } },
                            subCategory: {
                                columns: { id: true, name: true, slug: true },
                            },
                        },
                    },
                    subCategory: {
                        columns: { id: true, name: true, slug: true },
                    },
                },
            });

            // 3. Filter by typeId if provided (post-query since type is nested)
            const filteredCoreProducts = input.typeId
                ? coreProducts.filter((cp) => cp.category?.typeId === input.typeId)
                : coreProducts;

            // 4. Get all linked products for these core identities
            const coreProductIds = filteredCoreProducts.map((cp) => cp.id);
            let linkedProducts: any[] = [];
            if (coreProductIds.length > 0) {
                linkedProducts = await db.query.product.findMany({
                    where: and(
                        inArray(productTable.coreProductId, coreProductIds),
                        eq(productTable.status, "active"),
                    ),
                    columns: {
                        id: true,
                        name: true,
                        coreProductId: true,
                        brandId: true,
                    },
                    with: {
                        brand: { columns: { id: true, name: true } },
                        variants: {
                            where: eq(productVariant.isActive, true),
                            columns: {
                                id: true,
                                sku: true,
                                unitLabel: true,
                                weightKg: true,
                                price: true,
                                brandId: true,
                            },
                            with: {
                                brand: { columns: { id: true, name: true } },
                            },
                        },
                    },
                });
            }

            // 5. Get warehouse's current inventory variant IDs
            const existingInventory = await db
                .select({ variantId: inventory.variantId })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, userId),
                    ),
                );
            const inventoryVariantIds = new Set(existingInventory.map((i) => i.variantId));

            // 6. Build Type → Category → SubCategory → CoreProduct hierarchy
            const typeMap = new Map<number, any>();

            for (const cp of filteredCoreProducts) {
                const cat = cp.category;
                if (!cat) continue;
                const typeData = cat.type || { id: 0, name: "Uncategorized", slug: "uncategorized" };
                const typeId = (typeData as any).id || 0;

                if (!typeMap.has(typeId)) {
                    typeMap.set(typeId, {
                        ...typeData,
                        categories: new Map<number, any>(),
                    });
                }

                const typeEntry = typeMap.get(typeId);
                if (!typeEntry.categories.has(cat.id)) {
                    typeEntry.categories.set(cat.id, {
                        id: cat.id,
                        name: cat.name,
                        slug: cat.slug,
                        subCategories: new Map<number, any>(),
                        directCoreProducts: [],
                    });
                }

                const catEntry = typeEntry.categories.get(cat.id);

                // Build core product data with products/variants
                const cpProducts = linkedProducts.filter(
                    (p: any) => p.coreProductId === cp.id,
                );
                const coreProductData = {
                    id: cp.id,
                    name: cp.name,
                    slug: cp.slug,
                    image: cp.image,
                    products: cpProducts.map((p: any) => ({
                        ...p,
                        variants: p.variants.map((v: any) => ({
                            ...v,
                            inInventory: inventoryVariantIds.has(v.id),
                            brand: v.brand || p.brand || null,
                            brandId: v.brandId || p.brandId || null,
                        })),
                    })),
                };

                if (cp.subCategoryId && cp.subCategory) {
                    const sc = cp.subCategory;
                    if (!catEntry.subCategories.has(sc.id)) {
                        catEntry.subCategories.set(sc.id, {
                            id: sc.id,
                            name: sc.name,
                            slug: sc.slug,
                            coreProducts: [],
                        });
                    }
                    catEntry.subCategories.get(sc.id).coreProducts.push(coreProductData);
                } else {
                    catEntry.directCoreProducts.push(coreProductData);
                }
            }

            // 7. Convert Maps to arrays for response
            const types = Array.from(typeMap.values()).map((t) => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                categories: Array.from(t.categories.values()).map((c: any) => ({
                    ...c,
                    subCategories: Array.from(c.subCategories.values()),
                })),
            }));

            return { types };
        }),

    /**
     * Get hierarchical catalog: Type → Category → SubCategory → Core Products.
     * Filters by warehouse's assigned categories.
     */
    getCatalogHierarchy: warehouseProcedure
        .input(
            z.object({
                typeId: z.number().optional(),
                categoryId: z.number().optional(),
                subCategoryId: z.number().optional(),
                search: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Get assigned category IDs
            const assignments = await db.query.warehouseCategoryAssignment.findMany({
                where: eq(warehouseCategoryAssignment.warehouseId, userId),
                columns: { categoryId: true },
            });

            const assignedCategoryIds = [...new Set(assignments.map((a) => a.categoryId))];
            if (assignedCategoryIds.length === 0) {
                return { types: [] };
            }

            // 2. Get categories with type info
            const categories = await db.query.category.findMany({
                where: inArray(categoryTable.id, assignedCategoryIds),
                with: {
                    type: true,
                    subCategory: {
                        where: input.subCategoryId
                            ? eq(sql`id`, input.subCategoryId)
                            : undefined,
                    },
                },
            });

            // 3. Filter by typeId if provided
            const filteredCats = input.typeId
                ? categories.filter((c) => c.typeId === input.typeId)
                : categories;

            // 4. Filter by categoryId if provided
            const finalCats = input.categoryId
                ? filteredCats.filter((c) => c.id === input.categoryId)
                : filteredCats;

            // 5. Get all subcategory IDs from filtered categories
            // (allSubCatIds used implicitly via coreProducts query on categoryId)

            // Also get category IDs for core products without subcategory
            const allCatIds = finalCats.map((c) => c.id);

            // 6. Get core product identities in these categories/subcats
            const searchCondition = input.search
                ? sql`${coreProductIdentity.name} ILIKE ${`%${input.search}%`}`
                : undefined;

            const coreProducts = await db.query.coreProductIdentity.findMany({
                where: and(
                    inArray(coreProductIdentity.categoryId, allCatIds),
                    searchCondition,
                ),
                with: {},
                orderBy: [coreProductIdentity.name],
            });

            // 7. Get existing products linked to these core identities
            const coreProductIds = coreProducts.map((cp) => cp.id);
            let linkedProducts: any[] = [];
            if (coreProductIds.length > 0) {
                linkedProducts = await db.query.product.findMany({
                    where: and(
                        inArray(productTable.coreProductId, coreProductIds),
                        eq(productTable.status, "active"),
                    ),
                    columns: {
                        id: true,
                        name: true,
                        coreProductId: true,
                        brandId: true,
                    },
                    with: {
                        brand: { columns: { id: true, name: true } },
                        variants: {
                            where: eq(productVariant.isActive, true),
                            columns: {
                                id: true,
                                sku: true,
                                unitLabel: true,
                                weightKg: true,
                                price: true,
                                brandId: true,
                            },
                            with: {
                                brand: { columns: { id: true, name: true } },
                            },
                        },
                    },
                });
            }

            // 8. Get warehouse's current inventory variant IDs
            const existingInventory = await db
                .select({ variantId: inventory.variantId })
                .from(inventory)
                .where(
                    and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, userId),
                    ),
                );
            const inventoryVariantIds = new Set(existingInventory.map((i) => i.variantId));

            // 9. Build hierarchy response
            const typeMap = new Map<number, any>();

            for (const cat of finalCats) {
                const typeData = cat.type || { id: 0, name: "Uncategorized", slug: "uncategorized" };
                const typeId = (typeData as any).id || 0;

                if (!typeMap.has(typeId)) {
                    typeMap.set(typeId, {
                        ...typeData,
                        categories: [],
                    });
                }

                const subCats = (cat.subCategory || []).map((sc: any) => {
                    const subCatCoreProducts = coreProducts
                        .filter((cp) => cp.subCategoryId === sc.id)
                        .map((cp) => {
                            const cpProducts = linkedProducts.filter(
                                (p) => p.coreProductId === cp.id,
                            );
                            return {
                                ...cp,
                                products: cpProducts.map((p: any) => ({
                                    ...p,
                                    variants: p.variants.map((v: any) => ({
                                        ...v,
                                        inInventory: inventoryVariantIds.has(v.id),
                                        // Fall back to product-level brand if variant has no brand
                                        brand: v.brand || p.brand || null,
                                        brandId: v.brandId || p.brandId || null,
                                    })),
                                })),
                            };
                        });

                    return {
                        ...sc,
                        coreProducts: subCatCoreProducts,
                    };
                });

                // Also get core products directly under category (no subcategory)
                const directCoreProducts = coreProducts
                    .filter((cp) => cp.categoryId === cat.id && !cp.subCategoryId)
                    .map((cp) => {
                        const cpProducts = linkedProducts.filter(
                            (p) => p.coreProductId === cp.id,
                        );
                        return {
                            ...cp,
                            products: cpProducts.map((p: any) => ({
                                ...p,
                                variants: p.variants.map((v: any) => ({
                                    ...v,
                                    inInventory: inventoryVariantIds.has(v.id),
                                    // Fall back to product-level brand if variant has no brand
                                    brand: v.brand || p.brand || null,
                                    brandId: v.brandId || p.brandId || null,
                                })),
                            })),
                        };
                    });

                typeMap.get(typeId).categories.push({
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                    subCategories: subCats,
                    directCoreProducts,
                });
            }

            return { types: Array.from(typeMap.values()) };
        }),
};

// ────────────────────────────────────────────────────────────────
// Product Identity Requests
// ────────────────────────────────────────────────────────────────

import { productIdentityRequest } from "@bikalpo-project/db/schema";

const productRequests = {
    /** Submit a product identity request */
    submitProductRequest: warehouseProcedure
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

            return { request: created };
        }),

    /** Get my product requests */
    getMyProductRequests: warehouseProcedure
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
// Warehouse Product Creation (warehouse creates its own products)
// ────────────────────────────────────────────────────────────────

import {
    brand as brandTable,
    productBrand,
    productVariantPrice,
    productImage,
    variantOption,
} from "@bikalpo-project/db/schema";

const warehouseProductCreation = {
    /**
     * Get all active brands and variant options for the product creation form.
     */
    getBrandsAndVariants: warehouseProcedure
        .input(
            z.object({
                typeId: z.number().optional(),
                categoryId: z.number().optional(),
            }),
        )
        .handler(async ({ input }) => {
            // Fetch all active brands
            const brands = await db.query.brand.findMany({
                orderBy: [brandTable.name],
            });

            // Fetch variant options, optionally filtered by scope
            const voConditions: SQL[] = [eq(variantOption.isActive, true)];

            const allVariantOptions = await db.query.variantOption.findMany({
                where: and(...voConditions),
                orderBy: [variantOption.sortOrder, variantOption.name],
            });

            // Filter by scope: show global + type-wide + category-specific
            const filtered = allVariantOptions.filter((vo) => {
                // Global variant (no type, no category) → always show
                if (!vo.typeId && !vo.categoryId) return true;
                // Type-scoped variant → show if matches requested type
                if (vo.typeId && !vo.categoryId) {
                    return !input.typeId || vo.typeId === input.typeId;
                }
                // Category-scoped variant → show if matches requested category
                if (vo.typeId && vo.categoryId) {
                    const typeMatch = !input.typeId || vo.typeId === input.typeId;
                    const catMatch = !input.categoryId || vo.categoryId === input.categoryId;
                    return typeMatch && catMatch;
                }
                return true;
            });

            return { brands, variantOptions: filtered };
        }),

    /**
     * Create a product from a core identity template, owned by this warehouse.
     * Creates product → productBrand → productVariantPrice → productVariant → inventory rows.
     */
    createWarehouseProduct: warehouseProcedure
        .input(
            z.object({
                coreProductId: z.number().int(),
                name: z.string().min(1),
                slug: z.string().min(1),
                shortDescription: z.string().optional().nullable(),
                description: z.string().optional().nullable(),
                image: z.string().min(1),
                categoryId: z.number().int(),
                subCategoryId: z.number().int().optional().nullable(),
                // Brand + variant configs
                brandConfigs: z.array(
                    z.object({
                        brandId: z.number().int(),
                        variants: z.array(
                            z.object({
                                variantOptionId: z.number().int(),
                                retailerPrice: z.string().default("0"),
                            }),
                        ),
                    }),
                ),
                // Supply rules
                trackingType: z.enum(["none", "batch", "serial"]).default("none"),
                expiryEnabled: z.boolean().default(false),
                damageControlEnabled: z.boolean().default(false),
                isReturnablePack: z.boolean().default(false),
                // Delivery
                deliveryCostPerCarton: z.string().optional().nullable(),
                // Visibility
                status: z.enum(["active", "inactive", "draft"]).default("active"),
                visibility: z.enum(["public", "private"]).default("public"),
                // Media
                additionalImages: z.array(z.string()).optional(),
                videoUrl: z.string().optional().nullable(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Verify core product exists
            const coreProduct = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, input.coreProductId),
            });

            if (!coreProduct) {
                throw new ORPCError("NOT_FOUND", { message: "Core product identity not found" });
            }

            // Ensure slug uniqueness (append warehouse suffix if collision)
            let finalSlug = input.slug;
            const existingSlug = await db.query.product.findFirst({
                where: eq(productTable.slug, finalSlug),
                columns: { id: true },
            });
            if (existingSlug) {
                finalSlug = `${input.slug}-wh-${Date.now()}`;
            }

            const result = await db.transaction(async (tx) => {
                // 1. Create product row
                const [newProduct] = await tx
                    .insert(productTable)
                    .values({
                        name: input.name,
                        slug: finalSlug,
                        description: input.description || null,
                        shortDescription: input.shortDescription || null,
                        videoUrl: input.videoUrl || null,
                        categoryId: input.categoryId,
                        subCategoryId: input.subCategoryId || null,
                        coreProductId: input.coreProductId,
                        brandId: input.brandConfigs.length > 0 ? input.brandConfigs[0]!.brandId : null,
                        image: input.image,
                        size: "—",
                        price: "0",
                        sku: `WH-${userId.substring(0, 6)}-${Date.now()}`,
                        trackingType: input.trackingType,
                        expiryEnabled: input.expiryEnabled,
                        damageControlEnabled: input.damageControlEnabled,
                        isReturnablePack: input.isReturnablePack,
                        visibility: input.visibility,
                        status: input.status,
                        createdByWarehouseId: userId,
                    })
                    .returning();

                const productId = newProduct!.id;

                // 2. Insert additional images
                if (input.additionalImages && input.additionalImages.length > 0) {
                    await tx.insert(productImage).values(
                        input.additionalImages.map((imageUrl) => ({
                            productId,
                            imageUrl,
                        })),
                    );
                }

                // 3. Insert brand links + variant prices + auto-generate variants + inventory
                const allBrandIds = input.brandConfigs.map((bc) => bc.brandId);

                if (allBrandIds.length > 0) {
                    await tx.insert(productBrand).values(
                        allBrandIds.map((bId) => ({
                            productId,
                            brandId: bId,
                        })),
                    );
                }

                // Fetch variant option metadata
                const allVoIds = [
                    ...new Set(
                        input.brandConfigs.flatMap((bc) =>
                            bc.variants.map((v) => v.variantOptionId),
                        ),
                    ),
                ];

                let voMap: Record<number, any> = {};
                if (allVoIds.length > 0) {
                    const variantOptions = await tx
                        .select()
                        .from(variantOption)
                        .where(inArray(variantOption.id, allVoIds));
                    voMap = Object.fromEntries(variantOptions.map((vo) => [vo.id, vo]));
                }

                // Validate: each brand can have at most one loose variant
                for (const bc of input.brandConfigs) {
                    const looseCount = bc.variants.filter(
                        (v) => voMap[v.variantOptionId]?.variantType === "loose"
                    ).length;
                    if (looseCount > 1) {
                        throw new ORPCError("BAD_REQUEST", {
                            message: `Brand ID ${bc.brandId} has ${looseCount} loose variants. Only one loose variant is allowed per brand.`,
                        });
                    }
                }

                let sortIdx = 0;
                for (const bc of input.brandConfigs) {
                    for (const v of bc.variants) {
                        const vo = voMap[v.variantOptionId];
                        const isLoose = vo?.variantType === "loose";
                        const packType = isLoose ? "loose" : "packet";
                        const weightKg = vo?.size || "0";

                        // Insert variant price row
                        const [insertedPrice] = await tx
                            .insert(productVariantPrice)
                            .values({
                                productId,
                                variantOptionId: v.variantOptionId,
                                brandId: bc.brandId,
                                consumerPrice: v.retailerPrice,
                                sortOrder: sortIdx,
                            })
                            .returning();

                        // Auto-generate product_variant row
                        const [insertedVariant] = await tx
                            .insert(productVariant)
                            .values({
                                productId,
                                brandId: bc.brandId,
                                sku: `WH-${productId}-B${bc.brandId}-VO${v.variantOptionId}`,
                                unitLabel: vo?.name || "Unit",
                                quantitySelectorLabel: vo?.name || "Unit",
                                packagingType: packType,
                                weightKg,
                                price: v.retailerPrice,
                                orderUnit: vo?.unit || "piece",
                                packType: (packType as any) || null,
                                packWeightKg: weightKg || null,
                                sellUnit: vo?.name || null,
                                sourceVariantPriceId: insertedPrice!.id,
                                sourceVariantOptionId: v.variantOptionId,
                                stockQuantity: 0,
                                reorderLevel: 0,
                                sortOrder: sortIdx,
                                isActive: true,
                            })
                            .returning();

                        // Auto-create inventory row (qty=0, ready to stock)
                        await tx.insert(inventory).values({
                            ownerType: "warehouse",
                            ownerId: userId,
                            variantId: insertedVariant!.id,
                            availableQty: "0",
                            retailPrice: v.retailerPrice,
                        });

                        sortIdx++;
                    }
                }

                return newProduct!;
            });

            return { product: result };
        }),

    /**
     * List products created by this warehouse.
     */
    getWarehouseProducts: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const offset = (input.page - 1) * input.limit;

            const conditions: SQL[] = [
                eq(productTable.createdByWarehouseId, userId),
            ];

            if (input.search?.trim()) {
                conditions.push(
                    sql`${productTable.name} ILIKE ${`%${input.search.trim()}%`}`,
                );
            }

            const products = await db.query.product.findMany({
                where: and(...conditions),
                orderBy: [desc(productTable.createdAt)],
                offset,
                limit: input.limit,
                with: {
                    category: { columns: { name: true, slug: true } },
                    subCategory: { columns: { name: true } },
                    brand: { columns: { id: true, name: true } },
                    coreProduct: { columns: { id: true, name: true, image: true } },
                    productBrands: {
                        with: { brand: { columns: { id: true, name: true } } },
                    },
                    variants: {
                        where: eq(productVariant.isActive, true),
                        columns: {
                            id: true,
                            unitLabel: true,
                            weightKg: true,
                            price: true,
                            brandId: true,
                        },
                        with: { brand: { columns: { id: true, name: true } } },
                    },
                },
            });

            const [countResult] = await db
                .select({ count: count() })
                .from(productTable)
                .where(and(...conditions));

            return {
                products,
                pagination: {
                    page: input.page,
                    limit: input.limit,
                    totalCount: Number(countResult?.count || 0),
                    totalPages: Math.ceil(Number(countResult?.count || 0) / input.limit),
                },
            };
        }),

    /**
     * Activate or deactivate a product owned by this warehouse.
     */
    updateWarehouseProductStatus: warehouseProcedure
        .input(
            z.object({
                productId: z.number().int(),
                status: z.enum(["active", "inactive"]),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existing = await db.query.product.findFirst({
                where: and(
                    eq(productTable.id, input.productId),
                    eq(productTable.createdByWarehouseId, userId),
                ),
                columns: { id: true },
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Product not found" });
            }

            const [updated] = await db
                .update(productTable)
                .set({ status: input.status })
                .where(eq(productTable.id, input.productId))
                .returning({ id: productTable.id, status: productTable.status });

            return { product: updated };
        }),

    /**
     * Get a single core product identity by ID (for the add product form).
     */
    getCoreProductById: warehouseProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input }) => {
            const cp = await db.query.coreProductIdentity.findFirst({
                where: eq(coreProductIdentity.id, input.id),
                with: {
                    category: {
                        columns: { id: true, name: true, slug: true, typeId: true },
                        with: {
                            type: { columns: { id: true, name: true } },
                        },
                    },
                    subCategory: {
                        columns: { id: true, name: true, slug: true },
                    },
                },
            });

            if (!cp) {
                throw new ORPCError("NOT_FOUND", { message: "Core product identity not found" });
            }

            return { coreProduct: cp };
        }),
};

// ────────────────────────────────────────────────────────────────
// Stock Entry (Add Stock) + Storage Areas
// ────────────────────────────────────────────────────────────────

import { stockEntry, warehouseStorageArea, cartonConfig, carton } from "@bikalpo-project/db/schema";

const stockEntryQueries = {
    /**
     * Search warehouse's own products with variants (for the Add Stock product picker).
     */
    getWarehouseProductsForStock: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                categoryId: z.number().int().optional(),
                subCategoryId: z.number().int().optional(),
                productId: z.number().int().optional(),
                limit: z.number().default(50),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const conditions: SQL[] = [
                eq(productTable.createdByWarehouseId, userId),
                eq(productTable.status, "active"),
            ];

            if (input.search?.trim()) {
                conditions.push(
                    sql`${productTable.name} ILIKE ${`%${input.search.trim()}%`}`,
                );
            }

            if (input.categoryId) {
                conditions.push(eq(productTable.categoryId, input.categoryId));
            }

            if (input.subCategoryId) {
                conditions.push(eq(productTable.subCategoryId, input.subCategoryId));
            }

            if (input.productId) {
                conditions.push(eq(productTable.id, input.productId));
            }

            const products = await db.query.product.findMany({
                where: and(...conditions),
                limit: input.limit,
                orderBy: [desc(productTable.createdAt)],
                columns: {
                    id: true,
                    name: true,
                    image: true,
                    trackingType: true,
                    expiryEnabled: true,
                    categoryId: true,
                    subCategoryId: true,
                },
                with: {
                    brand: { columns: { id: true, name: true } },
                    category: {
                        columns: { id: true, name: true, typeId: true },
                        with: {
                            type: { columns: { id: true, name: true } },
                        },
                    },
                    subCategory: { columns: { id: true, name: true } },
                    coreProduct: {
                        columns: {
                            id: true,
                            name: true,
                            image: true,
                            supportsPack: true,
                            supportsLoose: true,
                        },
                    },
                    variants: {
                        where: eq(productVariant.isActive, true),
                        columns: {
                            id: true,
                            sku: true,
                            unitLabel: true,
                            weightKg: true,
                            price: true,
                            brandId: true,
                            packType: true,
                        },
                        with: {
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                },
            });

            // Attach available stock for each variant
            const allVariantIds = products.flatMap((p) => p.variants.map((v) => v.id));
            const inventoryRows = allVariantIds.length > 0
                ? await db.query.inventory.findMany({
                    where: and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, userId),
                        inArray(inventory.variantId, allVariantIds),
                    ),
                    columns: {
                        variantId: true,
                        availableQty: true,
                        inCartonQty: true,
                    },
                })
                : [];

            const stockMap = new Map(
                inventoryRows.map((inv) => [
                    inv.variantId,
                    {
                        availableQty: parseFloat(inv.availableQty),
                        inCartonQty: parseFloat(inv.inCartonQty),
                        looseStock: parseFloat(inv.availableQty) - parseFloat(inv.inCartonQty),
                    },
                ]),
            );

            const productsWithStock = products.map((p) => ({
                ...p,
                variants: p.variants.map((v) => ({
                    ...v,
                    stock: stockMap.get(v.id) ?? { availableQty: 0, inCartonQty: 0, looseStock: 0 },
                })),
            }));

            return { products: productsWithStock };
        }),

    /**
     * Add a stock entry — creates audit row + upserts inventory.
     */
    addStockEntry: warehouseProcedure
        .input(
            z.object({
                variantId: z.number().int(),
                entryType: z.enum(["loose", "pack", "carton"]),
                quantity: z.string().refine((v) => parseFloat(v) > 0, {
                    message: "Quantity must be greater than 0",
                }),
                quantityUnit: z.string().min(1),
                supplierId: z.number().int().optional().nullable(),
                costType: z.enum(["per_kg", "per_pack", "per_carton"]),
                purchasePrice: z.string().refine((v) => parseFloat(v) > 0, {
                    message: "Purchase price must be greater than 0",
                }),
                reference: z.string().optional(),
                batchNo: z.string().optional(),
                expiryDate: z.string().optional(),
                manufactureDate: z.string().optional(),
                storageAreaId: z.number().int().optional(),
                shelfRack: z.string().optional(),
                note: z.string().optional(),
                // Carton-specific fields (legacy cartonConfigId still accepted but optional)
                cartonConfigId: z.number().int().optional(),
                cartonCount: z.number().int().optional(),
                // NEW: Inline carton definition (replaces cartonConfig)
                packsPerCarton: z.number().int().optional(),
                kgPerCarton: z.number().optional(),
                cartonSource: z.enum(["packs", "loose"]).optional(),
                // Whether to create physical carton records during stock entry
                createCartonRecords: z.boolean().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const qty = parseFloat(input.quantity);
            const price = parseFloat(input.purchasePrice);

            // 1. Validate variant belongs to this warehouse's product
            const variant = await db.query.productVariant.findFirst({
                where: eq(productVariant.id, input.variantId),
                with: {
                    product: {
                        columns: { id: true, createdByWarehouseId: true },
                    },
                },
            });

            if (!variant) {
                throw new ORPCError("NOT_FOUND", { message: "Variant not found" });
            }
            if ((variant.product as any)?.createdByWarehouseId !== userId) {
                throw new ORPCError("FORBIDDEN", {
                    message: "This variant does not belong to your warehouse",
                });
            }

            // 2. Validate supplier belongs to this warehouse (only if provided)
            if (input.supplierId) {
                const sup = await db.query.supplier.findFirst({
                    where: and(
                        eq(supplier.id, input.supplierId),
                        eq(supplier.addedBy, userId),
                    ),
                    columns: { id: true },
                });
                if (!sup) {
                    throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
                }
            }

            // 3. Compute auto-conversions
            const packWeightKg = parseFloat(variant.weightKg);
            let convertedQtyKg: number;
            let convertedQtyPacks: number;
            const cartonCount = input.entryType === "carton"
                ? (input.cartonCount ?? Math.floor(qty))
                : 0;
            let packsPerCartonForEntry: number | null = null;

            if (input.entryType === "loose") {
                // Entered in KG — stored directly in KG
                convertedQtyKg = qty;
                convertedQtyPacks = packWeightKg > 0 ? qty / packWeightKg : 0;
            } else if (input.entryType === "carton") {
                const variantPackType = variant.packType || variant.packagingType;
                if (
                    variantPackType === "loose"
                    || input.cartonSource === "loose"
                    || input.kgPerCarton !== undefined
                ) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Carton stock entry must use packed variants, not loose stock",
                    });
                }

                if (cartonCount <= 0) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Carton entry requires at least one carton",
                    });
                }

                if (input.packsPerCarton) {
                    // Carton from packs: user defined packs per carton
                    packsPerCartonForEntry = input.packsPerCarton;
                    convertedQtyPacks = cartonCount * input.packsPerCarton;
                    convertedQtyKg = convertedQtyPacks * packWeightKg;
                } else if (input.cartonConfigId) {
                    // Legacy: use cartonConfig if provided
                    const config = await db.query.cartonConfig.findFirst({
                        where: and(
                            eq(cartonConfig.id, input.cartonConfigId),
                            eq(cartonConfig.variantId, input.variantId),
                        ),
                    });
                    if (!config) {
                        throw new ORPCError("NOT_FOUND", {
                            message: "Carton config not found for this variant",
                        });
                    }
                    packsPerCartonForEntry = config.packsPerCarton;
                    convertedQtyPacks = cartonCount * config.packsPerCarton;
                    convertedQtyKg = convertedQtyPacks * packWeightKg;
                } else {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Carton entry requires packsPerCarton or cartonConfigId",
                    });
                }
            } else {
                // Entered in packs → convert to KG
                convertedQtyPacks = qty;
                convertedQtyKg = qty * packWeightKg;
            }

            // 4. Compute total cost
            let totalCost: number;
            if (input.costType === "per_kg" || (input.entryType === "loose" && input.costType === "per_pack")) {
                totalCost = price * convertedQtyKg;
            } else if (input.costType === "per_carton") {
                totalCost = price * cartonCount;
            } else {
                totalCost = price * convertedQtyPacks;
            }

            // 5. Transaction: insert stock_entry + upsert inventory + optionally create carton records
            const result = await db.transaction(async (tx) => {
                // Insert stock entry
                const [entry] = await tx
                    .insert(stockEntry)
                    .values({
                        warehouseId: userId,
                        variantId: input.variantId,
                        entryType: input.entryType,
                        quantity: qty.toFixed(2),
                        quantityUnit: input.quantityUnit,
                        convertedQtyKg: convertedQtyKg.toFixed(2),
                        convertedQtyPacks: convertedQtyPacks.toFixed(2),
                        supplierId: input.supplierId || null,
                        costType: input.costType,
                        purchasePrice: price.toFixed(2),
                        totalCost: totalCost.toFixed(2),
                        reference: input.reference || null,
                        batchNo: input.batchNo || null,
                        expiryDate: input.expiryDate || null,
                        manufactureDate: input.manufactureDate || null,
                        storageAreaId: input.storageAreaId || null,
                        shelfRack: input.shelfRack || null,
                        note: input.note || null,
                        // Carton fields
                        cartonCount: input.entryType === "carton" ? cartonCount : null,
                        cartonConfigId: input.cartonConfigId || null,
                        convertedQtyCartons: input.entryType === "carton" ? String(cartonCount) : null,
                    })
                    .returning();

                // Upsert inventory — add to available quantity
                const inventoryQty = input.entryType === "loose" ? convertedQtyKg : convertedQtyPacks;
                const shouldCreateStockInCartons =
                    input.entryType === "carton"
                    && input.createCartonRecords
                    && cartonCount > 0;
                const packsPerSingleCarton = packsPerCartonForEntry || 1;
                const weightPerCarton = packsPerSingleCarton * packWeightKg;
                const stockInCartonUnits = shouldCreateStockInCartons
                    ? cartonCount * packsPerSingleCarton
                    : 0;
                const existingInv = await tx.query.inventory.findFirst({
                    where: and(
                        eq(inventory.ownerType, "warehouse"),
                        eq(inventory.ownerId, userId),
                        eq(inventory.variantId, input.variantId),
                    ),
                });

                if (existingInv) {
                    const newQty =
                        parseFloat(existingInv.availableQty) + inventoryQty;
                    const currentInCarton = parseFloat(existingInv.inCartonQty || "0");
                    await tx
                        .update(inventory)
                        .set({
                            availableQty: newQty.toFixed(2),
                            ...(shouldCreateStockInCartons
                                ? {
                                    inCartonQty: (currentInCarton + stockInCartonUnits).toFixed(2),
                                    activeCartonCount: (existingInv.activeCartonCount || 0) + cartonCount,
                                }
                                : {}),
                        })
                        .where(eq(inventory.id, existingInv.id));
                } else {
                    await tx.insert(inventory).values({
                        ownerType: "warehouse",
                        ownerId: userId,
                        variantId: input.variantId,
                        availableQty: inventoryQty.toFixed(2),
                        ...(shouldCreateStockInCartons
                            ? {
                                inCartonQty: stockInCartonUnits.toFixed(2),
                                activeCartonCount: cartonCount,
                            }
                            : {}),
                    });
                }

                // 6. Create physical carton records for carton entries
                if (shouldCreateStockInCartons) {
                    // Generate carton IDs
                    const year = new Date().getFullYear();
                    const [lastCarton] = await tx
                        .select({ cartonId: carton.cartonId })
                        .from(carton)
                        .where(sql`${carton.cartonId} LIKE ${"CTN-" + year + "-%"}`)
                        .orderBy(desc(carton.id))
                        .limit(1);

                    let nextNum = 1;
                    if (lastCarton?.cartonId) {
                        const parts = lastCarton.cartonId.split("-");
                        const lastNum = parseInt(parts[2] || "0", 10);
                        nextNum = lastNum + 1;
                    }

                    // Create one carton record per carton
                    for (let i = 0; i < cartonCount; i++) {
                        const cartonIdStr = `CTN-${year}-${String(nextNum + i).padStart(6, "0")}`;
                        await tx.insert(carton).values({
                            cartonId: cartonIdStr,
                            warehouseId: userId,
                            cartonConfigId: null,
                            variantId: input.variantId,
                            totalPacks: packsPerSingleCarton,
                            totalWeightKg: weightPerCarton.toFixed(2),
                            status: "active",
                            barcode: cartonIdStr,
                            storageAreaId: input.storageAreaId || null,
                            note: input.note || null,
                            cartonPrice: null, // Selling price set later on pricing page
                            deliveryCostPerUnit: null,
                        });
                    }
                }

                return entry;
            });

            return { entry: result, message: "Stock added successfully" };
        }),

    /**
     * List stock entries for this warehouse (history).
     */
    getStockEntries: warehouseProcedure
        .input(
            z.object({
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const offset = (input.page - 1) * input.limit;

            const entries = await db.query.stockEntry.findMany({
                where: eq(stockEntry.warehouseId, userId),
                orderBy: [desc(stockEntry.createdAt)],
                offset,
                limit: input.limit,
                with: {
                    variant: {
                        columns: {
                            id: true,
                            sku: true,
                            unitLabel: true,
                            weightKg: true,
                        },
                        with: {
                            product: {
                                columns: { id: true, name: true, image: true },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                    supplier: {
                        columns: { id: true, name: true },
                    },
                },
            });

            const [countResult] = await db
                .select({ count: count() })
                .from(stockEntry)
                .where(eq(stockEntry.warehouseId, userId));

            return {
                entries,
                pagination: {
                    page: input.page,
                    limit: input.limit,
                    totalCount: Number(countResult?.count || 0),
                    totalPages: Math.ceil(
                        Number(countResult?.count || 0) / input.limit,
                    ),
                },
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Storage Area CRUD
// ────────────────────────────────────────────────────────────────

const storageAreaQueries = {
    /** List all storage areas for this warehouse */
    getStorageAreas: warehouseProcedure
        .input(z.object({ search: z.string().optional() }))
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const areas = await db
                .select()
                .from(warehouseStorageArea)
                .where(
                    and(
                        eq(warehouseStorageArea.warehouseId, userId),
                        eq(warehouseStorageArea.isActive, true),
                    ),
                )
                .orderBy(desc(warehouseStorageArea.createdAt));

            return { areas };
        }),

    /** Create a new storage area */
    createStorageArea: warehouseProcedure
        .input(
            z.object({
                name: z.string().min(1).max(150),
                description: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [area] = await db
                .insert(warehouseStorageArea)
                .values({
                    warehouseId: userId,
                    name: input.name,
                    description: input.description || null,
                })
                .returning();

            return { area };
        }),
};

// ────────────────────────────────────────────────────────────────
// Pricing Management (Wholesale Price for Retailers)
// ────────────────────────────────────────────────────────────────

import {
    category as catTable,
    productType as productTypeTable,
} from "@bikalpo-project/db/schema";

const pricingQueries = {
    /**
     * Get warehouse price list — all inventory items with full product hierarchy.
     * Grouped by core product with brand/variant detail for the pricing page.
     */
    getWarehousePriceList: warehouseProcedure
        .input(
            z.object({
                typeId: z.number().optional(),
                categoryId: z.number().optional(),
                subCategoryId: z.number().optional(),
                coreProductId: z.number().optional(),
                brandId: z.number().optional(),
                search: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Fetch all inventory items for this warehouse with deep relations
            const items = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            brand: { columns: { id: true, name: true } },
                            product: {
                                with: {
                                    category: {
                                        columns: { id: true, name: true, slug: true, typeId: true },
                                    },
                                    subCategory: {
                                        columns: { id: true, name: true, slug: true },
                                    },
                                    brand: { columns: { id: true, name: true } },
                                    coreProduct: {
                                        columns: { id: true, name: true, slug: true, image: true, categoryId: true, subCategoryId: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            // 2. Get product type info for categories (needed for type filter)
            const categoryIds = [...new Set(
                items
                    .map((i) => i.variant?.product?.category?.id)
                    .filter((id): id is number => id != null),
            )];

            const categoryTypeMap = new Map<number, { typeId: number; typeName: string }>();
            if (categoryIds.length > 0) {
                const catTypes = await db
                    .select({
                        catId: catTable.id,
                        typeId: productTypeTable.id,
                        typeName: productTypeTable.name,
                    })
                    .from(catTable)
                    .leftJoin(productTypeTable, eq(catTable.typeId, productTypeTable.id))
                    .where(inArray(catTable.id, categoryIds));

                for (const ct of catTypes) {
                    if (ct.typeId && ct.typeName) {
                        categoryTypeMap.set(ct.catId, { typeId: ct.typeId, typeName: ct.typeName });
                    }
                }
            }

            // 3. Build flat items with all needed data
            type PriceItem = {
                inventoryId: number;
                variantId: number;
                sku: string | null;
                variantSku: string | null;
                productId: number;
                productSku: string | null;
                productName: string;
                productStatus: string;
                coreProductId: number | null;
                coreProductName: string;
                coreProductImage: string;
                categoryId: number;
                categoryName: string;
                subCategoryId: number | null;
                subCategoryName: string;
                typeId: number | null;
                typeName: string;
                brandId: number | null;
                brandName: string;
                variantLabel: string;
                unitLabel: string;
                packagingType: string;
                packUnit: string;
                packPrice: string;
                basePrice: string;
                isActive: boolean;
                availableQty: string;
                reservedQty: string;
                inCartonQty: string;
                activeCartonCount: number;
                reorderLevel: number;
                updatedAt: Date;
                isLoose: boolean;
                weightKg: number;
            };

            const priceItems: PriceItem[] = [];

            for (const item of items) {
                const v = item.variant;
                if (!v || !v.product) continue;
                const p = v.product;
                const cat = p.category;
                if (!cat) continue;

                const typeInfo = categoryTypeMap.get(cat.id);
                const brandInfo = v.brand || p.brand;
                const core = p.coreProduct;

                // Build variant display label
                const labelParts: string[] = [];
                if ((v as any).color) labelParts.push((v as any).color);
                if ((v as any).size) labelParts.push((v as any).size);
                const weightKg = Number(v.weightKg || 0);
                if (weightKg > 0) labelParts.push(`${weightKg}KG`);
                if (v.packagingType && v.packagingType !== "loose") {
                    labelParts.push(v.packagingType.charAt(0).toUpperCase() + v.packagingType.slice(1));
                }
                const variantLabel = labelParts.length > 0
                    ? labelParts.join(" ")
                    : v.unitLabel || v.sku || `Variant #${v.id}`;

                // Pack unit display — show just the weight/unit (e.g. "5 KG", "1 L", "1 Pc")
                const packUnit = weightKg > 0
                    ? `${weightKg % 1 === 0 ? Math.round(weightKg) : weightKg} KG`
                    : v.unitLabel || "Unit";

                priceItems.push({
                    inventoryId: item.id,
                    variantId: v.id,
                    sku: v.sku || p.sku || null,
                    variantSku: v.sku || null,
                    productId: p.id,
                    productSku: p.sku || null,
                    productName: p.name,
                    productStatus: p.status,
                    coreProductId: core?.id ?? null,
                    coreProductName: core?.name ?? p.name,
                    coreProductImage: core?.image ?? (p as any).image ?? "",
                    categoryId: cat.id,
                    categoryName: cat.name,
                    subCategoryId: p.subCategory?.id ?? null,
                    subCategoryName: p.subCategory?.name ?? "—",
                    typeId: typeInfo?.typeId ?? null,
                    typeName: typeInfo?.typeName ?? "Other",
                    brandId: brandInfo?.id ?? null,
                    brandName: brandInfo?.name ?? "—",
                    variantLabel,
                    unitLabel: v.unitLabel || "Unit",
                    packagingType: v.packagingType || v.packType || "unit",
                    packUnit,
                    packPrice: item.retailPrice || v.price || "0",
                    basePrice: v.price || "0",
                    isActive: v.isActive,
                    availableQty: item.availableQty || "0",
                    reservedQty: item.reservedQty || "0",
                    inCartonQty: item.inCartonQty || "0",
                    activeCartonCount: item.activeCartonCount ?? 0,
                    reorderLevel: v.reorderLevel ?? p.reorderLevel ?? 0,
                    updatedAt: item.updatedAt,
                    isLoose: v.packagingType === "loose",
                    weightKg,
                });
            }

            // 4. Apply filters
            let filtered = priceItems;

            if (input.typeId) {
                filtered = filtered.filter((i) => i.typeId === input.typeId);
            }
            if (input.categoryId) {
                filtered = filtered.filter((i) => i.categoryId === input.categoryId);
            }
            if (input.subCategoryId) {
                filtered = filtered.filter((i) => i.subCategoryId === input.subCategoryId);
            }
            if (input.coreProductId) {
                filtered = filtered.filter((i) => i.coreProductId === input.coreProductId);
            }
            if (input.brandId) {
                filtered = filtered.filter((i) => i.brandId === input.brandId);
            }
            if (input.search?.trim()) {
                const s = input.search.trim().toLowerCase();
                filtered = filtered.filter(
                    (i) =>
                        i.productName.toLowerCase().includes(s) ||
                        i.coreProductName.toLowerCase().includes(s) ||
                        i.brandName.toLowerCase().includes(s) ||
                        i.variantLabel.toLowerCase().includes(s) ||
                        (i.sku?.toLowerCase().includes(s) ?? false),
                );
            }

            // 5. Build filter options from ALL items (before filtering)
            const typeSet = new Map<number, string>();
            const catSet = new Map<number, string>();
            const subCatSet = new Map<number, string>();
            const coreSet = new Map<number, string>();
            const brandSet = new Map<number, string>();

            for (const item of priceItems) {
                if (item.typeId) typeSet.set(item.typeId, item.typeName);
                catSet.set(item.categoryId, item.categoryName);
                if (item.subCategoryId) subCatSet.set(item.subCategoryId, item.subCategoryName);
                if (item.coreProductId) coreSet.set(item.coreProductId, item.coreProductName);
                if (item.brandId) brandSet.set(item.brandId, item.brandName);
            }

            // 6. Stats
            const uniqueProducts = new Set(priceItems.map((i) => i.coreProductId ?? i.productId));
            const lastUpdated = priceItems.length > 0
                ? priceItems.reduce((latest, i) =>
                    i.updatedAt > latest ? i.updatedAt : latest, priceItems[0]!.updatedAt)
                : null;

            return {
                items: filtered,
                stats: {
                    totalProducts: uniqueProducts.size,
                    totalVariants: priceItems.length,
                    lastUpdated: lastUpdated?.toISOString() ?? null,
                },
                filterOptions: {
                    types: Array.from(typeSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
                    categories: Array.from(catSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
                    subCategories: Array.from(subCatSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
                    coreProducts: Array.from(coreSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
                    brands: Array.from(brandSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
                },
            };
        }),

    /**
     * Update the wholesale/supply price for a specific inventory item.
     */
    updateWarehousePrice: warehouseProcedure
        .input(
            z.object({
                inventoryId: z.number(),
                retailPrice: z.string().min(1),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existing = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.id, input.inventoryId),
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                ),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Inventory item not found" });
            }

            const [updated] = await db
                .update(inventory)
                .set({ retailPrice: input.retailPrice })
                .where(eq(inventory.id, input.inventoryId))
                .returning();

            return { inventory: updated };
        }),

    /**
     * Toggle availability of an inventory item (set qty to 0 or keep as-is).
     */
    toggleInventoryAvailability: warehouseProcedure
        .input(
            z.object({
                inventoryId: z.number(),
                available: z.boolean(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existing = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.id, input.inventoryId),
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                ),
            });

            if (!existing) {
                throw new ORPCError("NOT_FOUND", { message: "Inventory item not found" });
            }

            const updateData: Record<string, any> = {};
            if (!input.available) {
                // Set to unavailable — zero out stock
                updateData.availableQty = "0";
            } else {
                // Restore to 1 as minimum (user can adjust from inventory page)
                if (Number(existing.availableQty) <= 0) {
                    updateData.availableQty = "1";
                }
            }

            if (Object.keys(updateData).length > 0) {
                await db
                    .update(inventory)
                    .set(updateData)
                    .where(eq(inventory.id, input.inventoryId));
            }

            return { success: true };
        }),
};

// ────────────────────────────────────────────────────────────────
// Carton Management (Config + Physical Cartons)
// ────────────────────────────────────────────────────────────────

const cartonQueries = {
    // ── Carton Config CRUD ──

    /**
     * Get all carton configs for a specific variant.
     */
    getCartonConfigs: warehouseProcedure
        .input(z.object({ variantId: z.number().int() }))
        .handler(async ({ input }) => {
            const configs = await db
                .select()
                .from(cartonConfig)
                .where(
                    and(
                        eq(cartonConfig.variantId, input.variantId),
                        eq(cartonConfig.isActive, true),
                    ),
                )
                .orderBy(cartonConfig.packsPerCarton);

            return { configs };
        }),

    /**
     * Get all carton configs for multiple variants at once (batch).
     * Useful when loading product detail page with multiple variants.
     */
    getCartonConfigsBatch: warehouseProcedure
        .input(z.object({ variantIds: z.array(z.number().int()) }))
        .handler(async ({ input }) => {
            if (input.variantIds.length === 0) return { configs: [] };

            const configs = await db
                .select()
                .from(cartonConfig)
                .where(
                    and(
                        inArray(cartonConfig.variantId, input.variantIds),
                        eq(cartonConfig.isActive, true),
                    ),
                )
                .orderBy(cartonConfig.variantId, cartonConfig.packsPerCarton);

            return { configs };
        }),

    /**
     * Get a summary of active physical cartons for multiple variants.
     * Used by the pricing page to display carton info sourced from actual carton data.
     * Returns the most recent active carton per variant with its weight, pack count, price, and delivery cost.
     */
    getCartonSummaryBatch: warehouseProcedure
        .input(z.object({ variantIds: z.array(z.number().int()) }))
        .handler(async ({ context, input }) => {
            if (input.variantIds.length === 0) return { cartons: [] };

            const userId = context.session.user.id;

            // Fetch all active cartons for these variants belonging to this warehouse
            const activeCartons = await db.query.carton.findMany({
                where: and(
                    eq(carton.warehouseId, userId),
                    eq(carton.status, "active"),
                    inArray(carton.variantId, input.variantIds),
                ),
                orderBy: [desc(carton.createdAt)],
            });

            // Group by variantId — pick the most recent active carton as the representative
            const summaryMap = new Map<number, {
                variantId: number;
                totalPacks: number;
                totalWeightKg: string;
                cartonPrice: string | null;
                deliveryCostPerUnit: string | null;
                activeCartonCount: number;
                latestCartonId: string;
                latestCartonDbId: number;
            }>();

            for (const c of activeCartons) {
                if (!summaryMap.has(c.variantId)) {
                    // First (most recent) carton for this variant becomes the representative
                    summaryMap.set(c.variantId, {
                        variantId: c.variantId,
                        totalPacks: c.totalPacks,
                        totalWeightKg: c.totalWeightKg,
                        cartonPrice: c.cartonPrice,
                        deliveryCostPerUnit: c.deliveryCostPerUnit,
                        activeCartonCount: 1,
                        latestCartonId: c.cartonId,
                        latestCartonDbId: c.id,
                    });
                } else {
                    // Accumulate count, weight, and fill missing pricing from other cartons
                    const existing = summaryMap.get(c.variantId)!;
                    existing.activeCartonCount += 1;
                    existing.totalPacks += c.totalPacks;
                    existing.totalWeightKg = (
                        parseFloat(existing.totalWeightKg) +
                        parseFloat(c.totalWeightKg)
                    ).toFixed(2);
                    // If the representative carton has no price, inherit from this carton
                    if (!existing.cartonPrice && c.cartonPrice) {
                        existing.cartonPrice = c.cartonPrice;
                    }
                    if (!existing.deliveryCostPerUnit && c.deliveryCostPerUnit) {
                        existing.deliveryCostPerUnit = c.deliveryCostPerUnit;
                    }
                }
            }

            return { cartons: Array.from(summaryMap.values()) };
        }),

    /**
     * Create a new carton config for a variant.
     */
    createCartonConfig: warehouseProcedure
        .input(
            z.object({
                variantId: z.number().int(),
                packsPerCarton: z.number().int().min(1),
                cartonPrice: z.string().refine((v) => parseFloat(v) >= 0),
                cartonCostPrice: z.string().optional(),
                deliveryCostPerCarton: z.string().optional(),
                label: z.string().optional(),
                isDefault: z.boolean().default(false),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Validate variant belongs to this warehouse
            const variant = await db.query.productVariant.findFirst({
                where: eq(productVariant.id, input.variantId),
                with: {
                    product: { columns: { id: true, createdByWarehouseId: true } },
                },
            });

            if (!variant || (variant.product as any)?.createdByWarehouseId !== userId) {
                throw new ORPCError("FORBIDDEN", {
                    message: "This variant does not belong to your warehouse",
                });
            }

            // Auto-calculate carton weight
            const packWeightKg = parseFloat(variant.weightKg);
            const cartonWeightKg = input.packsPerCarton * packWeightKg;

            // Auto-generate label if not provided
            const label = input.label || `${input.packsPerCarton} Pack Carton`;

            // If this is set as default, unset any existing defaults
            if (input.isDefault) {
                await db
                    .update(cartonConfig)
                    .set({ isDefault: false })
                    .where(eq(cartonConfig.variantId, input.variantId));
            }

            const [config] = await db
                .insert(cartonConfig)
                .values({
                    variantId: input.variantId,
                    packsPerCarton: input.packsPerCarton,
                    cartonWeightKg: cartonWeightKg.toFixed(2),
                    cartonPrice: input.cartonPrice,
                    cartonCostPrice: input.cartonCostPrice || null,
                    deliveryCostPerCarton: input.deliveryCostPerCarton || null,
                    label,
                    isDefault: input.isDefault,
                })
                .returning();

            return { config };
        }),

    /**
     * Update an existing carton config.
     */
    updateCartonConfig: warehouseProcedure
        .input(
            z.object({
                id: z.number().int(),
                packsPerCarton: z.number().int().min(1).optional(),
                cartonPrice: z.string().optional(),
                cartonCostPrice: z.string().optional(),
                deliveryCostPerCarton: z.string().optional(),
                label: z.string().optional(),
                isDefault: z.boolean().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Validate config exists and belongs to this warehouse
            const existing = await db.query.cartonConfig.findFirst({
                where: eq(cartonConfig.id, input.id),
                with: {
                    variant: {
                        with: {
                            product: { columns: { createdByWarehouseId: true } },
                        },
                    },
                },
            });

            if (!existing || (existing.variant?.product as any)?.createdByWarehouseId !== userId) {
                throw new ORPCError("FORBIDDEN", { message: "Config not found or not yours" });
            }

            const updateData: Record<string, any> = {};

            if (input.packsPerCarton !== undefined) {
                updateData.packsPerCarton = input.packsPerCarton;
                // Recalculate weight
                const packWeightKg = parseFloat(existing.variant?.weightKg || "0");
                updateData.cartonWeightKg = (input.packsPerCarton * packWeightKg).toFixed(2);
            }
            if (input.cartonPrice !== undefined) updateData.cartonPrice = input.cartonPrice;
            if (input.cartonCostPrice !== undefined) updateData.cartonCostPrice = input.cartonCostPrice;
            if (input.deliveryCostPerCarton !== undefined) updateData.deliveryCostPerCarton = input.deliveryCostPerCarton;
            if (input.label !== undefined) updateData.label = input.label;

            if (input.isDefault === true) {
                // Unset other defaults first
                await db
                    .update(cartonConfig)
                    .set({ isDefault: false })
                    .where(eq(cartonConfig.variantId, existing.variantId));
                updateData.isDefault = true;
            } else if (input.isDefault === false) {
                updateData.isDefault = false;
            }

            if (Object.keys(updateData).length > 0) {
                await db
                    .update(cartonConfig)
                    .set(updateData)
                    .where(eq(cartonConfig.id, input.id));
            }

            return { success: true };
        }),

    /**
     * Delete (soft) a carton config.
     */
    deleteCartonConfig: warehouseProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existing = await db.query.cartonConfig.findFirst({
                where: eq(cartonConfig.id, input.id),
                with: {
                    variant: {
                        with: {
                            product: { columns: { createdByWarehouseId: true } },
                        },
                    },
                },
            });

            if (!existing || (existing.variant?.product as any)?.createdByWarehouseId !== userId) {
                throw new ORPCError("FORBIDDEN", { message: "Config not found or not yours" });
            }

            await db
                .update(cartonConfig)
                .set({ isActive: false })
                .where(eq(cartonConfig.id, input.id));

            return { success: true };
        }),

    // ── Physical Carton Management ──

    /**
     * Preview the next carton ID that will be assigned.
     */
    getNextCartonIdPreview: warehouseProcedure
        .handler(async () => {
            const year = new Date().getFullYear();
            const [lastCarton] = await db
                .select({ cartonId: carton.cartonId })
                .from(carton)
                .where(sql`${carton.cartonId} LIKE ${"CTN-" + year + "-%"}`)
                .orderBy(desc(carton.id))
                .limit(1);

            let nextNum = 1;
            if (lastCarton?.cartonId) {
                const parts = lastCarton.cartonId.split("-");
                const lastNum = parseInt(parts[2] || "0", 10);
                nextNum = lastNum + 1;
            }

            return {
                nextCartonId: `CTN-${year}-${String(nextNum).padStart(6, "0")}`,
            };
        }),

    /**
     * Create a physical carton from existing loose/pack stock.
     * Deducts from available stock and marks as in-carton.
     */
    createCarton: warehouseProcedure
        .input(
            z.object({
                variantId: z.number().int(),
                packCount: z.number().min(0.01), // Allow decimal for loose (KG)
                cartonConfigId: z.number().int().optional(),
                storageAreaId: z.number().int().optional(),
                note: z.string().optional(),
                // Editable pricing overrides
                overrideCartonPrice: z.string().optional(),
                overrideDeliveryCost: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Get variant to auto-calculate weight and detect type
            const variant = await db.query.productVariant.findFirst({
                where: eq(productVariant.id, input.variantId),
            });

            if (!variant) {
                throw new ORPCError("NOT_FOUND", { message: "Variant not found" });
            }

            const isLoose = (variant.packType || variant.packagingType) === "loose";

            // 2. Optionally get carton config (for pricing defaults)
            let configPrice: string | null = null;
            let configDeliveryCost: string | null = null;
            let configId: number | null = null;

            if (input.cartonConfigId) {
                const config = await db.query.cartonConfig.findFirst({
                    where: and(
                        eq(cartonConfig.id, input.cartonConfigId),
                        eq(cartonConfig.variantId, input.variantId),
                        eq(cartonConfig.isActive, true),
                    ),
                });
                if (config) {
                    configId = config.id;
                    configPrice = config.cartonPrice;
                    configDeliveryCost = config.deliveryCostPerCarton;
                }
            }

            // 3. Check inventory has enough stock
            const inv = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                    eq(inventory.variantId, input.variantId),
                ),
            });

            if (!inv) {
                throw new ORPCError("NOT_FOUND", { message: "No inventory found for this variant" });
            }

            const available = parseFloat(inv.availableQty);
            const inCarton = parseFloat(inv.inCartonQty);
            const looseStock = available - inCarton;

            if (looseStock < input.packCount) {
                const unit = isLoose ? "KG" : "packs";
                throw new ORPCError("BAD_REQUEST", {
                    message: `Not enough stock. Need ${input.packCount} ${unit}, only ${looseStock.toFixed(isLoose ? 1 : 0)} available.`,
                });
            }

            // 4. Calculate carton weight
            // For loose: quantity IS the weight in KG directly
            // For packs: packCount × variant.weightKg
            const packWeightKg = parseFloat(variant.weightKg);
            const totalWeightKg = isLoose
                ? input.packCount.toFixed(2)     // Loose: quantity is already KG
                : (input.packCount * packWeightKg).toFixed(2);

            // 5. Generate carton ID: CTN-YYYY-NNNNNN
            const year = new Date().getFullYear();
            const [lastCarton] = await db
                .select({ cartonId: carton.cartonId })
                .from(carton)
                .where(sql`${carton.cartonId} LIKE ${"CTN-" + year + "-%"}`)
                .orderBy(desc(carton.id))
                .limit(1);

            let nextNum = 1;
            if (lastCarton?.cartonId) {
                const parts = lastCarton.cartonId.split("-");
                const lastNum = parseInt(parts[2] || "0", 10);
                nextNum = lastNum + 1;
            }
            const cartonIdStr = `CTN-${year}-${String(nextNum).padStart(6, "0")}`;

            // 6. Transaction: create carton + update inventory
            const result = await db.transaction(async (tx) => {
                const [newCarton] = await tx
                    .insert(carton)
                    .values({
                        cartonId: cartonIdStr,
                        warehouseId: userId,
                        cartonConfigId: configId,
                        variantId: input.variantId,
                        totalPacks: isLoose ? 0 : Math.round(input.packCount),
                        totalWeightKg,
                        status: "active",
                        barcode: cartonIdStr,
                        storageAreaId: input.storageAreaId || null,
                        note: input.note || null,
                        cartonPrice: input.overrideCartonPrice || configPrice || null,
                        deliveryCostPerUnit: input.overrideDeliveryCost || configDeliveryCost || null,
                    })
                    .returning();

                // Update inventory: move stock from available → in-carton
                const newInCartonQty = inCarton + input.packCount;
                const newActiveCount = (inv.activeCartonCount || 0) + 1;

                await tx
                    .update(inventory)
                    .set({
                        inCartonQty: newInCartonQty.toFixed(2),
                        activeCartonCount: newActiveCount,
                    })
                    .where(eq(inventory.id, inv.id));

                return newCarton;
            });

            return { carton: result, cartonId: cartonIdStr };
        }),

    /**
     * Break a carton — decompose back to loose/pack stock.
     * Carton becomes immutable with status 'broken'.
     */
    breakCarton: warehouseProcedure
        .input(z.object({ cartonId: z.number().int() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Validate carton exists and is active
            const existingCarton = await db.query.carton.findFirst({
                where: and(
                    eq(carton.id, input.cartonId),
                    eq(carton.warehouseId, userId),
                    eq(carton.status, "active"),
                ),
            });

            if (!existingCarton) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Active carton not found or doesn't belong to your warehouse",
                });
            }

            // 2. Get inventory
            const inv = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                    eq(inventory.variantId, existingCarton.variantId),
                ),
            });

            if (!inv) {
                throw new ORPCError("NOT_FOUND", { message: "Inventory not found" });
            }

            // 3. Transaction: break carton + return stock
            await db.transaction(async (tx) => {
                // Mark carton as broken
                await tx
                    .update(carton)
                    .set({
                        status: "broken",
                        brokenAt: new Date(),
                        brokenById: userId,
                    })
                    .where(eq(carton.id, input.cartonId));

                // Move packs from in-carton → loose
                const inCarton = parseFloat(inv.inCartonQty);
                const newInCartonQty = Math.max(0, inCarton - existingCarton.totalPacks);
                const newActiveCount = Math.max(0, (inv.activeCartonCount || 0) - 1);

                await tx
                    .update(inventory)
                    .set({
                        inCartonQty: newInCartonQty.toFixed(2),
                        activeCartonCount: newActiveCount,
                    })
                    .where(eq(inventory.id, inv.id));
            });

            return { success: true, message: "Carton broken successfully" };
        }),

    /**
     * List all cartons for this warehouse.
     */
    getCartons: warehouseProcedure
        .input(
            z.object({
                status: z.enum(["active", "broken", "dispatched", "sold"]).optional(),
                variantId: z.number().int().optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const offset = (input.page - 1) * input.limit;

            const conditions: SQL[] = [eq(carton.warehouseId, userId)];

            if (input.status) {
                conditions.push(eq(carton.status, input.status));
            }
            if (input.variantId) {
                conditions.push(eq(carton.variantId, input.variantId));
            }

            const cartons = await db.query.carton.findMany({
                where: and(...conditions),
                orderBy: [desc(carton.createdAt)],
                offset,
                limit: input.limit,
                with: {
                    config: true,
                    variant: {
                        columns: {
                            id: true,
                            sku: true,
                            unitLabel: true,
                            weightKg: true,
                        },
                        with: {
                            product: {
                                columns: { id: true, name: true, image: true },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                    storageArea: { columns: { id: true, name: true } },
                },
            });

            const [countResult] = await db
                .select({ count: count() })
                .from(carton)
                .where(and(...conditions));

            // Stats
            const [activeCount] = await db
                .select({ count: count() })
                .from(carton)
                .where(and(eq(carton.warehouseId, userId), eq(carton.status, "active")));

            const [totalCartons] = await db
                .select({ count: count() })
                .from(carton)
                .where(eq(carton.warehouseId, userId));

            return {
                cartons,
                stats: {
                    active: Number(activeCount?.count || 0),
                    total: Number(totalCartons?.count || 0),
                },
                pagination: {
                    page: input.page,
                    limit: input.limit,
                    totalCount: Number(countResult?.count || 0),
                    totalPages: Math.ceil(Number(countResult?.count || 0) / input.limit),
                },
            };
        }),

    /**
     * Get a single carton by ID with full details.
     */
    getCartonById: warehouseProcedure
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const result = await db.query.carton.findFirst({
                where: and(
                    eq(carton.id, input.id),
                    eq(carton.warehouseId, userId),
                ),
                with: {
                    config: true,
                    variant: {
                        with: {
                            product: {
                                columns: { id: true, name: true, image: true },
                                with: { category: { columns: { name: true } } },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                    storageArea: { columns: { id: true, name: true } },
                },
            });

            if (!result) {
                throw new ORPCError("NOT_FOUND", { message: "Carton not found" });
            }

            return { carton: result };
        }),

    // ── Carton Tracking System (New) ──

    /**
     * Get products that have cartons — Level 1 of the carton tracking drill-down.
     * Aggregates carton data grouped by product.
     */
    getCartonTrackingProducts: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                page: z.number().int().min(1).default(1),
                pageSize: z.number().int().min(1).max(100).default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Fetch all cartons for this warehouse with deep relations
            const allCartons = await db.query.carton.findMany({
                where: eq(carton.warehouseId, userId),
                with: {
                    config: true,
                    variant: {
                        with: {
                            product: {
                                columns: { id: true, name: true, image: true },
                            },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                    storageArea: { columns: { id: true, name: true } },
                },
            });

            // 2. Group by product
            const productMap = new Map<number, {
                productId: number;
                productName: string;
                productImage: string;
                variants: Set<string>;
                packType: string;
                totalCartons: number;
                activeCartons: number;
                totalPacks: number;
                totalWeightKg: number;
                locations: Set<string>;
            }>();

            for (const c of allCartons) {
                const v = c.variant;
                if (!v?.product) continue;
                const p = v.product as any;

                if (!productMap.has(p.id)) {
                    productMap.set(p.id, {
                        productId: p.id,
                        productName: p.name,
                        productImage: p.image || "",
                        variants: new Set(),
                        packType: (v as any).packType || (v as any).packagingType || "carton",
                        totalCartons: 0,
                        activeCartons: 0,
                        totalPacks: 0,
                        totalWeightKg: 0,
                        locations: new Set(),
                    });
                }

                const entry = productMap.get(p.id)!;
                const variantLabel = (v.brand as any)?.name
                    ? `${(v.brand as any).name} ${v.unitLabel}`
                    : v.unitLabel;
                entry.variants.add(variantLabel);
                entry.totalCartons += 1;
                if (c.status === "active") {
                    entry.activeCartons += 1;
                    entry.totalPacks += c.totalPacks;
                    entry.totalWeightKg += parseFloat(c.totalWeightKg);
                }
                if (c.storageArea) {
                    entry.locations.add((c.storageArea as any).name);
                }
            }

            // 3. Convert to array and apply search
            let products = Array.from(productMap.values()).map((p) => ({
                productId: p.productId,
                productName: p.productName,
                productImage: p.productImage,
                variantsAvailable: Array.from(p.variants).join(", "),
                packType: p.packType,
                totalCartons: p.totalCartons,
                activeCartons: p.activeCartons,
                totalPacks: p.totalPacks,
                totalWeightKg: Math.round(p.totalWeightKg * 100) / 100,
                locationCount: p.locations.size,
            }));

            if (input.search?.trim()) {
                const s = input.search.trim().toLowerCase();
                products = products.filter(
                    (p) =>
                        p.productName.toLowerCase().includes(s) ||
                        p.variantsAvailable.toLowerCase().includes(s),
                );
            }

            // Sort by active cartons descending
            products.sort((a, b) => b.activeCartons - a.activeCartons);

            // 4. KPI stats
            const allActiveCartons = allCartons.filter((c) => c.status === "active");
            const allLocations = new Set(allActiveCartons.map((c) => (c.storageArea as any)?.name).filter(Boolean));

            const kpi = {
                totalProducts: productMap.size,
                totalCartons: allActiveCartons.length,
                totalUnits: allActiveCartons.reduce((s, c) => s + c.totalPacks, 0),
                activeLocations: allLocations.size,
            };

            // 5. Paginate
            const totalCount = products.length;
            const totalPages = Math.ceil(totalCount / input.pageSize);
            const offset = (input.page - 1) * input.pageSize;
            const paginatedProducts = products.slice(offset, offset + input.pageSize);

            return {
                products: paginatedProducts,
                kpi,
                pagination: {
                    page: input.page,
                    pageSize: input.pageSize,
                    totalCount,
                    totalPages,
                },
            };
        }),

    /**
     * Get variant breakdown for a specific product — Level 2 of the carton tracking drill-down.
     */
    getCartonTrackingVariants: warehouseProcedure
        .input(
            z.object({
                productId: z.number().int(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Get all cartons for this warehouse with variant relations
            const allCartons = await db.query.carton.findMany({
                where: eq(carton.warehouseId, userId),
                with: {
                    config: true,
                    variant: {
                        with: {
                            product: { columns: { id: true, name: true, image: true } },
                            brand: { columns: { id: true, name: true } },
                        },
                    },
                    storageArea: { columns: { id: true, name: true } },
                },
            });

            // Filter to the specific product
            const productCartons = allCartons.filter(
                (c) => (c.variant?.product as any)?.id === input.productId,
            );

            // Get product info from the first carton
            const firstCarton = productCartons[0];
            const productInfo = firstCarton
                ? {
                    productId: (firstCarton.variant?.product as any)?.id,
                    productName: (firstCarton.variant?.product as any)?.name || "Unknown",
                    productImage: (firstCarton.variant?.product as any)?.image || "",
                }
                : { productId: input.productId, productName: "Unknown", productImage: "" };

            // Group by variant
            const variantMap = new Map<number, {
                variantId: number;
                variantLabel: string;
                brandName: string;
                sku: string;
                weightKg: string;
                packType: string;
                totalCartons: number;
                activeCartons: number;
                totalPacks: number;
            }>();

            for (const c of productCartons) {
                const v = c.variant;
                if (!v) continue;

                if (!variantMap.has(v.id)) {
                    variantMap.set(v.id, {
                        variantId: v.id,
                        variantLabel: v.unitLabel || `Variant #${v.id}`,
                        brandName: (v.brand as any)?.name || "—",
                        sku: v.sku || "—",
                        weightKg: v.weightKg,
                        packType: (v as any).packType || (v as any).packagingType || "other",
                        totalCartons: 0,
                        activeCartons: 0,
                        totalPacks: 0,
                    });
                }

                const entry = variantMap.get(v.id)!;
                entry.totalCartons += 1;
                if (c.status === "active") {
                    entry.activeCartons += 1;
                    entry.totalPacks += c.totalPacks;
                }
            }

            return {
                product: productInfo,
                variants: Array.from(variantMap.values()).sort((a, b) => b.activeCartons - a.activeCartons),
            };
        }),

    /**
     * Transfer a carton to a different storage area.
     */
    transferCarton: warehouseProcedure
        .input(
            z.object({
                cartonId: z.number().int(),
                newStorageAreaId: z.number().int(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Validate carton exists, is active, and belongs to this warehouse
            const existingCarton = await db.query.carton.findFirst({
                where: and(
                    eq(carton.id, input.cartonId),
                    eq(carton.warehouseId, userId),
                    eq(carton.status, "active"),
                ),
            });

            if (!existingCarton) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Active carton not found or doesn't belong to your warehouse",
                });
            }

            // Validate storage area belongs to this warehouse
            const area = await db.query.warehouseStorageArea.findFirst({
                where: and(
                    eq(warehouseStorageArea.id, input.newStorageAreaId),
                    eq(warehouseStorageArea.warehouseId, userId),
                ),
            });

            if (!area) {
                throw new ORPCError("NOT_FOUND", { message: "Storage area not found" });
            }

            await db
                .update(carton)
                .set({ storageAreaId: input.newStorageAreaId })
                .where(eq(carton.id, input.cartonId));

            return { success: true, message: `Carton transferred to ${area.name}` };
        }),

    /**
     * Mark a carton as empty — removes it from active inventory.
     */
    markCartonEmpty: warehouseProcedure
        .input(z.object({ cartonId: z.number().int() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Validate carton
            const existingCarton = await db.query.carton.findFirst({
                where: and(
                    eq(carton.id, input.cartonId),
                    eq(carton.warehouseId, userId),
                    eq(carton.status, "active"),
                ),
            });

            if (!existingCarton) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Active carton not found",
                });
            }

            // Get inventory
            const inv = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                    eq(inventory.variantId, existingCarton.variantId),
                ),
            });

            if (!inv) {
                throw new ORPCError("NOT_FOUND", { message: "Inventory not found" });
            }

            // Transaction: mark carton sold/empty + adjust inventory
            await db.transaction(async (tx) => {
                await tx
                    .update(carton)
                    .set({ status: "sold" })
                    .where(eq(carton.id, input.cartonId));

                // Remove packs from in-carton count
                const inCartonQty = parseFloat(inv.inCartonQty);
                const newInCartonQty = Math.max(0, inCartonQty - existingCarton.totalPacks);
                const newActiveCount = Math.max(0, (inv.activeCartonCount || 0) - 1);

                // Also reduce available qty since items are consumed
                const availableQty = parseFloat(inv.availableQty);
                const newAvailableQty = Math.max(0, availableQty - existingCarton.totalPacks);

                await tx
                    .update(inventory)
                    .set({
                        inCartonQty: newInCartonQty.toFixed(2),
                        activeCartonCount: newActiveCount,
                        availableQty: newAvailableQty.toFixed(2),
                    })
                    .where(eq(inventory.id, inv.id));
            });

            return { success: true, message: "Carton marked as empty" };
        }),

    /**
     * Update carton price and delivery cost for an existing active carton.
     */
    updateCartonPrice: warehouseProcedure
        .input(
            z.object({
                cartonId: z.number().int(),
                cartonPrice: z.string().optional(),
                deliveryCostPerUnit: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const existingCarton = await db.query.carton.findFirst({
                where: and(
                    eq(carton.id, input.cartonId),
                    eq(carton.warehouseId, userId),
                ),
            });

            if (!existingCarton) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Carton not found or doesn't belong to your warehouse",
                });
            }

            const updateData: Record<string, any> = {};
            if (input.cartonPrice !== undefined) updateData.cartonPrice = input.cartonPrice;
            if (input.deliveryCostPerUnit !== undefined) updateData.deliveryCostPerUnit = input.deliveryCostPerUnit;

            if (Object.keys(updateData).length === 0) {
                return { success: true, message: "Nothing to update" };
            }

            // Update the target carton
            await db
                .update(carton)
                .set(updateData)
                .where(eq(carton.id, input.cartonId));

            // Also propagate to sibling active cartons of the same variant
            // that currently have no price set (batch-created cartons start with null)
            const siblingUpdateData: Record<string, any> = {};
            if (input.cartonPrice !== undefined) {
                siblingUpdateData.cartonPrice = input.cartonPrice;
            }
            if (input.deliveryCostPerUnit !== undefined) {
                siblingUpdateData.deliveryCostPerUnit = input.deliveryCostPerUnit;
            }

            if (Object.keys(siblingUpdateData).length > 0) {
                const conditions = [
                    eq(carton.warehouseId, userId),
                    eq(carton.variantId, existingCarton.variantId),
                    eq(carton.status, "active"),
                    sql`${carton.id} != ${input.cartonId}`,
                ];

                // Only update siblings that have null for the fields being set
                if (input.cartonPrice !== undefined) {
                    conditions.push(sql`${carton.cartonPrice} IS NULL`);
                }

                await db
                    .update(carton)
                    .set(siblingUpdateData)
                    .where(and(...conditions));
            }

            return { success: true, message: "Carton price updated" };
        }),

    /**
     * Unit/Carton Inventory — product-level view showing unit stock
     * split between loose and in-carton, with carton breakdown per config.
     */
    getUnitCartonInventory: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
                categoryId: z.number().int().optional(),
                viewMode: z.enum(["all", "loose", "in_carton"]).optional().default("all"),
                page: z.number().int().min(1).optional().default(1),
                pageSize: z.number().int().min(1).max(100).optional().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // 1. Fetch all inventory items with deep relations
            const items = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, userId),
                ),
                with: {
                    variant: {
                        with: {
                            brand: { columns: { id: true, name: true } },
                            sourceVariantOption: { columns: { id: true, name: true } },
                            product: {
                                with: {
                                    category: { columns: { id: true, name: true } },
                                    coreProduct: { columns: { id: true, name: true, image: true } },
                                    brand: { columns: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
            });

            // 2. Fetch carton configs for all variants to compute in-carton allocation
            //    (matches the stock list page logic — don't rely solely on inCartonQty)
            const allVariantIds = items
                .map((i) => i.variant?.id)
                .filter((id): id is number => id !== undefined);

            const cartonConfigLookup = new Map<number, { packsPerCarton: number }>();
            if (allVariantIds.length > 0) {
                const configs = await db
                    .select({
                        variantId: cartonConfig.variantId,
                        packsPerCarton: cartonConfig.packsPerCarton,
                        isDefault: cartonConfig.isDefault,
                    })
                    .from(cartonConfig)
                    .where(
                        and(
                            inArray(cartonConfig.variantId, allVariantIds),
                            eq(cartonConfig.isActive, true),
                        ),
                    );
                for (const c of configs) {
                    // Prefer default config, otherwise first one
                    if (!cartonConfigLookup.has(c.variantId) || c.isDefault) {
                        cartonConfigLookup.set(c.variantId, { packsPerCarton: c.packsPerCarton });
                    }
                }
            }

            // 3. Build flat list with carton tracking data
            type UnitItem = {
                inventoryId: number;
                variantId: number;
                productId: number;
                productName: string;
                productImage: string;
                coreProductId: number | null;
                coreProductName: string;
                categoryId: number | null;
                categoryName: string;
                brandName: string;
                variantLabel: string;
                unitLabel: string;
                sku: string;
                color: string;
                size: string;
                packType: string;
                weightKg: number;
                totalUnits: number;
                looseUnits: number;
                inCartonUnits: number;
                reservedUnits: number;
                availableUnits: number;
                activeCartonCount: number;
            };

            const unitItems: UnitItem[] = [];

            for (const item of items) {
                const v = item.variant;
                if (!v || !v.product) continue;
                const p = v.product;
                const brandInfo = v.brand || (p as any).brand;
                const core = p.coreProduct;
                const cat = p.category;

                const totalUnits = parseFloat(item.availableQty || "0");
                const dbInCartonQty = parseFloat(item.inCartonQty || "0");
                const reservedUnits = parseFloat(item.reservedQty || "0");
                const availableUnits = Math.max(0, totalUnits - reservedUnits);

                // Compute in-carton vs loose (matching stock list page logic):
                // Priority: 1) physical carton tracking (inCartonQty)
                //           2) carton config computation
                //           3) packType-based classification
                const isLoose = v.packType === "loose" || v.packagingType === "loose";
                const cfg = cartonConfigLookup.get(v.id);
                let inCartonUnits: number;
                let looseUnits: number;

                if (dbInCartonQty > 0) {
                    // Physical cartons tracked in DB — use actual data
                    inCartonUnits = dbInCartonQty;
                    looseUnits = Math.max(0, totalUnits - inCartonUnits);
                } else if (cfg && cfg.packsPerCarton > 0 && !isLoose && totalUnits > 0) {
                    // Has carton config — compute carton allocation
                    const cartonCount = Math.floor(totalUnits / cfg.packsPerCarton);
                    inCartonUnits = cartonCount * cfg.packsPerCarton;
                    looseUnits = totalUnits - inCartonUnits;
                } else if (isLoose) {
                    // Loose variant — all stock is loose
                    inCartonUnits = 0;
                    looseUnits = totalUnits;
                } else {
                    // Packed variant (packet, sack, etc.) without carton config
                    // Not loose, but not in carton either
                    inCartonUnits = 0;
                    looseUnits = 0;
                }

                // Build variant label: "Brand + VariantOptionName"
                // Uses the admin-managed variant option name (e.g. "12KG Cylinder")
                const wKg = parseFloat(v.weightKg || "0");
                const optionName = (v as any).sourceVariantOption?.name as string | undefined;
                const parts: string[] = [];
                if (brandInfo?.name) parts.push(brandInfo.name);
                if (v.color) parts.push(v.color);
                if (v.size) parts.push(v.size);
                if (optionName) {
                    parts.push(optionName);
                } else if (wKg > 0) {
                    // Fallback for variants without a linked variant option
                    parts.push(`${wKg}${wKg >= 1 ? "KG" : "g"}`);
                }

                const variantLabel = parts.length > 0
                    ? parts.join(" + ")
                    : v.quantitySelectorLabel || v.sku || `Variant #${v.id}`;

                unitItems.push({
                    inventoryId: item.id,
                    variantId: v.id,
                    productId: p.id,
                    productName: core?.name ?? p.name,
                    productImage: core?.image ?? (p as any).image ?? "",
                    coreProductId: core?.id ?? null,
                    coreProductName: core?.name ?? p.name,
                    categoryId: cat?.id ?? null,
                    categoryName: cat?.name ?? "—",
                    brandName: brandInfo?.name ?? "—",
                    variantLabel,
                    unitLabel: v.unitLabel || "Pack",
                    sku: v.sku || "",
                    color: v.color || "",
                    size: v.size || "",
                    packType: v.packType || v.packagingType || "other",
                    weightKg: wKg,
                    totalUnits,
                    looseUnits,
                    inCartonUnits,
                    reservedUnits,
                    availableUnits,
                    activeCartonCount: item.activeCartonCount || 0,
                });
            }

            // 4. Apply filters
            let filtered = unitItems;

            if (input.categoryId) {
                filtered = filtered.filter((i) => i.categoryId === input.categoryId);
            }
            if (input.viewMode === "loose") {
                filtered = filtered.filter((i) => i.looseUnits > 0);
            } else if (input.viewMode === "in_carton") {
                filtered = filtered.filter((i) => i.inCartonUnits > 0);
            }
            if (input.search?.trim()) {
                const s = input.search.trim().toLowerCase();
                filtered = filtered.filter(
                    (i) =>
                        i.productName.toLowerCase().includes(s) ||
                        i.brandName.toLowerCase().includes(s) ||
                        i.variantLabel.toLowerCase().includes(s),
                );
            }

            // 5. Compute summary from filtered items
            const summary = {
                totalUnits: filtered.reduce((s, i) => s + i.totalUnits, 0),
                looseUnits: filtered.reduce((s, i) => s + i.looseUnits, 0),
                inCartonUnits: filtered.reduce((s, i) => s + i.inCartonUnits, 0),
            };

            // 6. Sort and paginate
            filtered.sort((a, b) => a.productName.localeCompare(b.productName));
            const totalCount = filtered.length;
            const totalPages = Math.ceil(totalCount / input.pageSize);
            const paginated = filtered.slice(
                (input.page - 1) * input.pageSize,
                input.page * input.pageSize,
            );

            // 7. Get carton breakdown for paginated variant IDs
            //    Shows BOTH physical cartons AND computed allocation from carton config
            const paginatedVariantIds = paginated.map((i) => i.variantId);
            const cartonBreakdownMap = new Map<number, Array<{
                configLabel: string;
                unitsPerCarton: number;
                cartonCount: number;
                totalUnits: number;
            }>>();

            if (paginatedVariantIds.length > 0) {
                // Get active physical cartons grouped by variant + config
                const cartonRows = await db
                    .select({
                        variantId: carton.variantId,
                        configId: carton.cartonConfigId,
                        configLabel: cartonConfig.label,
                        packsPerCarton: cartonConfig.packsPerCarton,
                        cartonCount: count(),
                        totalPacks: sql<string>`SUM(${carton.totalPacks})`,
                    })
                    .from(carton)
                    .leftJoin(cartonConfig, eq(carton.cartonConfigId, cartonConfig.id))
                    .where(
                        and(
                            eq(carton.warehouseId, userId),
                            eq(carton.status, "active"),
                            inArray(carton.variantId, paginatedVariantIds),
                        ),
                    )
                    .groupBy(
                        carton.variantId,
                        carton.cartonConfigId,
                        cartonConfig.label,
                        cartonConfig.packsPerCarton,
                    );

                for (const row of cartonRows) {
                    if (!cartonBreakdownMap.has(row.variantId)) {
                        cartonBreakdownMap.set(row.variantId, []);
                    }
                    cartonBreakdownMap.get(row.variantId)!.push({
                        configLabel: row.configLabel || `${row.packsPerCarton} Pack Carton`,
                        unitsPerCarton: row.packsPerCarton || 0,
                        cartonCount: Number(row.cartonCount),
                        totalUnits: parseFloat(row.totalPacks || "0"),
                    });
                }

                // For variants with carton config but NO physical cartons,
                // compute theoretical carton allocation so the breakdown still shows
                for (const item of paginated) {
                    if (cartonBreakdownMap.has(item.variantId)) continue; // already has physical cartons
                    const cfg = cartonConfigLookup.get(item.variantId);
                    if (!cfg || cfg.packsPerCarton <= 0 || item.totalUnits <= 0) continue;
                    if (item.packType === "loose") continue;

                    const cartonCount = Math.floor(item.totalUnits / cfg.packsPerCarton);
                    if (cartonCount > 0) {
                        cartonBreakdownMap.set(item.variantId, [{
                            configLabel: `${cfg.packsPerCarton} Pack Carton`,
                            unitsPerCarton: cfg.packsPerCarton,
                            cartonCount,
                            totalUnits: cartonCount * cfg.packsPerCarton,
                        }]);
                    }
                }
            }

            // 8. Return items with carton breakdown
            const responseItems = paginated.map((item) => ({
                ...item,
                cartonBreakdown: cartonBreakdownMap.get(item.variantId) || [],
            }));

            return {
                items: responseItems,
                summary,
                totalCount,
                page: input.page,
                pageSize: input.pageSize,
                totalPages,
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Expiry Tracking
// ────────────────────────────────────────────────────────────────

const expiryQueries = {
    /**
     * Get expired / near-expiry stock batches for this warehouse.
     * Only includes products where expiryEnabled = true.
     */
    getExpiredProducts: warehouseProcedure
        .input(
            z.object({
                status: z.enum(["all", "expired", "nearExpiry"]).default("all"),
                categoryId: z.number().optional(),
                supplierId: z.number().optional(),
                search: z.string().optional(),
                nearExpiryDays: z.number().default(30),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const today = new Date();
            const nearExpiryThreshold = new Date();
            nearExpiryThreshold.setDate(today.getDate() + input.nearExpiryDays);

            const entries = await db.query.stockEntry.findMany({
                where: and(
                    eq(stockEntry.warehouseId, userId),
                    sql`${stockEntry.expiryDate} IS NOT NULL`,
                ),
                orderBy: [stockEntry.expiryDate],
                with: {
                    variant: {
                        with: {
                            brand: { columns: { id: true, name: true } },
                            product: {
                                columns: {
                                    id: true,
                                    name: true,
                                    image: true,
                                    expiryEnabled: true,
                                    categoryId: true,
                                },
                                with: {
                                    category: { columns: { id: true, name: true, slug: true } },
                                    coreProduct: { columns: { id: true, name: true, image: true } },
                                },
                            },
                        },
                    },
                    supplier: {
                        columns: { id: true, name: true, company: true },
                    },
                    storageArea: {
                        columns: { id: true, name: true },
                    },
                },
            });

            const expiryEntries = entries.filter((entry) => {
                const product = entry.variant?.product;
                return product && product.expiryEnabled === true;
            });

            type ExpiryStatus = "expired" | "nearExpiry" | "safe";

            type ExpiryItem = {
                stockEntryId: number;
                batchNo: string;
                expiryDate: string;
                manufactureDate: string | null;
                quantity: string;
                quantityUnit: string;
                convertedQtyPacks: string;
                purchasePrice: string;
                totalCost: string;
                entryType: string;
                reference: string | null;
                note: string | null;
                shelfRack: string | null;
                createdAt: Date;
                productId: number;
                productName: string;
                productImage: string;
                coreProductName: string;
                coreProductImage: string;
                categoryId: number;
                categoryName: string;
                variantId: number;
                variantLabel: string;
                brandName: string;
                supplierId: number | null;
                supplierName: string;
                storageAreaName: string | null;
                expiryStatus: ExpiryStatus;
                daysUntilExpiry: number;
                lossValue: string;
            };

            const items: ExpiryItem[] = [];

            for (const entry of expiryEntries) {
                const variant = entry.variant;
                if (!variant || !variant.product) continue;

                const product = variant.product;
                const expiryDate = new Date(entry.expiryDate!);
                const diffMs = expiryDate.getTime() - today.getTime();
                const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                let expiryStatus: ExpiryStatus;
                if (daysUntilExpiry < 0) {
                    expiryStatus = "expired";
                } else if (expiryDate <= nearExpiryThreshold) {
                    expiryStatus = "nearExpiry";
                } else {
                    expiryStatus = "safe";
                }

                const labelParts: string[] = [];
                const brandName = variant.brand?.name || "";
                if (brandName) labelParts.push(brandName);
                const weightKg = Number(variant.weightKg || 0);
                if (weightKg > 0) labelParts.push(`${weightKg}KG`);
                if (variant.packagingType && variant.packagingType !== "loose") {
                    labelParts.push(variant.packagingType.charAt(0).toUpperCase() + variant.packagingType.slice(1));
                }
                const variantLabel = labelParts.length > 0
                    ? labelParts.join(" + ")
                    : variant.unitLabel || `Variant #${variant.id}`;

                const coreProduct = (product as any).coreProduct;

                items.push({
                    stockEntryId: entry.id,
                    batchNo: entry.batchNo || `B-${entry.id}`,
                    expiryDate: entry.expiryDate!,
                    manufactureDate: entry.manufactureDate || null,
                    quantity: entry.quantity,
                    quantityUnit: entry.quantityUnit,
                    convertedQtyPacks: entry.convertedQtyPacks,
                    purchasePrice: entry.purchasePrice,
                    totalCost: entry.totalCost,
                    entryType: entry.entryType,
                    reference: entry.reference || null,
                    note: entry.note || null,
                    shelfRack: entry.shelfRack || null,
                    createdAt: entry.createdAt,
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image || "",
                    coreProductName: coreProduct?.name || product.name,
                    coreProductImage: coreProduct?.image || product.image || "",
                    categoryId: product.categoryId,
                    categoryName: product.category?.name || "—",
                    variantId: variant.id,
                    variantLabel,
                    brandName,
                    supplierId: entry.supplierId,
                    supplierName: entry.supplier?.name || entry.supplier?.company || "—",
                    storageAreaName: entry.storageArea?.name || null,
                    expiryStatus,
                    daysUntilExpiry,
                    lossValue: expiryStatus === "expired" ? entry.totalCost : "0",
                });
            }

            let filtered = items;

            if (input.status === "expired") {
                filtered = filtered.filter((item) => item.expiryStatus === "expired");
            } else if (input.status === "nearExpiry") {
                filtered = filtered.filter((item) => item.expiryStatus === "nearExpiry");
            } else {
                filtered = filtered.filter((item) => item.expiryStatus !== "safe");
            }

            if (input.categoryId) {
                filtered = filtered.filter((item) => item.categoryId === input.categoryId);
            }
            if (input.supplierId) {
                filtered = filtered.filter((item) => item.supplierId === input.supplierId);
            }
            if (input.search?.trim()) {
                const searchTerm = input.search.trim().toLowerCase();
                filtered = filtered.filter(
                    (item) =>
                        item.productName.toLowerCase().includes(searchTerm)
                        || item.coreProductName.toLowerCase().includes(searchTerm)
                        || item.brandName.toLowerCase().includes(searchTerm)
                        || item.batchNo.toLowerCase().includes(searchTerm)
                        || item.variantLabel.toLowerCase().includes(searchTerm),
                );
            }

            filtered.sort((left, right) => {
                if (left.expiryStatus === "expired" && right.expiryStatus !== "expired") return -1;
                if (left.expiryStatus !== "expired" && right.expiryStatus === "expired") return 1;
                return left.daysUntilExpiry - right.daysUntilExpiry;
            });

            const totalExpiredBatches = items.filter((item) => item.expiryStatus === "expired").length;
            const totalNearExpiryBatches = items.filter((item) => item.expiryStatus === "nearExpiry").length;
            const totalExpiredQty = items
                .filter((item) => item.expiryStatus === "expired")
                .reduce((sumValue, item) => sumValue + Number(item.quantity), 0);
            const totalLossValue = items
                .filter((item) => item.expiryStatus === "expired")
                .reduce((sumValue, item) => sumValue + Number(item.totalCost), 0);
            const totalNearExpiryQty = items
                .filter((item) => item.expiryStatus === "nearExpiry")
                .reduce((sumValue, item) => sumValue + Number(item.quantity), 0);

            const categoryMap = new Map<string, { name: string; expiredQty: number; nearExpiryQty: number; lossValue: number }>();
            for (const item of items.filter((row) => row.expiryStatus !== "safe")) {
                const existing = categoryMap.get(item.categoryName) || {
                    name: item.categoryName,
                    expiredQty: 0,
                    nearExpiryQty: 0,
                    lossValue: 0,
                };

                if (item.expiryStatus === "expired") {
                    existing.expiredQty += Number(item.quantity);
                    existing.lossValue += Number(item.totalCost);
                } else {
                    existing.nearExpiryQty += Number(item.quantity);
                }

                categoryMap.set(item.categoryName, existing);
            }

            const categoryOptions = new Map<number, string>();
            const supplierOptions = new Map<number, string>();
            for (const item of items) {
                categoryOptions.set(item.categoryId, item.categoryName);
                if (item.supplierId !== null) {
                    supplierOptions.set(item.supplierId, item.supplierName);
                }
            }

            const alerts = items
                .filter((item) => item.expiryStatus === "expired" && Number(item.quantity) > 0)
                .slice(0, 5)
                .map((item) => ({
                    productName: item.coreProductName,
                    variantLabel: item.variantLabel,
                    quantity: item.quantity,
                    quantityUnit: item.quantityUnit,
                    daysExpired: Math.abs(item.daysUntilExpiry),
                    lossValue: item.totalCost,
                }));

            const urgentNearExpiry = items
                .filter((item) => item.expiryStatus === "nearExpiry" && item.daysUntilExpiry <= 7)
                .slice(0, 5)
                .map((item) => ({
                    productName: item.coreProductName,
                    variantLabel: item.variantLabel,
                    quantity: item.quantity,
                    quantityUnit: item.quantityUnit,
                    daysUntilExpiry: item.daysUntilExpiry,
                }));

            return {
                items: filtered,
                stats: {
                    totalExpiredBatches,
                    totalNearExpiryBatches,
                    totalExpiredQty,
                    totalNearExpiryQty,
                    totalLossValue,
                },
                categoryAnalytics: Array.from(categoryMap.values())
                    .sort((left, right) => (right.expiredQty + right.nearExpiryQty) - (left.expiredQty + left.nearExpiryQty)),
                alerts: {
                    expired: alerts,
                    nearExpiry: urgentNearExpiry,
                },
                filterOptions: {
                    categories: Array.from(categoryOptions.entries())
                        .map(([id, name]) => ({ id, name }))
                        .sort((left, right) => left.name.localeCompare(right.name)),
                    suppliers: Array.from(supplierOptions.entries())
                        .map(([id, name]) => ({ id, name }))
                        .sort((left, right) => left.name.localeCompare(right.name)),
                },
            };
        }),
};

// ────────────────────────────────────────────────────────────────
// Export combined router
// ────────────────────────────────────────────────────────────────


export const warehouseRouter = {
    ...storefrontQueries,
    ...storeConnectionQueries,
    ...managementQueries,
    ...orderQueries,
    ...variantQueries,
    ...supplierQueries,
    ...purchaseQueries,
    ...productActivation,
    ...catalogBrowse,
    ...productRequests,
    ...warehouseProductCreation,
    ...stockEntryQueries,
    ...storageAreaQueries,
    ...pricingQueries,
    ...cartonQueries,
    ...expiryQueries,
};
