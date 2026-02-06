"use server";

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
} from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import { invoice } from "@/db/schema/invoice";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";

// Types
export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  shopName: string | null;
  ownerName: string | null;
  createdAt: Date;
  ordersCount: number;
  totalSpent: number;
}

export interface CustomerFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface CustomerStats {
  totalCustomers: number;
  newThisMonth: number;
  activeCustomers: number;
}

// Get paginated customers list
export async function getCustomersList(filters?: CustomerFilters) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(user.role, "customer")];

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(user.name, searchTerm),
          ilike(user.email, searchTerm),
          ilike(user.shopName, searchTerm),
          ilike(user.phoneNumber, searchTerm),
        )!,
      );
    }

    if (filters?.startDate) {
      conditions.push(gte(user.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(user.createdAt, filters.endDate));
    }

    const whereClause = and(...conditions);

    // Get customers with order stats
    const customers = await db
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
      .where(whereClause)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Get order counts and total spent for each customer
    const customerIds = customers.map((c) => c.id);

    let orderStats: {
      customerId: string;
      ordersCount: number;
      totalSpent: number;
    }[] = [];

    if (customerIds.length > 0) {
      const stats = await db
        .select({
          customerId: invoice.customerId,
          ordersCount: sql<number>`COUNT(DISTINCT ${invoice.orderId})`,
          totalSpent: sql<number>`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`,
        })
        .from(invoice)
        .where(inArray(invoice.customerId, customerIds))
        .groupBy(invoice.customerId);

      orderStats = stats.map((s) => ({
        customerId: s.customerId,
        ordersCount: Number(s.ordersCount),
        totalSpent: Number(s.totalSpent),
      }));
    }

    // Map to list items
    const items: CustomerListItem[] = customers.map((customer) => {
      const stats = orderStats.find((s) => s.customerId === customer.id);
      return {
        ...customer,
        ordersCount: stats?.ordersCount || 0,
        totalSpent: stats?.totalSpent || 0,
      };
    });

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(user)
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Error fetching customers list:", error);
    return { success: false, error: "Failed to fetch customers list" };
  }
}

// Get customer stats
export async function getCustomerStats() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Total customers
    const totalResult = await db
      .select({ count: count() })
      .from(user)
      .where(eq(user.role, "customer"));

    // New this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newThisMonthResult = await db
      .select({ count: count() })
      .from(user)
      .where(and(eq(user.role, "customer"), gte(user.createdAt, startOfMonth)));

    // Active customers (with at least one order)
    const activeResult = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${invoice.customerId})`,
      })
      .from(invoice);

    return {
      success: true,
      stats: {
        totalCustomers: totalResult[0]?.count || 0,
        newThisMonth: newThisMonthResult[0]?.count || 0,
        activeCustomers: Number(activeResult[0]?.count || 0),
      } as CustomerStats,
    };
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    return { success: false, error: "Failed to fetch customer stats" };
  }
}

// Pending customer type
export interface PendingCustomer {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  shopName: string | null;
  ownerName: string | null;
  createdAt: Date;
}

// Get pending customers (guests awaiting approval)
export async function getPendingCustomers() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized", data: [] };
  }

  try {
    const pending = await db
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
      .where(eq(user.role, "guest"))
      .orderBy(desc(user.createdAt));

    return { success: true, data: pending as PendingCustomer[] };
  } catch (error) {
    console.error("Error fetching pending customers:", error);
    return {
      success: false,
      error: "Failed to fetch pending customers",
      data: [],
    };
  }
}

// Approve a pending customer (change role from guest to customer)
export async function approveCustomer(customerId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db
      .update(user)
      .set({ role: "customer" })
      .where(eq(user.id, customerId));
    return { success: true };
  } catch (error) {
    console.error("Error approving customer:", error);
    return { success: false, error: "Failed to approve customer" };
  }
}

// Reject (delete) a pending customer
export async function rejectCustomer(customerId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.delete(user).where(eq(user.id, customerId));
    return { success: true };
  } catch (error) {
    console.error("Error rejecting customer:", error);
    return { success: false, error: "Failed to reject customer" };
  }
}

// Get customer by ID with orders
export async function getCustomerById(customerId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get customer
    const customer = await db.query.user.findFirst({
      where: eq(user.id, customerId),
    });

    if (!customer) {
      return { success: false, error: "Customer not found" };
    }

    // Get order stats
    const orderStatsResult = await db
      .select({
        ordersCount: sql<number>`COUNT(DISTINCT ${invoice.orderId})`,
        totalSpent: sql<number>`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`,
      })
      .from(invoice)
      .where(eq(invoice.customerId, customerId));

    const orderStats = {
      ordersCount: Number(orderStatsResult[0]?.ordersCount || 0),
      totalSpent: Number(orderStatsResult[0]?.totalSpent || 0),
    };

    // Get orders with items using the order table
    const orders = await db.query.order.findMany({
      where: eq(order.userId, customerId),
      with: {
        items: true,
      },
      orderBy: [desc(order.createdAt)],
    });

    return {
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        shopName: customer.shopName,
        ownerName: customer.ownerName,
        createdAt: customer.createdAt,
        role: customer.role,
        ...orderStats,
      },
      orders,
    };
  } catch (error) {
    console.error("Error fetching customer:", error);
    return { success: false, error: "Failed to fetch customer" };
  }
}
