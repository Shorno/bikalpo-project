import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type Column, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import {
    sellerApplication,
    warehouseApplication,
} from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

const applicationStatusSchema = z.enum(["pending", "approved", "rejected"]);
const listStatusSchema = z.enum(["pending", "approved", "rejected", "all"]);
const applicationTypeSchema = z.enum(["seller", "warehouse", "all"]);
const referralFilterSchema = z.enum(["direct", "invited", "all"]);

const listInputSchema = z.object({
    search: z.string().optional(),
    status: listStatusSchema.default("all"),
    type: applicationTypeSchema.default("all"),
    district: z.string().optional(),
    referral: referralFilterSchema.default("all"),
    page: z.number().default(1),
    limit: z.number().default(20),
});

type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export type UnifiedApplicationRow = {
    id: string;
    type: "seller" | "warehouse";
    applicationNumber: string | null;
    businessName: string;
    ownerName: string;
    phoneNumber: string;
    location: string | null;
    businessNature: string | null;
    businessType: string | null;
    status: ApplicationStatus;
    createdAt: Date;
    detailHref: string;
};

function buildSearchCondition(
    search: string,
    ownerName: Column,
    phoneNumber: Column,
    applicationNumber: Column,
    businessName: Column,
): SQL {
    const term = `%${search.trim()}%`;
    return or(
        ilike(ownerName, term),
        ilike(phoneNumber, term),
        ilike(applicationNumber, term),
        ilike(businessName, term),
    )!;
}

function buildSellerConditions(input: z.infer<typeof listInputSchema>) {
    const conditions: SQL[] = [];

    if (input.status !== "all") {
        conditions.push(eq(sellerApplication.status, input.status));
    }
    if (input.district && input.district !== "all") {
        conditions.push(eq(sellerApplication.district, input.district));
    }
    if (input.referral === "direct") {
        conditions.push(isNull(sellerApplication.referralId));
    } else if (input.referral === "invited") {
        conditions.push(isNotNull(sellerApplication.referralId));
    }
    if (input.search?.trim()) {
        conditions.push(
            buildSearchCondition(
                input.search,
                sellerApplication.ownerName,
                sellerApplication.phoneNumber,
                sellerApplication.applicationNumber,
                sellerApplication.shopName,
            ),
        );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildWarehouseConditions(input: z.infer<typeof listInputSchema>) {
    const conditions: SQL[] = [];

    if (input.status !== "all") {
        conditions.push(eq(warehouseApplication.status, input.status));
    }
    if (input.district && input.district !== "all") {
        conditions.push(eq(warehouseApplication.district, input.district));
    }
    if (input.referral === "direct") {
        conditions.push(isNull(warehouseApplication.referralId));
    } else if (input.referral === "invited") {
        conditions.push(isNotNull(warehouseApplication.referralId));
    }
    if (input.search?.trim()) {
        conditions.push(
            buildSearchCondition(
                input.search,
                warehouseApplication.ownerName,
                warehouseApplication.phoneNumber,
                warehouseApplication.applicationNumber,
                warehouseApplication.warehouseName,
            ),
        );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
}

type SellerApplicationListRow = {
    id: string;
    applicationNumber: string | null;
    shopName: string;
    ownerName: string;
    phoneNumber: string;
    district: string | null;
    area: string | null;
    businessNature: string | null;
    businessCategory: string | null;
    status: string;
    createdAt: Date;
    productType?: { name: string } | null;
};

type WarehouseApplicationListRow = {
    id: string;
    applicationNumber: string | null;
    warehouseName: string;
    ownerName: string;
    phoneNumber: string;
    district: string | null;
    area: string | null;
    businessNature: string | null;
    businessCategory: string | null;
    status: string;
    createdAt: Date;
    productType?: { name: string } | null;
};

function mapSellerRow(app: SellerApplicationListRow): UnifiedApplicationRow {
    return {
        id: app.id,
        type: "seller",
        applicationNumber: app.applicationNumber,
        businessName: app.shopName,
        ownerName: app.ownerName,
        phoneNumber: app.phoneNumber,
        location: app.district || app.area || null,
        businessNature: app.businessNature,
        businessType: app.productType?.name ?? app.businessCategory,
        status: app.status as ApplicationStatus,
        createdAt: app.createdAt,
        detailHref: `/dashboard/admin/seller-applications/${app.id}`,
    };
}

function mapWarehouseRow(app: WarehouseApplicationListRow): UnifiedApplicationRow {
    return {
        id: app.id,
        type: "warehouse",
        applicationNumber: app.applicationNumber,
        businessName: app.warehouseName,
        ownerName: app.ownerName,
        phoneNumber: app.phoneNumber,
        location: app.district || app.area || null,
        businessNature: app.businessNature,
        businessType: app.productType?.name ?? app.businessCategory,
        status: app.status as ApplicationStatus,
        createdAt: app.createdAt,
        detailHref: `/dashboard/admin/warehouse-applications/${app.id}`,
    };
}

async function countByStatus(
    table: typeof sellerApplication | typeof warehouseApplication,
) {
    const [pending, approved, rejected, total] = await Promise.all([
        db
            .select({ count: count() })
            .from(table)
            .where(eq(table.status, "pending")),
        db
            .select({ count: count() })
            .from(table)
            .where(eq(table.status, "approved")),
        db
            .select({ count: count() })
            .from(table)
            .where(eq(table.status, "rejected")),
        db.select({ count: count() }).from(table),
    ]);

    return {
        pending: Number(pending[0]?.count ?? 0),
        approved: Number(approved[0]?.count ?? 0),
        rejected: Number(rejected[0]?.count ?? 0),
        total: Number(total[0]?.count ?? 0),
    };
}

export const adminApplicationRouter = {
    getOverview: adminProcedure
        .route({
            method: "GET",
            path: "/admin/applications/overview",
            tags: ["Admin Application"],
            summary: "Get unified application KPI counts",
        })
        .handler(async () => {
            const [seller, warehouse] = await Promise.all([
                countByStatus(sellerApplication),
                countByStatus(warehouseApplication),
            ]);

            return {
                total: seller.total + warehouse.total,
                pending: seller.pending + warehouse.pending,
                approved: seller.approved + warehouse.approved,
                rejected: seller.rejected + warehouse.rejected,
                pendingSeller: seller.pending,
                pendingWarehouse: warehouse.pending,
            };
        }),

    getFilterOptions: adminProcedure
        .route({
            method: "GET",
            path: "/admin/applications/filter-options",
            tags: ["Admin Application"],
            summary: "Get filter dropdown options for applications list",
        })
        .handler(async () => {
            const [sellerDistricts, warehouseDistricts] = await Promise.all([
                db
                    .selectDistinct({ district: sellerApplication.district })
                    .from(sellerApplication)
                    .where(
                        sql`${sellerApplication.district} IS NOT NULL AND ${sellerApplication.district} != ''`,
                    ),
                db
                    .selectDistinct({ district: warehouseApplication.district })
                    .from(warehouseApplication)
                    .where(
                        sql`${warehouseApplication.district} IS NOT NULL AND ${warehouseApplication.district} != ''`,
                    ),
            ]);

            const districts = [
                ...new Set(
                    [
                        ...sellerDistricts.map((r) => r.district),
                        ...warehouseDistricts.map((r) => r.district),
                    ].filter((d): d is string => Boolean(d)),
                ),
            ].sort((a, b) => a.localeCompare(b));

            return { districts };
        }),

    list: adminProcedure
        .route({
            method: "GET",
            path: "/admin/applications",
            tags: ["Admin Application"],
            summary: "List unified seller and warehouse applications",
        })
        .input(listInputSchema)
        .handler(async ({ input }) => {
            const includeSeller = input.type === "all" || input.type === "seller";
            const includeWarehouse =
                input.type === "all" || input.type === "warehouse";

            const productTypeColumns = {
                columns: { id: true, name: true },
            } as const;

            const [sellerRows, warehouseRows] = await Promise.all([
                includeSeller
                    ? db.query.sellerApplication.findMany({
                          where: buildSellerConditions(input),
                          with: { productType: productTypeColumns },
                          orderBy: [desc(sellerApplication.createdAt)],
                      })
                    : Promise.resolve([]),
                includeWarehouse
                    ? db.query.warehouseApplication.findMany({
                          where: buildWarehouseConditions(input),
                          with: { productType: productTypeColumns },
                          orderBy: [desc(warehouseApplication.createdAt)],
                      })
                    : Promise.resolve([]),
            ]);

            const merged = [
                ...sellerRows.map((row) => mapSellerRow(row as SellerApplicationListRow)),
                ...warehouseRows.map((row) =>
                    mapWarehouseRow(row as WarehouseApplicationListRow),
                ),
            ].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
            );

            const total = merged.length;
            const offset = (input.page - 1) * input.limit;
            const items = merged.slice(offset, offset + input.limit);

            return {
                items,
                total,
                page: input.page,
                limit: input.limit,
            };
        }),
};
