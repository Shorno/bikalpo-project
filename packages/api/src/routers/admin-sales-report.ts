import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { estimate, invoice, order, user } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const filtersSchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    customerId: z.string().optional(),
    salesmanId: z.string().optional(),
    status: z.string().optional(),
    page: z.number().optional(),
    pageSize: z.number().optional(),
});

export const adminSalesReportRouter = {
    getSummary: adminProcedure
        .route({
            method: "POST",
            path: "/admin/sales-reports/summary",
            tags: ["Admin Sales Reports"],
            summary: "Get sales summary",
            description: "Get sales summary with optional filters",
        })
        .input(filtersSchema)
        .handler(async ({ input: filters }) => {
            const conditions = [];
            if (filters.startDate) conditions.push(gte(invoice.createdAt, filters.startDate));
            if (filters.endDate) conditions.push(lte(invoice.createdAt, filters.endDate));
            if (filters.customerId) conditions.push(eq(invoice.customerId, filters.customerId));

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            const salesResult = await db
                .select({
                    totalSales: sql<number>`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`,
                    totalInvoices: count(invoice.id),
                })
                .from(invoice)
                .where(whereClause);

            const ordersResult = await db
                .select({ totalOrders: sql<number>`COUNT(DISTINCT ${invoice.orderId})` })
                .from(invoice)
                .where(whereClause);

            const customersResult = await db
                .select({ totalCustomers: sql<number>`COUNT(DISTINCT ${invoice.customerId})` })
                .from(invoice)
                .where(whereClause);

            const totalSales = Number(salesResult[0]?.totalSales || 0);
            const totalInvoices = Number(salesResult[0]?.totalInvoices || 0);
            const totalOrders = Number(ordersResult[0]?.totalOrders || 0);
            const totalCustomers = Number(customersResult[0]?.totalCustomers || 0);
            const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

            return {
                totalSales,
                totalOrders,
                totalCustomers,
                totalInvoices,
                avgOrderValue,
            };
        }),

    getData: adminProcedure
        .route({
            method: "POST",
            path: "/admin/sales-reports/data",
            tags: ["Admin Sales Reports"],
            summary: "Get sales data",
            description: "Get sales report data with pagination",
        })
        .input(filtersSchema)
        .handler(async ({ input: filters }) => {
            const page = filters.page || 1;
            const pageSize = filters.pageSize || 10;
            const offset = (page - 1) * pageSize;

            const conditions = [];
            if (filters.startDate) conditions.push(gte(invoice.createdAt, filters.startDate));
            if (filters.endDate) conditions.push(lte(invoice.createdAt, filters.endDate));
            if (filters.customerId) conditions.push(eq(invoice.customerId, filters.customerId));
            if (filters.status) {
                conditions.push(
                    eq(
                        invoice.deliveryStatus,
                        filters.status as "not_assigned" | "pending" | "out_for_delivery" | "delivered" | "failed",
                    ),
                );
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

            const countResult = await db.select({ count: count() }).from(invoice).where(whereClause);
            const totalCount = countResult[0]?.count || 0;
            const totalPages = Math.ceil(totalCount / pageSize);

            const data = invoices.map((inv) => ({
                invoiceId: inv.invoiceId,
                invoiceNumber: inv.invoiceNumber,
                orderId: inv.orderId,
                orderNumber: `ORD-${inv.orderId}`,
                customerId: inv.customerId,
                customerName: inv.customerName || "Unknown",
                shopName: inv.shopName,
                salesmanId: null as string | null,
                salesmanName: null as string | null,
                date: inv.date,
                deliveryStatus: inv.deliveryStatus,
                paymentStatus: inv.paymentStatus,
                grandTotal: Number(inv.grandTotal),
            }));

            return { data, pagination: { page, pageSize, totalCount, totalPages } };
        }),

    getTrend: adminProcedure
        .route({
            method: "POST",
            path: "/admin/sales-reports/trend",
            tags: ["Admin Sales Reports"],
            summary: "Get sales trend",
            description: "Get monthly sales trend data",
        })
        .input(z.object({ startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() }))
        .handler(async ({ input: filters }) => {
            const conditions = [];
            if (filters.startDate) conditions.push(gte(invoice.createdAt, filters.startDate));
            if (filters.endDate) conditions.push(lte(invoice.createdAt, filters.endDate));
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

            return trendData.map((item) => ({
                month: item.month,
                year: Number(item.year),
                totalSales: Number(item.totalSales),
                orderCount: Number(item.orderCount),
            }));
        }),

    getByEmployee: adminProcedure
        .route({
            method: "POST",
            path: "/admin/sales-reports/by-employee",
            tags: ["Admin Sales Reports"],
            summary: "Get sales by employee",
            description: "Get sales data grouped by employee",
        })
        .input(z.object({ startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() }))
        .handler(async ({ input: filters }) => {
            const conditions = [];
            if (filters.startDate) conditions.push(gte(invoice.createdAt, filters.startDate));
            if (filters.endDate) conditions.push(lte(invoice.createdAt, filters.endDate));
            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

            return salesByEmployee.map((item) => {
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
        }),

    getCustomersForFilter: adminProcedure
        .route({
            method: "GET",
            path: "/admin/sales-reports/customers-filter",
            tags: ["Admin Sales Reports"],
            summary: "Get customers for filter",
            description: "Get customer list for sales report filtering",
        })
        .handler(async () => {
            const customers = await db
                .select({ id: user.id, name: user.name, shopName: user.shopName })
                .from(user)
                .where(eq(user.role, "customer"))
                .orderBy(user.name)
                .limit(100);
            return customers;
        }),

    getSalesmenForFilter: adminProcedure
        .route({
            method: "GET",
            path: "/admin/sales-reports/salesmen-filter",
            tags: ["Admin Sales Reports"],
            summary: "Get salesmen for filter",
            description: "Get salesman list for sales report filtering",
        })
        .handler(async () => {
            const salesmen = await db
                .select({ id: user.id, name: user.name })
                .from(user)
                .where(eq(user.role, "salesman"))
                .orderBy(user.name);
            return salesmen;
        }),
};
