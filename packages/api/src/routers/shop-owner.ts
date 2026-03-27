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
import {
    brand,
    category,
    product,
    productReview,
    productVariant,
    subCategory,
    inventory,
    order,
    orderItem,
    user,
    area,
    sellerAreaMapping,
    openOrderBid,
    openOrderBidItem,
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
    or,
    sql,
    sum,
    type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { shopOwnerProcedure } from "../index";
import {
    isSellerAuthorizedForArea,
    calculateSellerDistance,
} from "../services/location-service";
import {
    DEFAULT_LOCK_TIMEOUT_SECONDS,
    checkAndExpireBids,
} from "../services/open-order-matching";

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

            // Brand filter
            if (brandSlug) {
                const b = await db.query.brand.findFirst({
                    where: eq(brand.slug, brandSlug),
                });
                if (b) conditions.push(eq(product.brandId, b.id));
            }

            // Price filter (on product base price)
            if (minPrice) conditions.push(gte(product.price, minPrice));
            if (maxPrice) conditions.push(lte(product.price, maxPrice));

            // In stock filter
            const inStock = inStockStr === "true";
            if (inStock) conditions.push(sql`${product.stockQuantity} > 0`);

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
                        return [desc(product.stockQuantity)];
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
                        brand: true,
                        images: true,
                    },
                    orderBy: getOrderBy(),
                    limit,
                    offset,
                }),
                db.select({ count: count() }).from(product).where(whereClause),
            ]);

            const totalCount = countResult[0]?.count || 0;
            return {
                products,
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
                    brand: { columns: { id: true, name: true, slug: true, logo: true } },
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
                                    brand: { columns: { name: true } },
                                    images: { limit: 1 },
                                },
                            },
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
     * Creates order + items, deducts warehouse inventory.
     */
    placeWarehouseOrder: shopOwnerProcedure
        .input(
            z.object({
                warehouseSlug: z.string(),
                items: z.array(
                    z.object({
                        variantId: z.number(),
                        quantity: z.number().min(1),
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
                                    columns: { id: true, name: true, image: true, size: true },
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
                if (availableQty < item.quantity) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: `Insufficient stock for ${inv.variant?.product?.name || "product"}. Available: ${availableQty}, requested: ${item.quantity}`,
                    });
                }

                const rp = Number(inv.retailPrice || 0);
                const vp = Number(inv.variant?.price || 0);
                const unitPrice = rp > 0 ? inv.retailPrice! : vp > 0 ? inv.variant!.price! : "0";
                const totalPrice = (Number(unitPrice) * item.quantity).toFixed(2);

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
                    });
                }

                // Deduct inventory
                for (const item of validatedItems) {
                    const newQty = (Number(item.currentQty) - item.quantity).toFixed(2);
                    await tx
                        .update(inventory)
                        .set({ availableQty: newQty })
                        .where(eq(inventory.id, item.inventoryId));
                }

                return newOrder!;
            });

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
};
