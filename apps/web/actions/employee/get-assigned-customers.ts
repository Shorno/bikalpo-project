"use server";

import { and, count, desc, eq, inArray, max, sum } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import { customerAssignment } from "@/db/schema/customer-assignment";
import { estimate } from "@/db/schema/estimate";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";

type User = typeof user.$inferSelect;
type Estimate = typeof estimate.$inferSelect;
type Order = typeof order.$inferSelect;

export type CustomerListItem = Pick<
  User,
  "id" | "name" | "email" | "phoneNumber" | "shopName" | "createdAt"
> & {
  totalEstimates: number;
  totalOrders: number;
  totalSpent: string;
  lastActivityAt: Date | null;
};

export type CustomerEstimate = Pick<
  Estimate,
  "id" | "estimateNumber" | "total" | "status" | "createdAt"
>;

export type CustomerOrder = Pick<
  Order,
  "id" | "orderNumber" | "total" | "status" | "paymentStatus" | "createdAt"
>;

export type CustomerDetails = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "phoneNumber"
  | "shopName"
  | "ownerName"
  | "createdAt"
> & {
  stats: {
    totalEstimates: number;
    totalOrders: number;
    totalSpent: string;
    pendingAmount: string;
  };
  estimates: CustomerEstimate[];
  orders: CustomerOrder[];
};

/**
 * Get customers for the current user
 * - Salesmen: Only see customers assigned to them
 * - Admin/Other roles: See all customers
 */
export async function getAssignedCustomers(): Promise<{
  success: boolean;
  customers?: CustomerListItem[];
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const currentUserId = session.user.id;
    const userRole = session.user.role;

    let customerIds: string[] = [];

    // If user is a salesman, get only assigned customer IDs
    if (userRole === "salesman") {
      const assignments = await db
        .select({ customerId: customerAssignment.customerId })
        .from(customerAssignment)
        .where(eq(customerAssignment.salesmanId, currentUserId));

      customerIds = assignments.map((a) => a.customerId);

      // If no customers assigned, return empty list
      if (customerIds.length === 0) {
        return { success: true, customers: [] };
      }
    }

    // Get customers (all or filtered by assignment)
    const customers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        shopName: user.shopName,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(
        userRole === "salesman"
          ? and(eq(user.role, "customer"), inArray(user.id, customerIds))
          : eq(user.role, "customer"),
      )
      .orderBy(desc(user.createdAt));

    // Get estimate counts per customer
    const estimateCounts = await db
      .select({
        customerId: estimate.customerId,
        count: count(),
      })
      .from(estimate)
      .groupBy(estimate.customerId);

    const estimateCountMap = new Map(
      estimateCounts.map((e) => [e.customerId, e.count]),
    );

    // Get order counts and totals per customer
    const orderStats = await db
      .select({
        userId: order.userId,
        orderCount: count(),
        totalSpent: sum(order.total),
        lastOrderDate: max(order.createdAt),
      })
      .from(order)
      .groupBy(order.userId);

    const orderStatsMap = new Map(
      orderStats.map((o) => [
        o.userId,
        {
          count: o.orderCount,
          spent: o.totalSpent || "0",
          lastDate: o.lastOrderDate,
        },
      ]),
    );

    // Get last estimate date per customer
    const lastEstimates = await db
      .select({
        customerId: estimate.customerId,
        lastDate: max(estimate.createdAt),
      })
      .from(estimate)
      .groupBy(estimate.customerId);

    const lastEstimateMap = new Map(
      lastEstimates.map((e) => [e.customerId, e.lastDate]),
    );

    const enrichedCustomers: CustomerListItem[] = customers.map((c) => {
      const orderData = orderStatsMap.get(c.id);
      const lastEstimateDate = lastEstimateMap.get(c.id);
      const lastOrderDate = orderData?.lastDate;

      // Determine last activity (most recent between estimate and order)
      let lastActivityAt: Date | null = null;
      if (lastEstimateDate && lastOrderDate) {
        lastActivityAt =
          lastEstimateDate > lastOrderDate ? lastEstimateDate : lastOrderDate;
      } else {
        lastActivityAt = lastEstimateDate || lastOrderDate || null;
      }

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phoneNumber: c.phoneNumber,
        shopName: c.shopName,
        totalEstimates: estimateCountMap.get(c.id) || 0,
        totalOrders: orderData?.count || 0,
        totalSpent: orderData?.spent || "0",
        lastActivityAt,
        createdAt: c.createdAt,
      };
    });

    return { success: true, customers: enrichedCustomers };
  } catch (error) {
    console.error("Error fetching customers:", error);
    return { success: false, error: "Failed to fetch customers" };
  }
}

/**
 * Get detailed customer information including order and estimate history
 */
export async function getCustomerDetails(customerId: string): Promise<{
  success: boolean;
  customer?: CustomerDetails;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get customer info
    const customerData = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        shopName: user.shopName,
        ownerName: user.ownerName,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(and(eq(user.id, customerId), eq(user.role, "customer")))
      .limit(1);

    if (customerData.length === 0) {
      return { success: false, error: "Customer not found" };
    }

    const customerInfo = customerData[0];

    // Get customer estimates
    const customerEstimates = await db
      .select({
        id: estimate.id,
        estimateNumber: estimate.estimateNumber,
        total: estimate.total,
        status: estimate.status,
        createdAt: estimate.createdAt,
      })
      .from(estimate)
      .where(eq(estimate.customerId, customerId))
      .orderBy(desc(estimate.createdAt));

    // Get customer orders
    const customerOrders = await db
      .select({
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      })
      .from(order)
      .where(eq(order.userId, customerId))
      .orderBy(desc(order.createdAt));

    // Calculate stats
    const totalSpent = customerOrders.reduce(
      (sum, o) => sum + Number.parseFloat(o.total),
      0,
    );
    const pendingAmount = customerOrders
      .filter((o) => o.paymentStatus === "pending")
      .reduce((sum, o) => sum + Number.parseFloat(o.total), 0);

    return {
      success: true,
      customer: {
        ...customerInfo,
        stats: {
          totalEstimates: customerEstimates.length,
          totalOrders: customerOrders.length,
          totalSpent: totalSpent.toFixed(2),
          pendingAmount: pendingAmount.toFixed(2),
        },
        estimates: customerEstimates,
        orders: customerOrders,
      },
    };
  } catch (error) {
    console.error("Error fetching customer details:", error);
    return { success: false, error: "Failed to fetch customer details" };
  }
}
