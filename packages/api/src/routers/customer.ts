import { db } from "@bikalpo-project/db";
import { invoice, order, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// Input schemas
const customerIdSchema = z.object({
    customerId: z.string().min(1),
});

const listFiltersSchema = z.object({
    search: z.string().optional(),
    startDate: z.string().optional(), // ISO date string
    endDate: z.string().optional(),   // ISO date string
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(10),
});

export const customerRouter = {
    /**
     * Get paginated customers list with order stats
     * REST: GET /customers
     */
    getList: adminProcedure
        .route({
            method: "GET",
            path: "/customers",
            tags: ["Customers"],
            summary: "Get customers list",
            description: "Get paginated customers list with order stats and filtering",
        })
        .input(listFiltersSchema)
        .handler(async ({ input }) => {
            const { search, startDate, endDate, page, pageSize } = input;
            const offset = (page - 1) * pageSize;

            const conditions = [eq(user.role, "customer")];

            if (search) {
                const searchTerm = `%${search}%`;
                conditions.push(
                    or(
                        ilike(user.name, searchTerm),
                        ilike(user.email, searchTerm),
                        ilike(user.shopName, searchTerm),
                        ilike(user.phoneNumber, searchTerm),
                    )!,
                );
            }

            if (startDate) {
                conditions.push(gte(user.createdAt, new Date(startDate)));
            }
            if (endDate) {
                conditions.push(lte(user.createdAt, new Date(endDate)));
            }

            const whereClause = and(...conditions);

            // Get customers
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

            // Map to list items with stats
            const items = customers.map((customer) => {
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
                customers: items,
                pagination: {
                    page,
                    pageSize,
                    totalCount,
                    totalPages,
                },
            };
        }),

    /**
     * Get customer stats
     * REST: GET /customers/stats
     */
    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/customers/stats",
            tags: ["Customers"],
            summary: "Get customer stats",
            description: "Get total customers, new this month, and active customers count",
        })
        .handler(async () => {
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

            // Active customers (with at least one invoice)
            const activeResult = await db
                .select({
                    count: sql<number>`COUNT(DISTINCT ${invoice.customerId})`,
                })
                .from(invoice);

            return {
                stats: {
                    totalCustomers: totalResult[0]?.count || 0,
                    newThisMonth: newThisMonthResult[0]?.count || 0,
                    activeCustomers: Number(activeResult[0]?.count || 0),
                },
            };
        }),

    /**
     * Get pending customers (guests awaiting approval)
     * REST: GET /customers/pending
     */
    getPending: adminProcedure
        .route({
            method: "GET",
            path: "/customers/pending",
            tags: ["Customers"],
            summary: "Get pending customers",
            description: "Get guests awaiting approval to become customers",
        })
        .handler(async () => {
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

            return { customers: pending };
        }),

    /**
     * Approve a pending customer
     * REST: POST /customers/:customerId/approve
     */
    approve: adminProcedure
        .route({
            method: "POST",
            path: "/customers/{customerId}/approve",
            tags: ["Customers"],
            summary: "Approve customer",
            description: "Approve a guest to become a customer",
        })
        .input(customerIdSchema)
        .handler(async ({ input }) => {
            await db
                .update(user)
                .set({ role: "customer" })
                .where(eq(user.id, input.customerId));

            return { success: true };
        }),

    /**
     * Reject (delete) a pending customer
     * REST: DELETE /customers/:customerId
     */
    reject: adminProcedure
        .route({
            method: "DELETE",
            path: "/customers/{customerId}",
            tags: ["Customers"],
            summary: "Reject customer",
            description: "Reject and delete a pending customer",
        })
        .input(customerIdSchema)
        .handler(async ({ input }) => {
            await db.delete(user).where(eq(user.id, input.customerId));

            return { success: true };
        }),

    /**
     * Get customer by ID with orders
     * REST: GET /customers/:customerId
     */
    getById: adminProcedure
        .route({
            method: "GET",
            path: "/customers/{customerId}",
            tags: ["Customers"],
            summary: "Get customer by ID",
            description: "Get customer details with order stats and order history",
        })
        .input(customerIdSchema)
        .handler(async ({ input }) => {
            // Get customer
            const customer = await db.query.user.findFirst({
                where: eq(user.id, input.customerId),
            });

            if (!customer) {
                throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
            }

            // Get order stats
            const orderStatsResult = await db
                .select({
                    ordersCount: sql<number>`COUNT(DISTINCT ${invoice.orderId})`,
                    totalSpent: sql<number>`COALESCE(SUM(${invoice.grandTotal}::numeric), 0)`,
                })
                .from(invoice)
                .where(eq(invoice.customerId, input.customerId));

            const orderStats = {
                ordersCount: Number(orderStatsResult[0]?.ordersCount || 0),
                totalSpent: Number(orderStatsResult[0]?.totalSpent || 0),
            };

            // Get orders with items
            const orders = await db.query.order.findMany({
                where: eq(order.userId, input.customerId),
                with: {
                    items: true,
                },
                orderBy: [desc(order.createdAt)],
            });

            return {
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
        }),
};
