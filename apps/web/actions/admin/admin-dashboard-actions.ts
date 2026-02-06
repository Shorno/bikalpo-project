"use server";

import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { deliveryGroup, deliveryGroupInvoice } from "@/db/schema/delivery";
import { invoice } from "@/db/schema/invoice";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";

export interface AdminDashboardStats {
  // Today's stats
  ordersToday: number;
  revenueToday: number;
  deliveriesToday: number;

  // Pending counts
  pendingOrders: number;
  pendingInvoices: number;
  activeDeliveries: number;

  // Totals
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;

  // Recent orders
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: Date;
  }>;
}

export async function getAdminDashboardStats(): Promise<{
  success: boolean;
  stats?: AdminDashboardStats;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Get today's start
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's orders and revenue
    const todayOrdersResult = await db
      .select({
        count: count(),
        revenue: sql<number>`COALESCE(SUM(${order.total}::numeric), 0)::numeric`,
      })
      .from(order)
      .where(gte(order.createdAt, today));

    const ordersToday = todayOrdersResult[0]?.count || 0;
    const revenueToday = Number(todayOrdersResult[0]?.revenue || 0);

    // Get today's deliveries completed
    const todayDeliveriesResult = await db
      .select({ count: count() })
      .from(deliveryGroupInvoice)
      .where(
        and(
          eq(deliveryGroupInvoice.status, "delivered"),
          gte(deliveryGroupInvoice.deliveredAt, today),
        ),
      );

    const deliveriesToday = todayDeliveriesResult[0]?.count || 0;

    // Get pending orders (confirmed or processing)
    const pendingOrdersResult = await db
      .select({ count: count() })
      .from(order)
      .where(sql`${order.status} IN ('pending', 'confirmed', 'processing')`);

    const pendingOrders = pendingOrdersResult[0]?.count || 0;

    // Get pending invoices (not_assigned or pending delivery)
    const pendingInvoicesResult = await db
      .select({ count: count() })
      .from(invoice)
      .where(sql`${invoice.deliveryStatus} IN ('not_assigned', 'pending')`);

    const pendingInvoices = pendingInvoicesResult[0]?.count || 0;

    // Get active deliveries (out_for_delivery)
    const activeDeliveriesResult = await db
      .select({ count: count() })
      .from(deliveryGroup)
      .where(eq(deliveryGroup.status, "out_for_delivery"));

    const activeDeliveries = activeDeliveriesResult[0]?.count || 0;

    // Get total orders and revenue
    const totalsResult = await db
      .select({
        count: count(),
        revenue: sql<number>`COALESCE(SUM(${order.total}::numeric), 0)::numeric`,
      })
      .from(order);

    const totalOrders = totalsResult[0]?.count || 0;
    const totalRevenue = Number(totalsResult[0]?.revenue || 0);

    // Get total customers (unique users with orders)
    const customersResult = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${order.userId})::int`,
      })
      .from(order);

    const totalCustomers = customersResult[0]?.count || 0;

    // Get recent orders
    const recentOrdersData = await db.query.order.findMany({
      orderBy: [desc(order.createdAt)],
      limit: 5,
      with: {
        user: {
          columns: {
            name: true,
            shopName: true,
          },
        },
      },
    });

    const recentOrders = recentOrdersData.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.user?.shopName || o.user?.name || "Unknown",
      total: Number(o.total),
      status: o.status,
      createdAt: o.createdAt,
    }));

    return {
      success: true,
      stats: {
        ordersToday,
        revenueToday,
        deliveriesToday,
        pendingOrders,
        pendingInvoices,
        activeDeliveries,
        totalOrders,
        totalRevenue,
        totalCustomers,
        recentOrders,
      },
    };
  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    return { success: false, error: "Failed to fetch dashboard stats" };
  }
}
