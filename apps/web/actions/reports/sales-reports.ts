"use server";

import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import { estimate } from "@/db/schema/estimate";
import { invoice } from "@/db/schema/invoice";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";

// Types
export interface SalesReportSummary {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  totalInvoices: number;
  avgOrderValue: number;
}

export interface SalesReportFilters {
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  salesmanId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface SalesReportItem {
  invoiceId: number;
  invoiceNumber: string;
  orderId: number;
  orderNumber: string;
  customerId: string;
  customerName: string;
  shopName: string | null;
  salesmanId: string | null;
  salesmanName: string | null;
  date: Date;
  deliveryStatus: string;
  paymentStatus: string;
  grandTotal: number;
}

export interface SalesTrendItem {
  month: string;
  year: number;
  totalSales: number;
  orderCount: number;
}

export interface SalesByEmployeeItem {
  employeeId: string;
  employeeName: string;
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
}

// Get sales report summary
export async function getSalesReportSummary(filters?: SalesReportFilters) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const conditions = [];

    if (filters?.startDate) {
      conditions.push(gte(invoice.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(invoice.createdAt, filters.endDate));
    }
    if (filters?.customerId) {
      conditions.push(eq(invoice.customerId, filters.customerId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total sales and invoices
    const salesResult = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`,
        totalInvoices: count(invoice.id),
      })
      .from(invoice)
      .where(whereClause);

    // Total orders (unique)
    const ordersResult = await db
      .select({
        totalOrders: sql<number>`COUNT(DISTINCT ${invoice.orderId})`,
      })
      .from(invoice)
      .where(whereClause);

    // Total customers (unique)
    const customersResult = await db
      .select({
        totalCustomers: sql<number>`COUNT(DISTINCT ${invoice.customerId})`,
      })
      .from(invoice)
      .where(whereClause);

    const totalSales = Number(salesResult[0]?.totalSales || 0);
    const totalInvoices = Number(salesResult[0]?.totalInvoices || 0);
    const totalOrders = Number(ordersResult[0]?.totalOrders || 0);
    const totalCustomers = Number(customersResult[0]?.totalCustomers || 0);
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    return {
      success: true,
      summary: {
        totalSales,
        totalOrders,
        totalCustomers,
        totalInvoices,
        avgOrderValue,
      } as SalesReportSummary,
    };
  } catch (error) {
    console.error("Error fetching sales report summary:", error);
    return { success: false, error: "Failed to fetch sales report summary" };
  }
}

// Get paginated sales report data
export async function getSalesReportData(filters?: SalesReportFilters) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (filters?.startDate) {
      conditions.push(gte(invoice.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(invoice.createdAt, filters.endDate));
    }
    if (filters?.customerId) {
      conditions.push(eq(invoice.customerId, filters.customerId));
    }
    if (filters?.status) {
      conditions.push(
        eq(
          invoice.deliveryStatus,
          filters.status as
            | "not_assigned"
            | "pending"
            | "out_for_delivery"
            | "delivered"
            | "failed",
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get invoices with customer info
    const invoices = await db
      .select({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderId: invoice.orderId,
        customerId: invoice.customerId,
        date: invoice.createdAt,
        deliveryStatus: invoice.deliveryStatus,
        paymentStatus: invoice.paymentStatus,
        grandTotal: invoice.grandTotal,
        customerName: user.name,
        shopName: user.shopName,
      })
      .from(invoice)
      .leftJoin(user, eq(invoice.customerId, user.id))
      .where(whereClause)
      .orderBy(desc(invoice.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(invoice)
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Map to report items
    const items: SalesReportItem[] = invoices.map((inv) => ({
      invoiceId: inv.invoiceId,
      invoiceNumber: inv.invoiceNumber,
      orderId: inv.orderId,
      orderNumber: `ORD-${inv.orderId}`,
      customerId: inv.customerId,
      customerName: inv.customerName || "Unknown",
      shopName: inv.shopName,
      salesmanId: null,
      salesmanName: null,
      date: inv.date,
      deliveryStatus: inv.deliveryStatus,
      paymentStatus: inv.paymentStatus,
      grandTotal: Number(inv.grandTotal),
    }));

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
    console.error("Error fetching sales report data:", error);
    return { success: false, error: "Failed to fetch sales report data" };
  }
}

// Get monthly sales trend data
export async function getSalesTrendData(filters?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const conditions = [];

    if (filters?.startDate) {
      conditions.push(gte(invoice.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(invoice.createdAt, filters.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const trendData = await db
      .select({
        month: sql<string>`TO_CHAR(${invoice.createdAt}, 'Mon')`,
        year: sql<number>`EXTRACT(YEAR FROM ${invoice.createdAt})::integer`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${invoice.createdAt})::integer`,
        totalSales: sql<number>`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`,
        orderCount: sql<number>`COUNT(DISTINCT ${invoice.orderId})`,
      })
      .from(invoice)
      .where(whereClause)
      .groupBy(
        sql`TO_CHAR(${invoice.createdAt}, 'Mon')`,
        sql`EXTRACT(YEAR FROM ${invoice.createdAt})`,
        sql`EXTRACT(MONTH FROM ${invoice.createdAt})`,
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${invoice.createdAt})`,
        sql`EXTRACT(MONTH FROM ${invoice.createdAt})`,
      );

    const items: SalesTrendItem[] = trendData.map((item) => ({
      month: item.month,
      year: Number(item.year),
      totalSales: Number(item.totalSales),
      orderCount: Number(item.orderCount),
    }));

    return { success: true, data: items };
  } catch (error) {
    console.error("Error fetching sales trend data:", error);
    return { success: false, error: "Failed to fetch sales trend data" };
  }
}

// Get sales by employee (salesman)
export async function getSalesByEmployee(filters?: {
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const conditions = [];

    if (filters?.startDate) {
      conditions.push(gte(invoice.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(invoice.createdAt, filters.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Join invoice -> order -> estimate to get salesman
    // estimate.convertedOrderId links to order.id, and order.id is invoice.orderId
    const salesByEmployee = await db
      .select({
        employeeId: estimate.salesmanId,
        employeeName: user.name,
        totalSales: sql<number>`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`,
        orderCount: sql<number>`COUNT(DISTINCT ${invoice.orderId})`,
      })
      .from(invoice)
      .innerJoin(order, eq(invoice.orderId, order.id))
      .innerJoin(estimate, eq(estimate.convertedOrderId, order.id))
      .innerJoin(user, eq(estimate.salesmanId, user.id))
      .where(whereClause)
      .groupBy(estimate.salesmanId, user.name)
      .orderBy(desc(sql`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`));

    const items: SalesByEmployeeItem[] = salesByEmployee.map((item) => {
      const totalSales = Number(item.totalSales);
      const orderCount = Number(item.orderCount);
      return {
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        totalSales,
        orderCount,
        avgOrderValue: orderCount > 0 ? totalSales / orderCount : 0,
      };
    });

    return { success: true, data: items };
  } catch (error) {
    console.error("Error fetching sales by employee:", error);
    return { success: false, error: "Failed to fetch sales by employee" };
  }
}

// Get customers for filter dropdown
export async function getCustomersForFilter() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const customers = await db
      .select({
        id: user.id,
        name: user.name,
        shopName: user.shopName,
      })
      .from(user)
      .where(eq(user.role, "customer"))
      .orderBy(user.name)
      .limit(100);

    return { success: true, data: customers };
  } catch (error) {
    console.error("Error fetching customers:", error);
    return { success: false, error: "Failed to fetch customers" };
  }
}

// Get salesmen for filter dropdown
export async function getSalesmenForFilter() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const salesmen = await db
      .select({
        id: user.id,
        name: user.name,
      })
      .from(user)
      .where(eq(user.role, "salesman"))
      .orderBy(user.name);

    return { success: true, data: salesmen };
  } catch (error) {
    console.error("Error fetching salesmen:", error);
    return { success: false, error: "Failed to fetch salesmen" };
  }
}
