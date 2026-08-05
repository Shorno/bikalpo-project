import { db } from "@bikalpo-project/db";
import {
  kycVerification,
  productType,
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
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";
import {
  deriveKycStatus,
  ensurePendingKycForUser,
  verifyKycForUser,
} from "./helpers/kyc-verification";

// ─── Types & helpers ───────────────────────────────────────────

type AccountStatus = "active" | "pending" | "suspended";

const listInputSchema = z.object({
  role: z.enum(["warehouse", "shop_owner"]).optional(),
  status: z.enum(["active", "pending", "suspended", "all"]).default("all"),
  kyc: z
    .enum(["all", "verified", "unverified", "pending", "failed"])
    .default("all"),
  district: z.string().optional(),
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

const BUSINESS_NATURE_LABELS: Record<string, string> = {
  retail_shop: "Retail Shop",
  wholesaler: "Wholesaler",
  distributor: "Distributor",
  manufacturer: "Manufacturer",
  importer: "Importer",
};

function isUserPending(
  banned: boolean | null,
  sellerStatus: string | null | undefined,
  appStatus: string | null | undefined,
): boolean {
  if (banned) return false;
  return sellerStatus === "pending" || appStatus === "pending";
}

function deriveAccountStatus(
  banned: boolean | null,
  sellerStatus: string | null | undefined,
  appStatus: string | null | undefined,
): AccountStatus {
  if (banned) return "suspended";
  if (isUserPending(banned, sellerStatus, appStatus)) return "pending";
  return "active";
}

function formatBusinessNature(nature: string | null | undefined): string | null {
  if (!nature) return null;
  return BUSINESS_NATURE_LABELS[nature] ?? nature.replace(/_/g, " ");
}

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Day keys and labels are derived in UTC on both sides (SQL and JS) so the
// gap-filling loop below always lines up with the grouped rows.
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDayLabel(date: Date): string {
  return `${MONTH_LABELS[date.getUTCMonth()]}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function computeProfileCompletion(
  app: Record<string, unknown> | null,
  userRecord: {
    name: string;
    email: string;
    phoneNumber: string | null;
    shopName: string | null;
    warehouseName: string | null;
    ownerName: string | null;
    image: string | null;
  },
): number {
  const checks = [
    userRecord.ownerName || app?.ownerName,
    userRecord.phoneNumber || app?.phoneNumber,
    userRecord.email || app?.email,
    app?.profilePhotoUrl || userRecord.image,
    userRecord.shopName || userRecord.warehouseName || app?.shopName || app?.warehouseName,
    app?.businessNature || app?.businessCategory,
    app?.district || app?.area,
    app?.bankName,
    app?.documentUrls || app?.documents,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

async function countUsersWithLatestApp(
  role: "warehouse" | "shop_owner",
  extraWhere?: ReturnType<typeof sql>,
) {
  const table =
    role === "shop_owner" ? "seller_application" : "warehouse_application";
  const roleVal = role;

  const result = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM "user" u
    LEFT JOIN LATERAL (
      SELECT status FROM ${sql.raw(table)}
      WHERE user_id = u.id
      ORDER BY created_at DESC
      LIMIT 1
    ) la ON true
    WHERE u.role = ${roleVal}
    ${extraWhere ? sql`AND ${extraWhere}` : sql``}
  `);

  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: { count: number }[] }).rows ?? []);
  return Number(rows[0]?.count ?? 0);
}

async function countUsersWithLatestKyc(
  role: "warehouse" | "shop_owner",
  kycStatus: string,
) {
  const roleVal = role;

  const result = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM "user" u
    LEFT JOIN LATERAL (
      SELECT status FROM kyc_verification
      WHERE user_id = u.id
      ORDER BY created_at DESC
      LIMIT 1
    ) lk ON true
    WHERE u.role = ${roleVal}
    AND lk.status = ${kycStatus}
  `);

  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: { count: number }[] }).rows ?? []);
  return Number(rows[0]?.count ?? 0);
}

// ─── Router ────────────────────────────────────────────────────

export const adminUserManagementRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/users",
      tags: ["User Management"],
      summary: "List wholesaler and retailer users",
    })
    .input(listInputSchema)
    .handler(async ({ input }) => {
      const { role, status, kyc, district, search, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      if (!role) {
        throw new ORPCError("BAD_REQUEST", {
          message: "role is required for listing users",
        });
      }

      const isRetailer = role === "shop_owner";
      const appTable = isRetailer ? sellerApplication : warehouseApplication;

      const latestApp = db.$with("latest_app").as(
        db
          .selectDistinctOn([appTable.userId], {
            userId: appTable.userId,
            appId: appTable.id,
            applicationNumber: appTable.applicationNumber,
            appStatus: appTable.status,
            district: appTable.district,
            area: appTable.area,
            businessNature: appTable.businessNature,
            productTypeId: appTable.productTypeId,
          })
          .from(appTable)
          .orderBy(appTable.userId, desc(appTable.createdAt)),
      );

      const latestKyc = db.$with("latest_kyc").as(
        db
          .selectDistinctOn([kycVerification.userId], {
            userId: kycVerification.userId,
            kycStatus: kycVerification.status,
          })
          .from(kycVerification)
          .orderBy(kycVerification.userId, desc(kycVerification.createdAt)),
      );

      const conditions = [eq(user.role, role)];

      if (status === "suspended") {
        conditions.push(eq(user.banned, true));
      } else if (status === "pending") {
        conditions.push(
          or(eq(user.banned, false), isNull(user.banned))!,
          or(
            eq(user.sellerStatus, "pending"),
            eq(latestApp.appStatus, "pending"),
          )!,
        );
      } else if (status === "active") {
        conditions.push(or(eq(user.banned, false), isNull(user.banned))!);
        conditions.push(
          sql`NOT (${user.sellerStatus} = 'pending' OR ${latestApp.appStatus} = 'pending')`,
        );
      }

      if (kyc === "verified") {
        conditions.push(eq(latestKyc.kycStatus, "verified"));
      } else if (kyc === "pending") {
        conditions.push(eq(latestKyc.kycStatus, "pending"));
      } else if (kyc === "failed") {
        conditions.push(eq(latestKyc.kycStatus, "failed"));
      } else if (kyc === "unverified") {
        conditions.push(isNull(latestKyc.kycStatus));
      }

      if (district && district !== "all") {
        conditions.push(eq(latestApp.district, district));
      }

      if (search?.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(user.name, term),
            ilike(user.phoneNumber, term),
            ilike(user.email, term),
            ilike(user.shopName, term),
            ilike(user.warehouseName, term),
            ilike(user.ownerName, term),
            ilike(latestApp.applicationNumber, term),
          )!,
        );
      }

      const whereClause = and(...conditions);

      const rows = await db
        .with(latestApp, latestKyc)
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          banned: user.banned,
          shopName: user.shopName,
          warehouseName: user.warehouseName,
          ownerName: user.ownerName,
          sellerStatus: user.sellerStatus,
          createdAt: user.createdAt,
          applicationNumber: latestApp.applicationNumber,
          appStatus: latestApp.appStatus,
          district: latestApp.district,
          area: latestApp.area,
          businessNature: latestApp.businessNature,
          productTypeName: productType.name,
          latestKycStatus: latestKyc.kycStatus,
        })
        .from(user)
        .leftJoin(latestApp, eq(user.id, latestApp.userId))
        .leftJoin(latestKyc, eq(user.id, latestKyc.userId))
        .leftJoin(productType, eq(latestApp.productTypeId, productType.id))
        .where(whereClause)
        .orderBy(desc(user.createdAt))
        .limit(pageSize)
        .offset(offset);

      const countResult = await db
        .with(latestApp, latestKyc)
        .select({ count: count() })
        .from(user)
        .leftJoin(latestApp, eq(user.id, latestApp.userId))
        .leftJoin(latestKyc, eq(user.id, latestKyc.userId))
        .leftJoin(productType, eq(latestApp.productTypeId, productType.id))
        .where(whereClause);

      const totalCount = countResult[0]?.count ?? 0;

      const users = rows.map((row) => {
        const businessName = isRetailer
          ? row.shopName || row.name
          : row.warehouseName || row.name;
        const location = row.district || row.area || null;
        const kycStatus = deriveKycStatus(row.latestKycStatus);
        const accountStatus = deriveAccountStatus(
          row.banned,
          row.sellerStatus,
          row.appStatus,
        );
        const typeLabel = isRetailer
          ? row.productTypeName || row.businessNature || null
          : formatBusinessNature(row.businessNature);

        return {
          id: row.id,
          applicationNumber: row.applicationNumber,
          businessName,
          ownerName: row.ownerName || row.name,
          phoneNumber: row.phoneNumber,
          location,
          kycStatus,
          accountStatus,
          typeLabel,
          createdAt: row.createdAt,
        };
      });

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

      if (!role) {
        throw new ORPCError("BAD_REQUEST", {
          message: "role is required for stats",
        });
      }

      const roleFilter = eq(user.role, role);

      const totalResult = await db
        .select({ count: count() })
        .from(user)
        .where(roleFilter);

      const suspendedResult = await db
        .select({ count: count() })
        .from(user)
        .where(and(roleFilter, eq(user.banned, true)));

      const pendingCount = await countUsersWithLatestApp(
        role,
        sql`(u.banned IS NOT TRUE) AND (u.seller_status = 'pending' OR la.status = 'pending')`,
      );

      const activeCount = await countUsersWithLatestApp(
        role,
        sql`(u.banned IS NOT TRUE) AND NOT (u.seller_status = 'pending' OR la.status = 'pending')`,
      );

      const verifiedKycCount = await countUsersWithLatestKyc(role, "verified");

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const newThisMonthResult = await db
        .select({ count: count() })
        .from(user)
        .where(and(roleFilter, gte(user.createdAt, startOfMonth)));

      return {
        stats: {
          total: totalResult[0]?.count ?? 0,
          active: activeCount,
          pending: pendingCount,
          suspended: suspendedResult[0]?.count ?? 0,
          verifiedKyc: verifiedKycCount,
          newThisMonth: newThisMonthResult[0]?.count ?? 0,
        },
      };
    }),

  getGrowthTrend: adminProcedure
    .route({
      method: "GET",
      path: "/admin/users/growth-trend",
      tags: ["User Management"],
      summary: "Get user growth trend series",
    })
    .input(
      z.object({
        role: z.enum(["warehouse", "shop_owner"]),
        days: z.number().int().min(7).max(365).default(30),
      }),
    )
    .handler(async ({ input }) => {
      const { role, days } = input;
      const roleFilter = eq(user.role, role);

      const now = new Date();
      const todayUtc = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      );
      const windowStart = new Date(todayUtc - (days - 1) * DAY_MS);
      const previousStart = new Date(windowStart.getTime() - days * DAY_MS);

      const signupRows = await db
        .select({
          day: sql<string>`TO_CHAR(${user.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          signups: count(),
        })
        .from(user)
        .where(and(roleFilter, gte(user.createdAt, windowStart)))
        .groupBy(sql`TO_CHAR(${user.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

      const signupsByDay = new Map(
        signupRows.map((row) => [row.day, Number(row.signups)]),
      );

      // Users that already existed when the window opened — the cumulative
      // series starts from this baseline rather than from zero.
      const baselineResult = await db
        .select({ count: count() })
        .from(user)
        .where(and(roleFilter, lt(user.createdAt, windowStart)));
      const baseline = baselineResult[0]?.count ?? 0;

      const previousResult = await db
        .select({ count: count() })
        .from(user)
        .where(
          and(
            roleFilter,
            gte(user.createdAt, previousStart),
            lt(user.createdAt, windowStart),
          ),
        );
      const previousNewUsers = previousResult[0]?.count ?? 0;

      const points: { label: string; value: number }[] = [];
      let runningTotal = baseline;
      let newUsers = 0;

      for (let i = 0; i < days; i++) {
        const day = new Date(windowStart.getTime() + i * DAY_MS);
        const signups = signupsByDay.get(utcDayKey(day)) ?? 0;
        runningTotal += signups;
        newUsers += signups;
        points.push({ label: utcDayLabel(day), value: runningTotal });
      }

      let growthPercent: number;
      if (previousNewUsers > 0) {
        growthPercent =
          Math.round(((newUsers - previousNewUsers) / previousNewUsers) * 1000) /
          10;
      } else {
        growthPercent = newUsers > 0 ? 100 : 0;
      }

      return {
        points,
        growthPercent,
        newUsers,
        previousNewUsers,
        totalUsers: runningTotal,
      };
    }),

  getFilterOptions: adminProcedure
    .route({
      method: "GET",
      path: "/admin/users/filter-options",
      tags: ["User Management"],
      summary: "Get filter dropdown options for user list",
    })
    .input(
      z.object({
        role: z.enum(["warehouse", "shop_owner"]),
      }),
    )
    .handler(async ({ input }) => {
      const appTable =
        input.role === "shop_owner"
          ? sellerApplication
          : warehouseApplication;

      const rows = await db
        .selectDistinct({ district: appTable.district })
        .from(appTable)
        .where(
          sql`${appTable.district} IS NOT NULL AND ${appTable.district} != ''`,
        );

      const districts = rows
        .map((r) => r.district)
        .filter((d): d is string => Boolean(d))
        .sort((a, b) => a.localeCompare(b));

      return { districts };
    }),

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

      let application: Record<string, unknown> | null = null;
      let applicationId: string | null = null;

      if (found.role === "shop_owner") {
        const apps = await db.query.sellerApplication.findMany({
          where: eq(sellerApplication.userId, input.userId),
          orderBy: [desc(sellerApplication.createdAt)],
          limit: 1,
          with: {
            productType: { columns: { id: true, name: true } },
          },
        });
        const app = apps[0];
        if (app) {
          application = app as Record<string, unknown>;
          applicationId = app.id;
        }
      } else if (found.role === "warehouse") {
        const apps = await db.query.warehouseApplication.findMany({
          where: eq(warehouseApplication.userId, input.userId),
          orderBy: [desc(warehouseApplication.createdAt)],
          limit: 1,
          with: {
            productType: { columns: { id: true, name: true } },
          },
        });
        const app = apps[0];
        if (app) {
          application = app as Record<string, unknown>;
          applicationId = app.id;
        }
      }

      const appStatus = application?.status as string | undefined;
      let latestKyc = await db.query.kycVerification.findFirst({
        where: eq(kycVerification.userId, input.userId),
        orderBy: [desc(kycVerification.createdAt)],
      });

      if (
        (found.role === "shop_owner" || found.role === "warehouse") &&
        !latestKyc
      ) {
        latestKyc = await ensurePendingKycForUser(input.userId);
      }

      const kycStatus = deriveKycStatus(latestKyc?.status);
      const applicationNumber = application?.applicationNumber as
        | string
        | null
        | undefined;

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
          shopName: found.shopName,
          shopSlug: found.shopSlug,
          shopAddress: found.shopAddress,
          ownerName: found.ownerName,
          businessType: found.businessType,
          isSeller: found.isSeller,
          sellerStatus: found.sellerStatus,
          warehouseName: found.warehouseName,
          warehouseSlug: found.warehouseSlug,
          warehouseAddress: found.warehouseAddress,
          shopLat: found.shopLat,
          shopLng: found.shopLng,
          warehouseLat: found.warehouseLat,
          warehouseLng: found.warehouseLng,
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
        application,
        applicationId,
        accountMeta: {
          displayId:
            applicationNumber ||
            `${found.role === "warehouse" ? "WH" : "SEL"}-${found.id.slice(0, 8).toUpperCase()}`,
          kycStatus,
          kycId: latestKyc?.id ?? null,
          kycReviewedAt:
            latestKyc?.status === "verified" ? latestKyc.reviewedAt : null,
          canVerifyKyc: kycStatus !== "verified",
          profileCompletion: computeProfileCompletion(application, found),
          accountStatus: deriveAccountStatus(
            found.banned,
            found.sellerStatus,
            appStatus,
          ),
        },
        applicationStatus: application
          ? {
              type: found.role === "shop_owner" ? "seller" : "warehouse",
              status: appStatus ?? "unknown",
              appliedAt: application.createdAt as Date,
              reviewedAt: (application.reviewedAt as Date | null) ?? null,
            }
          : null,
      };
    }),

  verify: adminProcedure
    .route({
      method: "POST",
      path: "/admin/users/{userId}/verify",
      tags: ["User Management"],
      summary: "Verify a user's KYC documents (independent of application approval)",
    })
    .input(
      z.object({
        userId: z.string().min(1),
        adminNotes: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const found = await db.query.user.findFirst({
        where: eq(user.id, input.userId),
      });

      if (!found) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
      }

      if (found.role !== "shop_owner" && found.role !== "warehouse") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only retailer and wholesaler users can be KYC verified",
        });
      }

      const updated = await verifyKycForUser(input.userId, {
        adminId: context.session.user.id,
        adminNotes: input.adminNotes,
      });

      return {
        success: true,
        kycStatus: updated.status,
      };
    }),

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
