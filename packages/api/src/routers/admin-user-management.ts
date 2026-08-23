import {
  getPhoneAuthEmail,
  isPhoneAuthEmail,
  normalizeBangladeshPhoneNumber,
} from "@bikalpo-project/auth/phone-identity";
import { db } from "@bikalpo-project/db";
import {
  kycVerification,
  sellerApplication,
  session,
  user,
  warehouseApplication,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ne, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { BUSINESS_NATURES } from "../business-registration";
import { adminProcedure } from "../index";
import {
  deriveKycStatus,
  ensurePendingKycForUser,
  verifyKycForUser,
} from "./helpers/kyc-verification";

// ─── Types & helpers ───────────────────────────────────────────

type AccountStatus = "active" | "pending" | "suspended";
type UserRole = "warehouse" | "shop_owner";
type KycFilter = "all" | "verified" | "unverified" | "pending" | "failed";
type BusinessNatureFilter = "all" | "unspecified" | (typeof BUSINESS_NATURES)[number];

const accountStatusSchema = z.enum(["active", "pending", "suspended", "all"]);
const kycFilterSchema = z.enum(["all", "verified", "unverified", "pending", "failed"]);
const businessNatureFilterSchema = z.enum(["all", "unspecified", ...BUSINESS_NATURES]);

const userOverviewFiltersSchema = z.object({
  role: z.enum(["warehouse", "shop_owner"]),
  status: accountStatusSchema.default("all"),
  kyc: kycFilterSchema.default("all"),
  businessNature: businessNatureFilterSchema.default("all"),
  district: z.string().optional(),
  search: z.string().optional(),
});

const listInputSchema = userOverviewFiltersSchema.extend({
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
  role: string | null | undefined,
  banned: boolean | null,
  sellerStatus: string | null | undefined,
  appStatus: string | null | undefined,
): boolean {
  if (banned) return false;
  return appStatus === "pending" || (role === "shop_owner" && sellerStatus === "pending");
}

function deriveAccountStatus(
  role: string | null | undefined,
  banned: boolean | null,
  sellerStatus: string | null | undefined,
  appStatus: string | null | undefined,
): AccountStatus {
  if (banned) return "suspended";
  if (isUserPending(role, banned, sellerStatus, appStatus)) return "pending";
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
  return `${MONTH_LABELS[date.getUTCMonth()]}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

type UserOverviewFilters = {
  role: UserRole;
  status: "active" | "pending" | "suspended" | "all";
  kyc: KycFilter;
  businessNature: BusinessNatureFilter;
  district?: string;
  search?: string;
};

type ProjectedUserRow = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: UserRole;
  banned: boolean | null;
  shopName: string | null;
  warehouseName: string | null;
  ownerName: string | null;
  sellerStatus: string | null;
  createdAt: Date;
  applicationNumber: string | null;
  appStatus: string | null;
  district: string | null;
  area: string | null;
  businessNature: string | null;
  productTypeName: string | null;
  kycStatus: string | null;
  approvedAt: Date | null;
  accountStatus: AccountStatus;
};

function rowsFromResult<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result as { rows?: T[] }).rows ?? [];
}

function projectedUsersCte(role: UserRole): SQL {
  const applicationTable = sql.raw(
    role === "shop_owner" ? "seller_application" : "warehouse_application",
  );
  const pendingCondition =
    role === "shop_owner"
      ? sql`(u.seller_status = 'pending' OR la.status = 'pending')`
      : sql`la.status = 'pending'`;

  return sql`
    projected_users AS (
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number AS "phoneNumber",
        u.role,
        u.banned,
        u.shop_name AS "shopName",
        u.warehouse_name AS "warehouseName",
        u.owner_name AS "ownerName",
        u.seller_status AS "sellerStatus",
        u.created_at AS "createdAt",
        la.application_number AS "applicationNumber",
        la.status AS "appStatus",
        la.district,
        la.area,
        la.business_nature AS "businessNature",
        COALESCE(pt.name, la.business_category) AS "productTypeName",
        lk.status AS "kycStatus",
        CASE
          WHEN la.status = 'approved' THEN la.reviewed_at
          ELSE NULL
        END AS "approvedAt",
        CASE
          WHEN u.banned IS TRUE THEN 'suspended'
          WHEN ${pendingCondition} THEN 'pending'
          ELSE 'active'
        END AS "accountStatus"
      FROM "user" u
      LEFT JOIN LATERAL (
        SELECT
          application_number,
          status,
          district,
          area,
          business_nature,
          product_type_id,
          business_category,
          reviewed_at
        FROM ${applicationTable}
        WHERE user_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
      ) la ON true
      LEFT JOIN product_type pt ON pt.id = la.product_type_id
      LEFT JOIN LATERAL (
        SELECT status
        FROM kyc_verification
        WHERE user_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
      ) lk ON true
      WHERE u.role = ${role}
    )
  `;
}

function accountStatusPredicate(status: UserOverviewFilters["status"]): SQL {
  return status === "all" ? sql`TRUE` : sql`p."accountStatus" = ${status}`;
}

function kycPredicate(kyc: KycFilter): SQL {
  if (kyc === "all") return sql`TRUE`;
  if (kyc === "unverified") return sql`p."kycStatus" IS NULL`;
  return sql`p."kycStatus" = ${kyc}`;
}

function projectedUserWhere(
  filters: UserOverviewFilters,
  options: { includeStatus?: boolean; includeKyc?: boolean } = {},
): SQL {
  const conditions: SQL[] = [];
  const includeStatus = options.includeStatus ?? true;
  const includeKyc = options.includeKyc ?? true;

  if (includeStatus) conditions.push(accountStatusPredicate(filters.status));
  if (includeKyc) conditions.push(kycPredicate(filters.kyc));

  if (filters.businessNature === "unspecified") {
    conditions.push(sql`p."businessNature" IS NULL`);
  } else if (filters.businessNature !== "all") {
    conditions.push(sql`p."businessNature" = ${filters.businessNature}`);
  }

  if (filters.district && filters.district !== "all") {
    conditions.push(sql`p.district = ${filters.district}`);
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(sql`(
      p.name ILIKE ${term}
      OR p."phoneNumber" ILIKE ${term}
      OR p.email ILIKE ${term}
      OR p."shopName" ILIKE ${term}
      OR p."warehouseName" ILIKE ${term}
      OR p."ownerName" ILIKE ${term}
      OR p."applicationNumber" ILIKE ${term}
    )`);
  }

  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
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

// ─── Router ────────────────────────────────────────────────────

export const adminUserManagementRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/users",
      tags: ["User Management"],
      summary: "List warehouse owner and shop owner users",
    })
    .input(listInputSchema)
    .handler(async ({ input }) => {
      const { role, page, pageSize } = input;
      const offset = (page - 1) * pageSize;
      const projection = projectedUsersCte(role);
      const whereClause = projectedUserWhere(input);
      const [listResult, countResult] = await Promise.all([
        db.execute<ProjectedUserRow>(sql`
          WITH ${projection}
          SELECT *
          FROM projected_users p
          ${whereClause}
          ORDER BY p."createdAt" DESC
          LIMIT ${pageSize}
          OFFSET ${offset}
        `),
        db.execute<{ count: number }>(sql`
          WITH ${projection}
          SELECT COUNT(*)::int AS count
          FROM projected_users p
          ${whereClause}
        `),
      ]);
      const rows = rowsFromResult<ProjectedUserRow>(listResult);
      const totalCount = Number(rowsFromResult<{ count: number }>(countResult)[0]?.count ?? 0);
      const isShopOwner = role === "shop_owner";

      const users = rows.map((row) => {
        const businessName = isShopOwner ? row.shopName || row.name : row.warehouseName || row.name;
        const location = row.district || row.area || null;
        const kycStatus = deriveKycStatus(row.kycStatus);

        return {
          id: row.id,
          applicationNumber: row.applicationNumber,
          businessName,
          ownerName: row.ownerName || row.name,
          phoneNumber: row.phoneNumber,
          location,
          kycStatus,
          accountStatus: row.accountStatus,
          businessNature: row.businessNature,
          businessNatureLabel: formatBusinessNature(row.businessNature) ?? "Unspecified (legacy)",
          productTypeName: row.productTypeName,
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
    .input(userOverviewFiltersSchema)
    .handler(async ({ input }) => {
      const projection = projectedUsersCte(input.role);
      const baseWhere = projectedUserWhere(input, {
        includeStatus: false,
        includeKyc: false,
      });
      const selectedKyc = kycPredicate(input.kyc);
      const selectedStatus = accountStatusPredicate(input.status);

      const result = await db.execute<{
        total: number;
        active: number;
        pendingRoleUsers: number;
        suspended: number;
        verifiedKyc: number;
      }>(sql`
        WITH ${projection}
        SELECT
          COUNT(*) FILTER (WHERE ${selectedKyc})::int AS total,
          COUNT(*) FILTER (
            WHERE ${selectedKyc} AND p."accountStatus" = 'active'
          )::int AS active,
          COUNT(*) FILTER (
            WHERE ${selectedKyc} AND p."accountStatus" = 'pending'
          )::int AS "pendingRoleUsers",
          COUNT(*) FILTER (
            WHERE ${selectedKyc} AND p."accountStatus" = 'suspended'
          )::int AS suspended,
          COUNT(*) FILTER (
            WHERE p."kycStatus" = 'verified' AND ${selectedStatus}
          )::int AS "verifiedKyc"
        FROM projected_users p
        ${baseWhere}
      `);
      const stats = rowsFromResult<{
        total: number;
        active: number;
        pendingRoleUsers: number;
        suspended: number;
        verifiedKyc: number;
      }>(result)[0];

      return {
        stats: {
          total: Number(stats?.total ?? 0),
          active: Number(stats?.active ?? 0),
          pendingRoleUsers: Number(stats?.pendingRoleUsers ?? 0),
          suspended: Number(stats?.suspended ?? 0),
          verifiedKyc: Number(stats?.verifiedKyc ?? 0),
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
      userOverviewFiltersSchema.extend({
        days: z.number().int().min(7).max(365).default(30),
      }),
    )
    .handler(async ({ input }) => {
      const { role, days } = input;

      const now = new Date();
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const windowStart = new Date(todayUtc - (days - 1) * DAY_MS);
      const previousStart = new Date(windowStart.getTime() - days * DAY_MS);
      const windowEnd = new Date(todayUtc + DAY_MS);
      const projection = projectedUsersCte(role);
      const whereClause = projectedUserWhere(input);
      const result = await db.execute<{ approvedAt: Date | null }>(sql`
        WITH ${projection}
        SELECT p."approvedAt"
        FROM projected_users p
        ${whereClause}
      `);
      const rows = rowsFromResult<{ approvedAt: Date | null }>(result);
      const approvalsByDay = new Map<string, number>();
      let baseline = 0;
      let newApprovals = 0;
      let previousApprovals = 0;

      for (const row of rows) {
        const approvedAt = row.approvedAt ? new Date(row.approvedAt) : null;
        if (approvedAt && approvedAt >= previousStart && approvedAt < windowStart) {
          previousApprovals += 1;
        }

        if (approvedAt && approvedAt >= windowStart && approvedAt < windowEnd) {
          const key = utcDayKey(approvedAt);
          approvalsByDay.set(key, (approvalsByDay.get(key) ?? 0) + 1);
          newApprovals += 1;
        } else {
          // Legacy accounts and approvals outside the visible window remain
          // part of the opening role-user baseline.
          baseline += 1;
        }
      }

      const points: { label: string; value: number }[] = [];
      let runningTotal = baseline;

      for (let i = 0; i < days; i++) {
        const day = new Date(windowStart.getTime() + i * DAY_MS);
        runningTotal += approvalsByDay.get(utcDayKey(day)) ?? 0;
        points.push({ label: utcDayLabel(day), value: runningTotal });
      }

      let growthPercent: number;
      if (previousApprovals > 0) {
        growthPercent =
          Math.round(((newApprovals - previousApprovals) / previousApprovals) * 1000) / 10;
      } else {
        growthPercent = newApprovals > 0 ? 100 : 0;
      }

      return {
        points,
        growthPercent,
        newApprovals,
        previousApprovals,
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
      const projection = projectedUsersCte(input.role);
      const result = await db.execute<{
        district: string | null;
        businessNature: string | null;
      }>(sql`
        WITH ${projection}
        SELECT DISTINCT p.district, p."businessNature"
        FROM projected_users p
      `);
      const rows = rowsFromResult<{
        district: string | null;
        businessNature: string | null;
      }>(result);
      const districts = [
        ...new Set(rows.map((row) => row.district).filter((d): d is string => Boolean(d))),
      ].sort((a, b) => a.localeCompare(b));
      const rawBusinessNatures = rows.map((row) => row.businessNature);
      const businessNatures = [
        ...(rawBusinessNatures.some((nature) => !nature)
          ? (["unspecified"] as const)
          : []),
        ...BUSINESS_NATURES.filter((nature) =>
          rawBusinessNatures.includes(nature),
        ),
      ];

      return { districts, businessNatures };
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

      if ((found.role === "shop_owner" || found.role === "warehouse") && !latestKyc) {
        latestKyc = await ensurePendingKycForUser(input.userId);
      }

      const kycStatus = deriveKycStatus(latestKyc?.status);
      const applicationNumber = application?.applicationNumber as string | null | undefined;

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
          kycReviewedAt: latestKyc?.status === "verified" ? latestKyc.reviewedAt : null,
          canVerifyKyc: kycStatus !== "verified",
          profileCompletion: computeProfileCompletion(application, found),
          accountStatus: deriveAccountStatus(
            found.role,
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
          message: "Only shop owner and warehouse owner users can be KYC verified",
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
        phoneNumber: z
          .string()
          .trim()
          .refine(
            (value) =>
              value.length === 0 ||
              normalizeBangladeshPhoneNumber(value) !== null,
            "Enter a valid Bangladesh phone number",
          )
          .optional(),
        shopName: z.string().optional(),
        shopAddress: z.string().optional(),
        ownerName: z.string().optional(),
        warehouseName: z.string().optional(),
        warehouseAddress: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const { userId, ...updates } = input;
      const currentUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { id: true, email: true, phoneNumber: true },
      });

      if (!currentUser) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
      }

      const cleanUpdates: Record<string, string | boolean | null> = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined),
      );

      if (input.phoneNumber !== undefined) {
        const normalizedPhone = input.phoneNumber
          ? normalizeBangladeshPhoneNumber(input.phoneNumber)
          : null;
        const usesPhoneAuthEmail = isPhoneAuthEmail(currentUser.email);

        if (!normalizedPhone && usesPhoneAuthEmail) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A phone-auth account must keep a valid phone number",
          });
        }

        if (normalizedPhone !== currentUser.phoneNumber) {
          const nextEmail =
            normalizedPhone && usesPhoneAuthEmail
              ? getPhoneAuthEmail(normalizedPhone)
              : null;
          const identityConflict = normalizedPhone
            ? await db.query.user.findFirst({
                where: and(
                  ne(user.id, userId),
                  nextEmail
                    ? or(
                        eq(user.phoneNumber, normalizedPhone),
                        eq(user.email, nextEmail),
                      )
                    : eq(user.phoneNumber, normalizedPhone),
                ),
                columns: { id: true },
              })
            : null;

          if (identityConflict) {
            throw new ORPCError("CONFLICT", {
              message: "That phone number is already used by another account",
            });
          }

          cleanUpdates.phoneNumber = normalizedPhone;
          cleanUpdates.phoneNumberVerified = false;
          if (nextEmail) cleanUpdates.email = nextEmail;
        } else {
          delete cleanUpdates.phoneNumber;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No fields to update",
        });
      }

      await db.update(user).set(cleanUpdates).where(eq(user.id, userId));

      return { success: true };
    }),
};
