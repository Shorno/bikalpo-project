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
    inventory,
    order,
    orderItem,
    user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
    and,
    count,
    desc,
    eq,
    inArray,
    sql,
    sum,
    type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, warehouseProcedure } from "../index";

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
                                    brand: { columns: { name: true, slug: true, logo: true } },
                                    images: { limit: 1 },
                                },
                            },
                        },
                    },
                },
            });

            // Filter in application layer
            let filtered = warehouseInventory.filter((inv) => {
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
                    if (prod.brand?.slug !== brandSlug) return false;
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
                            product: {
                                with: {
                                    category: { columns: { name: true, slug: true } },
                                    brand: { columns: { name: true } },
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

const orderQueries = {
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

            await db
                .update(order)
                .set(updateData)
                .where(eq(order.id, input.orderId));

            return {
                success: true,
                message: `Order ${existingOrder.orderNumber} updated to ${input.status}`,
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
// Export combined router
// ────────────────────────────────────────────────────────────────

export const warehouseRouter = {
    ...storefrontQueries,
    ...managementQueries,
    ...orderQueries,
};
