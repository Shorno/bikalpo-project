import { db } from "@bikalpo-project/db";
import { and, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { BUSINESS_NATURES } from "../business-registration";
import { adminProcedure } from "../index";

const applicationStatusSchema = z.enum(["pending", "approved", "rejected"]);
const listInputSchema = z.object({
  search: z.string().optional(),
  status: z
    .enum([
      "all",
      "active",
      "verified",
      "pending",
      "suspended",
      "approved",
      "rejected",
    ])
    .default("all"),
  type: z.enum(["seller", "warehouse", "all"]).default("all"),
  businessNature: z
    .enum(["all", "unspecified", ...BUSINESS_NATURES])
    .default("all"),
  businessType: z.string().optional(),
  district: z.string().optional(),
  referral: z.enum(["direct", "invited", "all"]).default("all"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
const overviewInputSchema = listInputSchema.omit({ page: true, limit: true });
type RequestFilters = z.infer<typeof overviewInputSchema>;

export type UnifiedApplicationRow = {
  id: string;
  type: "seller" | "warehouse";
  applicationNumber: string | null;
  businessName: string;
  ownerName: string;
  phoneNumber: string;
  location: string | null;
  businessNature: string | null;
  productTypeName: string | null;
  status: z.infer<typeof applicationStatusSchema>;
  createdAt: Date;
  detailHref: string;
};

function rowsFromResult<T>(result: unknown): T[] {
  return Array.isArray(result)
    ? (result as T[])
    : ((result as { rows?: T[] }).rows ?? []);
}

// One request projection keeps filtering, counts and pagination on the same data.
function requestsCte(): SQL {
  return sql`
    requests AS (
      SELECT id, 'seller'::text AS type, user_id, application_number,
        shop_name AS business_name, owner_name, phone_number,
        district, area, business_nature, product_type_id, business_category,
        referral_id, status, created_at
      FROM seller_application
      UNION ALL
      SELECT id, 'warehouse'::text AS type, user_id, application_number,
        warehouse_name AS business_name, owner_name, phone_number,
        district, area, business_nature, product_type_id, business_category,
        referral_id, status, created_at
      FROM warehouse_application
    ), projected_requests AS (
      SELECT r.id, r.type, r.application_number AS "applicationNumber",
        r.business_name AS "businessName", r.owner_name AS "ownerName",
        r.phone_number AS "phoneNumber",
        COALESCE(NULLIF(r.district, ''), NULLIF(r.area, '')) AS location,
        r.business_nature AS "businessNature",
        COALESCE(NULLIF(pt.name, ''), NULLIF(r.business_category, '')) AS "productTypeName",
        r.referral_id AS "referralId", r.status, r.created_at AS "createdAt",
        COALESCE(u.banned, false) AS suspended, lk.status AS "kycStatus"
      FROM requests r
      JOIN "user" u ON u.id = r.user_id
      LEFT JOIN product_type pt ON pt.id = r.product_type_id
      LEFT JOIN LATERAL (
        SELECT status FROM kyc_verification
        WHERE user_id = r.user_id
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) lk ON true
    )
  `;
}

function requestWhere(filters: RequestFilters): SQL {
  const conditions: SQL[] = [];
  if (filters.status === "suspended") conditions.push(sql`p.suspended IS TRUE`);
  else if (filters.status === "verified") {
    conditions.push(sql`p."kycStatus" = 'verified' AND p.suspended IS FALSE`);
  } else if (filters.status === "active") {
    conditions.push(sql`p.status = 'approved' AND p.suspended IS FALSE`);
  } else if (filters.status === "pending") {
    conditions.push(sql`p.status = 'pending' AND p.suspended IS FALSE`);
  } else if (filters.status !== "all") {
    // Retained for existing callers that filter by the application decision.
    conditions.push(sql`p.status = ${filters.status}`);
  }
  if (filters.type !== "all") conditions.push(sql`p.type = ${filters.type}`);
  if (filters.businessNature === "unspecified")
    conditions.push(sql`p."businessNature" IS NULL`);
  else if (filters.businessNature !== "all")
    conditions.push(sql`p."businessNature" = ${filters.businessNature}`);
  if (filters.businessType && filters.businessType !== "all")
    conditions.push(sql`p."productTypeName" = ${filters.businessType}`);
  if (filters.district && filters.district !== "all")
    conditions.push(sql`p.location = ${filters.district}`);
  if (filters.referral === "direct")
    conditions.push(sql`p."referralId" IS NULL`);
  else if (filters.referral === "invited")
    conditions.push(sql`p."referralId" IS NOT NULL`);
  if (filters.search?.trim()) {
    const term = "%" + filters.search.trim().replace(/[\\%_]/g, "\\$&") + "%";
    conditions.push(sql`(
      p."ownerName" ILIKE ${term} OR p."phoneNumber" ILIKE ${term}
      OR p."applicationNumber" ILIKE ${term} OR p."businessName" ILIKE ${term}
    )`);
  }
  return and(...conditions) ?? sql`TRUE`;
}

export const adminApplicationRouter = {
  getOverview: adminProcedure
    .route({
      method: "GET",
      path: "/admin/applications/overview",
      tags: ["Admin Application"],
      summary: "Get filtered application counts",
    })
    .input(overviewInputSchema)
    .handler(async ({ input }) => {
      const filters = overviewInputSchema.parse(input);
      const result = await db.execute(sql`
        WITH ${requestsCte()}
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE p.status = 'pending')::int AS pending,
          count(*) FILTER (WHERE p.status = 'approved')::int AS approved,
          count(*) FILTER (WHERE p.status = 'rejected')::int AS rejected,
          count(*) FILTER (WHERE p.suspended)::int AS suspended,
          count(*) FILTER (WHERE p.status = 'pending' AND p.type = 'seller')::int AS "pendingShopOwner",
          count(*) FILTER (WHERE p.status = 'pending' AND p.type = 'warehouse')::int AS "pendingWarehouseOwner"
        FROM projected_requests p WHERE ${requestWhere(filters)}
      `);
      const counts = rowsFromResult<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        suspended: number;
        pendingShopOwner: number;
        pendingWarehouseOwner: number;
      }>(result)[0];
      if (!counts) throw new Error("Application counts returned no result");
      return { ...counts, frozen: null };
    }),

  getFilterOptions: adminProcedure
    .route({
      method: "GET",
      path: "/admin/applications/filter-options",
      tags: ["Admin Application"],
      summary: "Get recorded request filter options",
    })
    .handler(async () => {
      const result = await db.execute(sql`
        WITH ${requestsCte()}
        SELECT DISTINCT location, "businessNature", "productTypeName"
        FROM projected_requests
      `);
      const rows = rowsFromResult<{
        location: string | null;
        businessNature: string | null;
        productTypeName: string | null;
      }>(result);
      const distinct = (values: (string | null)[]) =>
        [
          ...new Set(values.filter((value): value is string => Boolean(value))),
        ].sort((a, b) => a.localeCompare(b));
      return {
        districts: distinct(rows.map((row) => row.location)),
        businessTypes: distinct(rows.map((row) => row.productTypeName)),
        businessNatures: [
          ...(rows.some((row) => !row.businessNature)
            ? ["unspecified" as const]
            : []),
          ...BUSINESS_NATURES.filter((nature) =>
            rows.some((row) => row.businessNature === nature),
          ),
        ],
      };
    }),

  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/applications",
      tags: ["Admin Application"],
      summary: "List retailer and warehouse requests",
    })
    .input(listInputSchema)
    .handler(async ({ input }) => {
      const filters = listInputSchema.parse(input);
      const where = requestWhere(filters);
      const [countResult, listResult] = await Promise.all([
        db.execute(sql`
          WITH ${requestsCte()}
          SELECT count(*)::int AS total FROM projected_requests p WHERE ${where}
        `),
        db.execute(sql`
          WITH ${requestsCte()}
          SELECT p.id, p.type, p."applicationNumber", p."businessName",
            p."ownerName", p."phoneNumber", p.location, p."businessNature",
            p."productTypeName", p.status, p."createdAt"
          FROM projected_requests p WHERE ${where}
          ORDER BY p."createdAt" DESC, p.type, p.id
          LIMIT ${filters.limit} OFFSET ${(filters.page - 1) * filters.limit}
        `),
      ]);
      const count = rowsFromResult<{ total: number }>(countResult)[0];
      if (!count) throw new Error("Application count returned no result");
      const items = rowsFromResult<Omit<UnifiedApplicationRow, "detailHref">>(
        listResult,
      ).map((row) => ({
        ...row,
        detailHref:
          "/dashboard/admin/user-overview/approval/" + row.type + "/" + row.id,
      }));
      return {
        items,
        total: count.total,
        page: filters.page,
        limit: filters.limit,
      };
    }),
};
