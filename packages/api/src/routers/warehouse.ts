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
    stockLedger,
    user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { localDateStamp } from "../utils/date";
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

            // Auto-generate invoice when order is confirmed (no admin approval needed)
            if (input.status === "confirmed") {
                try {
                    const { generateInvoiceFromOrder } = await import("./helpers/generate-invoice");
                    await generateInvoiceFromOrder(input.orderId);
                } catch (err: any) {
                    // Ignore "already exists" error (idempotent), re-throw others
                    if (!err.message?.includes("already exists")) {
                        console.error("Invoice generation failed:", err);
                    }
                }
            }

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
                                    availableQty: sql`(CAST(${inventory.availableQty} AS numeric) + ${existingItem.quantity})::text`,
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
                                    availableQty: sql`(CAST(${inventory.availableQty} AS numeric) - ${diff})::text`,
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
    stockLedger,
    product as productTable,
    productVariant,
} from "@bikalpo-project/db/schema";

// ────────────────────────────────────────────────────────────────
// Product Variant Search (for purchase form)
// ────────────────────────────────────────────────────────────────

const variantQueries = {
    // Search product variants for the purchase form dropdown
    searchVariants: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
            }),
        )
        .handler(async ({ input }) => {
            const conditions: SQL[] = [eq(productTable.status, "active")];

            if (input.search) {
                conditions.push(
                    sql`${productTable.name} ILIKE ${`%${input.search}%`}`,
                );
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

            return { variants: results };
        }),
};

const supplierQueries = {
    // Get all suppliers for the current warehouse
    getSuppliers: warehouseProcedure
        .input(
            z.object({
                search: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const conditions: SQL[] = [eq(supplier.addedBy, userId)];

            if (input.search) {
                conditions.push(
                    sql`(${supplier.name} ILIKE ${`%${input.search}%`} OR ${supplier.company} ILIKE ${`%${input.search}%`})`,
                );
            }

            const suppliers = await db
                .select()
                .from(supplier)
                .where(and(...conditions))
                .orderBy(desc(supplier.createdAt));

            return { suppliers };
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
                isActive: z.boolean().optional(),
                status: z.enum(["active", "suspended"]).optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [updated] = await db
                .update(supplier)
                .set({
                    name: input.name,
                    company: input.company || null,
                    contactPerson: input.contactPerson || null,
                    phone: input.phone || null,
                    email: input.email || null,
                    address: input.address || null,
                    notes: input.notes || null,
                    creditLimit: input.creditLimit ?? undefined,
                    returnPackAgreement: input.returnPackAgreement ?? undefined,
                    isActive: input.isActive,
                    status: input.status ?? undefined,
                })
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

                        // Get updated balance for ledger
                        const updatedInv = await tx.query.inventory.findFirst({
                            where: and(
                                eq(inventory.ownerType, "warehouse"),
                                eq(inventory.ownerId, userId),
                                eq(inventory.variantId, item.variantId),
                            ),
                        });

                        // Create stock ledger entry
                        await tx.insert(stockLedger).values({
                            variantId: item.variantId,
                            ownerType: "warehouse",
                            ownerId: userId,
                            changeType: "in",
                            qty: qty.toFixed(2),
                            reason: `Purchase received: ${existingPurchase.purchaseNumber}`,
                            referenceType: "manual",
                            referenceId: existingPurchase.id.toString(),
                            balanceAfter: updatedInv?.availableQty || qty.toFixed(2),
                            createdById: userId,
                        });
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
                    brand: { columns: { name: true } },
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

            // Write stock ledger entry for initial stock
            if (Number(input.initialStock) > 0) {
                await db.insert(stockLedger).values({
                    variantId: input.variantId,
                    ownerType: "warehouse",
                    ownerId: userId,
                    changeType: "in" as const,
                    qty: input.initialStock,
                    reason: "Initial stock added to warehouse inventory",
                    referenceType: "manual" as const,
                    balanceAfter: input.initialStock,
                    createdById: userId,
                });
            }

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

            // Write stock ledger entry if quantity changed
            if (input.availableQty !== undefined) {
                const oldQty = Number(existing.availableQty);
                const newQty = Number(input.availableQty);
                const diff = newQty - oldQty;

                if (diff !== 0) {
                    await db.insert(stockLedger).values({
                        variantId: existing.variantId,
                        ownerType: "warehouse",
                        ownerId: userId,
                        changeType: (diff > 0 ? "in" : "adjust") as "in" | "adjust",
                        qty: Math.abs(diff).toFixed(2),
                        reason: diff > 0
                            ? `Warehouse stock increased by ${diff.toFixed(2)}`
                            : `Warehouse stock adjusted by ${diff.toFixed(2)}`,
                        referenceType: "manual" as const,
                        balanceAfter: input.availableQty,
                        createdById: userId,
                    });
                }
            }

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
// Export combined router
// ────────────────────────────────────────────────────────────────

export const warehouseRouter = {
    ...storefrontQueries,
    ...managementQueries,
    ...orderQueries,
    ...variantQueries,
    ...supplierQueries,
    ...purchaseQueries,
    ...productActivation,
};
