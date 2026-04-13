import { db } from "@bikalpo-project/db";
import {
  sellerApplication,
  session,
  user,
  warehouseApplication,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// ─── Input schemas ─────────────────────────────────────────────

const listInputSchema = z.object({
  role: z.enum(["warehouse", "shop_owner"]).optional(),
  status: z.enum(["active", "suspended", "all"]).default("all"),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

const userIdSchema = z.object({
  userId: z.string().min(1),
});

const suspendInputSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().optional(),
});

// ─── Router ────────────────────────────────────────────────────

export const adminUserManagementRouter = {
  /**
   * List wholesaler/retailer users with pagination, search, and filters.
   */
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/users",
      tags: ["User Management"],
      summary: "List wholesaler and retailer users",
    })
    .input(listInputSchema)
    .handler(async ({ input }) => {
      const { role, status, search, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      // Only list warehouse and shop_owner roles
      const roleConditions = role
        ? [eq(user.role, role)]
        : [or(eq(user.role, "warehouse"), eq(user.role, "shop_owner"))!];

      const conditions = [...roleConditions];

      // Status filter
      if (status === "active") {
        conditions.push(
          or(eq(user.banned, false), sql`${user.banned} IS NULL`)!,
        );
      } else if (status === "suspended") {
        conditions.push(eq(user.banned, true));
      }

      // Search
      if (search) {
        const term = `%${search}%`;
        conditions.push(
          or(
            ilike(user.name, term),
            ilike(user.phoneNumber, term),
            ilike(user.email, term),
            ilike(user.shopName, term),
            ilike(user.warehouseName, term),
            ilike(user.ownerName, term),
          )!,
        );
      }

      const whereClause = and(...conditions);

      const users = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          // Shop fields
          shopName: user.shopName,
          shopAddress: user.shopAddress,
          ownerName: user.ownerName,
          businessType: user.businessType,
          isSeller: user.isSeller,
          sellerStatus: user.sellerStatus,
          // Warehouse fields
          warehouseName: user.warehouseName,
          warehouseAddress: user.warehouseAddress,
          // Dates
          createdAt: user.createdAt,
        })
        .from(user)
        .where(whereClause)
        .orderBy(desc(user.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Total count
      const countResult = await db
        .select({ count: count() })
        .from(user)
        .where(whereClause);

      const totalCount = countResult[0]?.count || 0;

      return {
        users,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      };
    }),

  /**
   * Get KPI stats for wholesalers and retailers.
   */
  getStats: adminProcedure
    .route({
      method: "GET",
      path: "/admin/users/stats",
      tags: ["User Management"],
      summary: "Get user management KPI stats",
    })
    .input(
      z.object({
        role: z.enum(["warehouse", "shop_owner"]).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { role } = input;

      const roleFilter = role
        ? eq(user.role, role)
        : or(eq(user.role, "warehouse"), eq(user.role, "shop_owner"))!;

      // Total
      const totalResult = await db
        .select({ count: count() })
        .from(user)
        .where(roleFilter);

      // Active (not banned)
      const activeResult = await db
        .select({ count: count() })
        .from(user)
        .where(
          and(
            roleFilter,
            or(eq(user.banned, false), sql`${user.banned} IS NULL`)!,
          ),
        );

      // Suspended
      const suspendedResult = await db
        .select({ count: count() })
        .from(user)
        .where(and(roleFilter, eq(user.banned, true)));

      // New this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const newThisMonthResult = await db
        .select({ count: count() })
        .from(user)
        .where(and(roleFilter, gte(user.createdAt, startOfMonth)));

      return {
        stats: {
          total: totalResult[0]?.count || 0,
          active: activeResult[0]?.count || 0,
          suspended: suspendedResult[0]?.count || 0,
          newThisMonth: newThisMonthResult[0]?.count || 0,
        },
      };
    }),

  /**
   * Get a single user's full details including login activity and KYC status.
   */
  getById: adminProcedure
    .route({
      method: "GET",
      path: "/admin/users/{userId}",
      tags: ["User Management"],
      summary: "Get user details by ID",
    })
    .input(userIdSchema)
    .handler(async ({ input }) => {
      const found = await db.query.user.findFirst({
        where: eq(user.id, input.userId),
      });

      if (!found) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
      }

      // Get latest session for login activity
      const latestSession = await db
        .select({
          createdAt: session.createdAt,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
        })
        .from(session)
        .where(eq(session.userId, input.userId))
        .orderBy(desc(session.createdAt))
        .limit(1);

      // Get KYC / application status
      let applicationStatus: {
        type: string;
        status: string;
        appliedAt: Date | null;
        reviewedAt: Date | null;
      } | null = null;

      if (found.role === "shop_owner") {
        const app = await db
          .select({
            status: sellerApplication.status,
            createdAt: sellerApplication.createdAt,
            reviewedAt: sellerApplication.reviewedAt,
          })
          .from(sellerApplication)
          .where(eq(sellerApplication.userId, input.userId))
          .orderBy(desc(sellerApplication.createdAt))
          .limit(1);

        if (app[0]) {
          applicationStatus = {
            type: "seller",
            status: app[0].status,
            appliedAt: app[0].createdAt,
            reviewedAt: app[0].reviewedAt,
          };
        }
      } else if (found.role === "warehouse") {
        const app = await db
          .select({
            status: warehouseApplication.status,
            createdAt: warehouseApplication.createdAt,
            reviewedAt: warehouseApplication.reviewedAt,
          })
          .from(warehouseApplication)
          .where(eq(warehouseApplication.userId, input.userId))
          .orderBy(desc(warehouseApplication.createdAt))
          .limit(1);

        if (app[0]) {
          applicationStatus = {
            type: "warehouse",
            status: app[0].status,
            appliedAt: app[0].createdAt,
            reviewedAt: app[0].reviewedAt,
          };
        }
      }

      return {
        user: {
          id: found.id,
          name: found.name,
          email: found.email,
          phoneNumber: found.phoneNumber,
          role: found.role,
          banned: found.banned,
          banReason: found.banReason,
          image: found.image,
          // Shop fields
          shopName: found.shopName,
          shopSlug: found.shopSlug,
          shopAddress: found.shopAddress,
          ownerName: found.ownerName,
          businessType: found.businessType,
          isSeller: found.isSeller,
          sellerStatus: found.sellerStatus,
          // Warehouse fields
          warehouseName: found.warehouseName,
          warehouseSlug: found.warehouseSlug,
          warehouseAddress: found.warehouseAddress,
          // Location coordinates
          shopLat: found.shopLat,
          shopLng: found.shopLng,
          warehouseLat: found.warehouseLat,
          warehouseLng: found.warehouseLng,
          // Dates
          createdAt: found.createdAt,
          updatedAt: found.updatedAt,
        },
        loginActivity: latestSession[0]
          ? {
              lastLoginAt: latestSession[0].createdAt,
              userAgent: latestSession[0].userAgent,
              ipAddress: latestSession[0].ipAddress,
            }
          : null,
        applicationStatus,
      };
    }),

  /**
   * Suspend a user (set banned = true).
   */
  suspend: adminProcedure
    .route({
      method: "POST",
      path: "/admin/users/{userId}/suspend",
      tags: ["User Management"],
      summary: "Suspend a user",
    })
    .input(suspendInputSchema)
    .handler(async ({ input, context }) => {
      if (input.userId === context.session.user.id) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cannot suspend yourself",
        });
      }

      await db
        .update(user)
        .set({
          banned: true,
          banReason: input.reason || "Suspended by admin",
        })
        .where(eq(user.id, input.userId));

      return { success: true };
    }),

  /**
   * Activate a suspended user (set banned = false).
   */
  activate: adminProcedure
    .route({
      method: "POST",
      path: "/admin/users/{userId}/activate",
      tags: ["User Management"],
      summary: "Activate a suspended user",
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
   * Update basic user info (admin edit).
   */
  updateInfo: adminProcedure
    .route({
      method: "PATCH",
      path: "/admin/users/{userId}",
      tags: ["User Management"],
      summary: "Update user info",
    })
    .input(
      z.object({
        userId: z.string().min(1),
        name: z.string().min(1).optional(),
        phoneNumber: z.string().optional(),
        shopName: z.string().optional(),
        shopAddress: z.string().optional(),
        ownerName: z.string().optional(),
        warehouseName: z.string().optional(),
        warehouseAddress: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { userId, ...updates } = input;

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined),
      );

      if (Object.keys(cleanUpdates).length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No fields to update",
        });
      }

      await db.update(user).set(cleanUpdates).where(eq(user.id, userId));

      return { success: true };
    }),
};
