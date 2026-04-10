import { db } from "@bikalpo-project/db";
import {
    area,
    deliveryGroup,
    deliveryGroupInvoice,
    invoice,
    order,
    orderItem,
    product,
    sellerApplication,
    supplier,
    warehouseApplication,
    supportTicket,
    itemRequest,
    user,
} from "@bikalpo-project/db/schema";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { adminProcedure } from "../index";

/** Safe wrapper – if a query throws, return the fallback value instead of crashing the entire handler */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        console.error("[Dashboard] query failed:", err);
        return fallback;
    }
}

export const dashboardRouter = {
    /**
     * Get admin dashboard statistics – B2B + B2C overview
     * REST: GET /dashboard/stats
     */
    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/dashboard/stats",
            tags: ["Dashboard"],
            summary: "Get admin dashboard stats",
            description:
                "Comprehensive admin dashboard statistics for B2B + B2C platform overview",
        })
        .handler(async () => {
            // Get today's start
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // ─── PRIMARY KPIs ───────────────────────────────────────────

            const totalUsers = await safe(async () => {
                const r = await db.select({ count: count() }).from(user);
                return Number(r[0]?.count ?? 0);
            }, 0);

            const newUsersToday = await safe(async () => {
                const r = await db.select({ count: count() }).from(user)
                    .where(gte(user.createdAt, today));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const { totalOrders, totalGMV } = await safe(async () => {
                const r = await db
                    .select({
                        count: count(),
                        revenue: sql<number>`COALESCE(SUM(${order.total}::numeric), 0)::numeric`,
                    })
                    .from(order);
                return {
                    totalOrders: Number(r[0]?.count ?? 0),
                    totalGMV: Number(r[0]?.revenue ?? 0),
                };
            }, { totalOrders: 0, totalGMV: 0 });

            const { ordersToday, revenueToday } = await safe(async () => {
                const r = await db
                    .select({
                        count: count(),
                        revenue: sql<number>`COALESCE(SUM(${order.total}::numeric), 0)::numeric`,
                    })
                    .from(order)
                    .where(gte(order.createdAt, today));
                return {
                    ordersToday: Number(r[0]?.count ?? 0),
                    revenueToday: Number(r[0]?.revenue ?? 0),
                };
            }, { ordersToday: 0, revenueToday: 0 });

            // ─── ORDER TYPE BREAKDOWN (B2B vs B2C) ──────────────────────

            const b2bOrders = await safe(async () => {
                const r = await db.select({ count: count() }).from(order)
                    .where(eq(order.orderType, "b2b"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const b2cOrders = await safe(async () => {
                const r = await db.select({ count: count() }).from(order)
                    .where(eq(order.orderType, "b2c"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            // ─── SECONDARY KPIs ─────────────────────────────────────────

            const pendingOrders = await safe(async () => {
                const r = await db.select({ count: count() }).from(order)
                    .where(sql`${order.status} IN ('pending', 'confirmed', 'processing')`);
                return Number(r[0]?.count ?? 0);
            }, 0);

            const cancelledToday = await safe(async () => {
                const r = await db.select({ count: count() }).from(order)
                    .where(and(eq(order.status, "cancelled"), gte(order.cancelledAt, today)));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const cancelledTotal = await safe(async () => {
                const r = await db.select({ count: count() }).from(order)
                    .where(eq(order.status, "cancelled"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const pendingInvoices = await safe(async () => {
                const r = await db.select({ count: count() }).from(invoice)
                    .where(sql`${invoice.deliveryStatus} IN ('not_assigned', 'pending')`);
                return Number(r[0]?.count ?? 0);
            }, 0);

            const activeDeliveries = await safe(async () => {
                const r = await db.select({ count: count() }).from(deliveryGroup)
                    .where(eq(deliveryGroup.status, "out_for_delivery"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const deliveriesToday = await safe(async () => {
                const r = await db.select({ count: count() }).from(deliveryGroupInvoice)
                    .where(and(
                        eq(deliveryGroupInvoice.status, "delivered"),
                        gte(deliveryGroupInvoice.deliveredAt, today),
                    ));
                return Number(r[0]?.count ?? 0);
            }, 0);

            // ─── USER DISTRIBUTION ──────────────────────────────────────

            const totalConsumers = await safe(async () => {
                const r = await db.select({ count: count() }).from(user)
                    .where(sql`${user.role} IN ('consumer', 'customer') OR ${user.role} IS NULL`);
                return Number(r[0]?.count ?? 0);
            }, 0);

            const totalRetailers = await safe(async () => {
                const r = await db.select({ count: count() }).from(user)
                    .where(and(eq(user.role, "shop_owner"), eq(user.isSeller, true)));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const totalWholesalers = await safe(async () => {
                const r = await db.select({ count: count() }).from(user)
                    .where(and(eq(user.role, "shop_owner"), eq(user.isSeller, false)));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const totalWarehouses = await safe(async () => {
                const r = await db.select({ count: count() }).from(user)
                    .where(eq(user.role, "warehouse"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const totalDeliverymen = await safe(async () => {
                const r = await db.select({ count: count() }).from(user)
                    .where(eq(user.role, "deliveryman"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const totalAdmins = await safe(async () => {
                const r = await db.select({ count: count() }).from(user)
                    .where(sql`${user.role} IN ('admin', 'superadmin')`);
                return Number(r[0]?.count ?? 0);
            }, 0);

            // ─── ALERTS & REQUESTS ──────────────────────────────────────

            const openTickets = await safe(async () => {
                const r = await db.select({ count: count() }).from(supportTicket)
                    .where(sql`${supportTicket.status} IN ('open', 'in_progress')`);
                return Number(r[0]?.count ?? 0);
            }, 0);

            const pendingItemRequests = await safe(async () => {
                const r = await db.select({ count: count() }).from(itemRequest)
                    .where(eq(itemRequest.status, "pending"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const pendingSellerApps = await safe(async () => {
                const r = await db.select({ count: count() }).from(sellerApplication)
                    .where(eq(sellerApplication.status, "pending"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            const lowStockProducts = await safe(async () => {
                const r = await db.select({ count: count() }).from(product)
                    .where(sql`${product.stockQuantity} <= ${product.reorderLevel} AND ${product.stockQuantity} > 0 AND ${product.status}::text = 'active'`);
                return Number(r[0]?.count ?? 0);
            }, 0);

            const outOfStockProducts = await safe(async () => {
                const r = await db.select({ count: count() }).from(product)
                    .where(sql`${product.stockQuantity} <= 0 AND ${product.status}::text = 'active'`);
                return Number(r[0]?.count ?? 0);
            }, 0);

            const totalProducts = await safe(async () => {
                const r = await db.select({ count: count() }).from(product)
                    .where(eq(product.status, "active"));
                return Number(r[0]?.count ?? 0);
            }, 0);

            // ─── RECENT ORDERS ──────────────────────────────────────────

            const recentOrders = await safe(async () => {
                const data = await db.query.order.findMany({
                    orderBy: [desc(order.createdAt)],
                    limit: 8,
                    with: {
                        user: {
                            columns: {
                                name: true,
                                shopName: true,
                            },
                        },
                    },
                });

                return data.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    customerName: o.user?.shopName || o.user?.name || "Unknown",
                    total: Number(o.total),
                    status: o.status,
                    orderType: o.orderType || "b2c",
                    createdAt: o.createdAt,
                }));
            }, []);

            // ─── SUBSCRIPTION STATUS ────────────────────────────────────

            const subscriptions = await safe(async () => {
                // Plan durations in days
                const TRIAL_DAYS = 14;
                const EXPIRING_THRESHOLD_DAYS = 3;
                const now = new Date();

                // Fetch all approved seller applications with plan + approval date
                const sellerRows = await db
                    .select({
                        plan: sellerApplication.selectedPlan,
                        approvedAt: sellerApplication.reviewedAt,
                        createdAt: sellerApplication.createdAt,
                    })
                    .from(sellerApplication)
                    .where(eq(sellerApplication.status, "approved"));

                // Fetch all approved warehouse applications
                const warehouseRows = await db
                    .select({
                        plan: warehouseApplication.selectedPlan,
                        approvedAt: warehouseApplication.reviewedAt,
                        createdAt: warehouseApplication.createdAt,
                    })
                    .from(warehouseApplication)
                    .where(eq(warehouseApplication.status, "approved"));

                let active = 0;
                let expiringSoon = 0;
                let expired = 0;
                let freeTrial = 0;
                let starter = 0;
                let growth = 0;

                const allRows = [...sellerRows, ...warehouseRows];

                for (const row of allRows) {
                    const plan = row.plan || "free_trial";

                    if (plan === "free_trial") {
                        // Trial accounts: time-limited (14 days from approval)
                        const startDate = row.approvedAt || row.createdAt;
                        const expiryDate = new Date(startDate);
                        expiryDate.setDate(expiryDate.getDate() + TRIAL_DAYS);

                        const daysUntilExpiry = Math.ceil(
                            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                        );

                        if (daysUntilExpiry <= 0) {
                            expired++;
                        } else if (daysUntilExpiry <= EXPIRING_THRESHOLD_DAYS) {
                            expiringSoon++;
                            freeTrial++;
                        } else {
                            active++;
                            freeTrial++;
                        }
                    } else {
                        // Paid plans (starter, growth): always active (recurring subscriptions)
                        active++;
                        if (plan === "starter") starter++;
                        else if (plan === "growth") growth++;
                    }
                }

                const totalActive = active + expiringSoon;

                return { totalActive, active, expiringSoon, expired, freeTrial, starter, growth };
            }, { totalActive: 0, active: 0, expiringSoon: 0, expired: 0, freeTrial: 0, starter: 0, growth: 0 });
            // ─── PERFORMANCE HIGHLIGHTS ──────────────────────────────────

            const topProduct = await safe(async () => {
                const result = await db
                    .select({
                        name: orderItem.productName,
                        totalQty: sql<number>`SUM(${orderItem.quantity})::int`,
                    })
                    .from(orderItem)
                    .groupBy(orderItem.productName)
                    .orderBy(sql`SUM(${orderItem.quantity}) DESC`)
                    .limit(1);
                return result[0] ? { name: result[0].name, value: Number(result[0].totalQty) } : null;
            }, null);

            const topSupplier = await safe(async () => {
                const result = await db
                    .select({
                        name: supplier.name,
                    })
                    .from(supplier)
                    .where(eq(supplier.isActive, true))
                    .orderBy(desc(supplier.currentPayable))
                    .limit(1);
                return result[0] ? { name: result[0].name } : null;
            }, null);

            const topArea = await safe(async () => {
                const result = await db
                    .select({
                        city: order.shippingCity,
                        count: count(),
                    })
                    .from(order)
                    .where(sql`${order.shippingCity} IS NOT NULL AND ${order.shippingCity} != ''`)
                    .groupBy(order.shippingCity)
                    .orderBy(sql`count(*) DESC`)
                    .limit(1);
                return result[0] ? { name: result[0].city, orders: Number(result[0].count) } : null;
            }, null);

            const performance = { topProduct, topSupplier, topArea };

            return {
                stats: {
                    totalUsers,
                    newUsersToday,
                    totalOrders,
                    ordersToday,
                    totalGMV,
                    revenueToday,
                    b2bOrders,
                    b2cOrders,
                    pendingOrders,
                    cancelledToday,
                    cancelledTotal,
                    pendingInvoices,
                    activeDeliveries,
                    deliveriesToday,
                    totalConsumers,
                    totalRetailers,
                    totalWholesalers,
                    totalWarehouses,
                    totalDeliverymen,
                    totalAdmins,
                    openTickets,
                    pendingItemRequests,
                    pendingSellerApps,
                    lowStockProducts,
                    outOfStockProducts,
                    totalProducts,
                    recentOrders,
                    subscriptions,
                    performance,
                },
            };
        }),
};
