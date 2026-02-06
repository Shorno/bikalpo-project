"use server";

import { count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { itemRequest } from "@/db/schema/item-request";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";

export interface AccountOverview {
  // Order stats
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;

  // Other stats
  itemRequestsCount: number;

  // Recent orders
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    total: string;
    status: string;
    createdAt: Date;
    itemCount: number;
  }>;

  // User info
  userName: string;
  userEmail: string;
}

export async function getAccountOverview(): Promise<{
  success: boolean;
  error?: string;
  data?: AccountOverview;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const userId = session.user.id;

    // Get all orders for the user
    const orders = await db.query.order.findMany({
      where: eq(order.userId, userId),
      with: {
        items: true,
      },
      orderBy: [desc(order.createdAt)],
    });

    // Calculate stats
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const completedOrders = orders.filter(
      (o) => o.status === "delivered",
    ).length;
    const cancelledOrders = orders.filter(
      (o) => o.status === "cancelled",
    ).length;
    const totalSpent = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total), 0);

    // Get item requests count
    const [requestsResult] = await db
      .select({ count: count() })
      .from(itemRequest)
      .where(eq(itemRequest.customerId, userId));

    // Get recent 5 orders
    const recentOrders = orders.slice(0, 5).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
      itemCount: o.items?.length || 0,
    }));

    return {
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        totalSpent,
        itemRequestsCount: requestsResult?.count || 0,
        recentOrders,
        userName: session.user.name || "Customer",
        userEmail: session.user.email || "",
      },
    };
  } catch (error) {
    console.error("Error getting account overview:", error);
    return { success: false, error: "Failed to load account overview" };
  }
}
