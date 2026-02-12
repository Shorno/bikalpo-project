import { db } from "@bikalpo-project/db";
import { category, invoice, order, orderItem, product, session, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
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
import { z } from "zod";

import { adminProcedure } from "../index";

// Input schemas
const customerIdSchema = z.object({
  customerId: z.string().min(1),
});

const userIdSchema = z.object({
  userId: z.string().min(1),
});

const userRoleSchema = z.enum(["guest", "customer", "admin", "salesman", "deliveryman"]);

const listFiltersSchema = z.object({
  search: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(10),
});

export const customerManagementRouter = {
  /**
   * Get paginated customers list with order stats
   * REST: GET /customers
   */
  getList: adminProcedure
    .route({
      method: "GET",
      path: "/customers",
      tags: ["Customer Management"],
      summary: "Get customers list",
      description:
        "Get paginated customers list with order stats and filtering",
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
      tags: ["Customer Management"],
      summary: "Get customer stats",
      description:
        "Get total customers, new this month, and active customers count",
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
        .where(
          and(eq(user.role, "customer"), gte(user.createdAt, startOfMonth)),
        );

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
      tags: ["Customer Management"],
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
      tags: ["Customer Management"],
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
      tags: ["Customer Management"],
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
      tags: ["Customer Management"],
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

  /**
   * Get products purchased by a customer (from order history)
   * REST: GET /customers/:customerId/purchased-products
   */
  getPurchasedProducts: adminProcedure
    .route({
      method: "GET",
      path: "/customers/{customerId}/purchased-products",
      tags: ["Customer Management"],
      summary: "Get customer purchased products",
      description:
        "Get aggregated list of products a customer has ordered",
    })
    .input(customerIdSchema)
    .handler(async ({ input }) => {
      // Get all products ordered by this customer, aggregated
      const products = await db
        .select({
          productId: orderItem.productId,
          productName: orderItem.productName,
          productImage: orderItem.productImage,
          productSize: orderItem.productSize,
          totalQuantity: sql<number>`SUM(${orderItem.quantity})::int`,
          totalOrders: sql<number>`COUNT(DISTINCT ${orderItem.orderId})::int`,
          lastOrderedAt: sql<Date>`MAX(${order.createdAt})`,
          categoryId: product.categoryId,
        })
        .from(orderItem)
        .innerJoin(order, eq(orderItem.orderId, order.id))
        .innerJoin(product, eq(orderItem.productId, product.id))
        .where(eq(order.userId, input.customerId))
        .groupBy(
          orderItem.productId,
          orderItem.productName,
          orderItem.productImage,
          orderItem.productSize,
          product.categoryId,
        )
        .orderBy(desc(sql`MAX(${order.createdAt})`))
        .limit(20);

      // Get category names for the products
      const categoryIds = [
        ...new Set(products.map((p) => p.categoryId).filter(Boolean)),
      ] as number[];

      let categoryMap: Record<number, string> = {};
      if (categoryIds.length > 0) {
        const categories = await db
          .select({ id: category.id, name: category.name })
          .from(category)
          .where(inArray(category.id, categoryIds));

        categoryMap = Object.fromEntries(
          categories.map((c) => [c.id, c.name]),
        );
      }

      return {
        data: products.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          productImage: p.productImage,
          productSize: p.productSize,
          categoryName: p.categoryId
            ? categoryMap[p.categoryId] || null
            : null,
          totalQuantity: Number(p.totalQuantity) || 0,
          totalOrders: Number(p.totalOrders) || 0,
          lastOrderedAt: p.lastOrderedAt,
        })),
      };
    }),

  // ─── User Management ────────────────────────────────────────

  /**
   * Set a user's role
   * REST: PATCH /customers/set-role
   */
  setRole: adminProcedure
    .route({
      method: "PATCH",
      path: "/customers/set-role",
      tags: ["Customer Management"],
      summary: "Set user role",
      description: "Change a user's role (admin only)",
    })
    .input(
      z.object({
        userId: z.string().min(1),
        role: userRoleSchema,
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id && input.role !== "admin") {
        throw new ORPCError("BAD_REQUEST", { message: "Cannot demote yourself" });
      }

      await db.update(user).set({ role: input.role }).where(eq(user.id, input.userId));
      return { success: true };
    }),

  /**
   * Ban a user
   * REST: POST /customers/ban
   */
  ban: adminProcedure
    .route({
      method: "POST",
      path: "/customers/ban",
      tags: ["Customer Management"],
      summary: "Ban user",
      description: "Ban a user with an optional reason",
    })
    .input(
      z.object({
        userId: z.string().min(1),
        reason: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new ORPCError("BAD_REQUEST", { message: "Cannot ban yourself" });
      }

      await db
        .update(user)
        .set({ banned: true, banReason: input.reason || "No reason provided" })
        .where(eq(user.id, input.userId));

      return { success: true };
    }),

  /**
   * Unban a user
   * REST: POST /customers/unban
   */
  unban: adminProcedure
    .route({
      method: "POST",
      path: "/customers/unban",
      tags: ["Customer Management"],
      summary: "Unban user",
      description: "Remove ban from a user",
    })
    .input(userIdSchema)
    .handler(async ({ input }) => {
      await db
        .update(user)
        .set({ banned: false, banReason: null })
        .where(eq(user.id, input.userId));

      return { success: true };
    }),

  /**
   * Revoke a specific user session
   * REST: DELETE /customers/sessions/:sessionId
   */
  revokeSession: adminProcedure
    .route({
      method: "DELETE",
      path: "/customers/sessions/{sessionId}",
      tags: ["Customer Management"],
      summary: "Revoke session",
      description: "Revoke a specific user session",
    })
    .input(z.object({ sessionId: z.string().min(1) }))
    .handler(async ({ input }) => {
      await db.delete(session).where(eq(session.id, input.sessionId));
      return { success: true };
    }),

  /**
   * Revoke all sessions for a user
   * REST: DELETE /customers/:userId/sessions
   */
  revokeAllSessions: adminProcedure
    .route({
      method: "DELETE",
      path: "/customers/{userId}/sessions",
      tags: ["Customer Management"],
      summary: "Revoke all sessions",
      description: "Revoke all sessions for a user",
    })
    .input(userIdSchema)
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new ORPCError("BAD_REQUEST", { message: "Cannot revoke your own sessions" });
      }

      await db.delete(session).where(eq(session.userId, input.userId));
      return { success: true };
    }),
};
