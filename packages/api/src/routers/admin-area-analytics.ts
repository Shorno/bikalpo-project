import { and, count, desc, eq, sql, isNull, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import {
    area,
    order,
    sellerAreaMapping,
    user,
} from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

// ─── Area Analytics Router ───
// Provides coverage gap reports, seller density data, area violations,
// and recruitment priority insights for admin dashboard.

export const adminAreaAnalyticsRouter = {
    /**
     * Coverage Gap Report — areas with few/no sellers.
     * Shows areas sorted by seller count (ascending) to highlight gaps.
     */
    coverageGapReport: adminProcedure
        .route({
            method: "GET",
            path: "/admin/area-analytics/coverage-gap",
            tags: ["Admin Area Analytics"],
            summary: "Coverage gap report",
            description: "Areas with few or no assigned sellers",
        })
        .handler(async () => {
            const gaps = await db
                .select({
                    areaId: area.id,
                    areaName: area.name,
                    areaSlug: area.slug,
                    isActive: area.isActive,
                    centerLat: area.centerLat,
                    centerLng: area.centerLng,
                    radiusKm: area.radiusKm,
                    sellerCount: count(sellerAreaMapping.id),
                    // Count orders in this area
                    orderCount: sql<number>`(
                        SELECT COUNT(*)::int FROM "order"
                        WHERE "order"."consumer_area_id" = ${area.id}
                    )`,
                })
                .from(area)
                .leftJoin(
                    sellerAreaMapping,
                    and(
                        eq(sellerAreaMapping.areaId, area.id),
                        eq(sellerAreaMapping.isActive, true),
                    ),
                )
                .groupBy(area.id)
                .orderBy(asc(count(sellerAreaMapping.id)), desc(area.id));

            return {
                areas: gaps,
                summary: {
                    totalAreas: gaps.length,
                    emptyAreas: gaps.filter((g) => g.sellerCount === 0).length,
                    underservedAreas: gaps.filter(
                        (g) => g.sellerCount > 0 && g.sellerCount <= 2,
                    ).length,
                    wellCoveredAreas: gaps.filter((g) => g.sellerCount > 2)
                        .length,
                },
            };
        }),

    /**
     * Seller Density Data — sellers with their coordinates for heatmap rendering.
     */
    sellerDensity: adminProcedure
        .route({
            method: "GET",
            path: "/admin/area-analytics/seller-density",
            tags: ["Admin Area Analytics"],
            summary: "Seller density data",
            description:
                "All sellers with coordinates for heatmap visualization",
        })
        .handler(async () => {
            // Get all sellers (shop owners) with location data
            const sellers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    shopName: user.shopName,
                    shopLat: user.shopLat,
                    shopLng: user.shopLng,
                    shopAddress: user.shopAddress,
                })
                .from(user)
                .where(
                    and(
                        eq(user.role, "shop_owner"),
                        sql`${user.shopLat} IS NOT NULL AND ${user.shopLng} IS NOT NULL`,
                    ),
                );

            // Also get all areas for overlay
            const areas = await db
                .select({
                    id: area.id,
                    name: area.name,
                    centerLat: area.centerLat,
                    centerLng: area.centerLng,
                    radiusKm: area.radiusKm,
                    polygon: area.polygon,
                    isActive: area.isActive,
                })
                .from(area)
                .where(eq(area.isActive, true));

            return { sellers, areas };
        }),

    /**
     * Area Violation Report — orders placed outside any defined area.
     * Shows orders where consumerAreaId is null (no area matched).
     */
    areaViolations: adminProcedure
        .route({
            method: "GET",
            path: "/admin/area-analytics/violations",
            tags: ["Admin Area Analytics"],
            summary: "Area violation report",
            description:
                "Orders placed from locations outside any defined area",
        })
        .input(
            z
                .object({
                    limit: z.number().int().min(1).max(100).default(50),
                    page: z.number().int().min(1).default(1),
                })
                .optional(),
        )
        .handler(async ({ input }) => {
            const limit = input?.limit ?? 50;
            const page = input?.page ?? 1;
            const offset = (page - 1) * limit;

            // Orders with location but no matched area
            const violations = await db
                .select({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    locationLat: order.locationLat,
                    locationLng: order.locationLng,
                    customerName: order.shippingName,
                    customerPhone: order.shippingPhone,
                    shippingAddress: order.shippingAddress,
                    shippingCity: order.shippingCity,
                    shippingArea: order.shippingArea,
                    createdAt: order.createdAt,
                    totalAmount: order.totalAmount,
                })
                .from(order)
                .where(
                    and(
                        isNull(order.consumerAreaId),
                        sql`${order.locationLat} IS NOT NULL`,
                        sql`${order.locationLng} IS NOT NULL`,
                    ),
                )
                .orderBy(desc(order.createdAt))
                .limit(limit)
                .offset(offset);

            // Total count
            const [totalResult] = await db
                .select({ count: count() })
                .from(order)
                .where(
                    and(
                        isNull(order.consumerAreaId),
                        sql`${order.locationLat} IS NOT NULL`,
                        sql`${order.locationLng} IS NOT NULL`,
                    ),
                );

            return {
                violations,
                pagination: {
                    page,
                    limit,
                    totalCount: totalResult?.count ?? 0,
                    totalPages: Math.ceil(
                        (totalResult?.count ?? 0) / limit,
                    ),
                },
            };
        }),

    /**
     * Area Recruitment Priority — areas ranked by demand vs supply.
     * Higher score = more urgent need for sellers.
     */
    recruitmentPriority: adminProcedure
        .route({
            method: "GET",
            path: "/admin/area-analytics/recruitment-priority",
            tags: ["Admin Area Analytics"],
            summary: "Area recruitment priority",
            description:
                "Areas ranked by need for more sellers (orders vs sellers ratio)",
        })
        .handler(async () => {
            const priorities = await db
                .select({
                    areaId: area.id,
                    areaName: area.name,
                    areaSlug: area.slug,
                    isActive: area.isActive,
                    sellerCount: count(sellerAreaMapping.id),
                    orderCount: sql<number>`(
                        SELECT COUNT(*)::int FROM "order"
                        WHERE "order"."consumer_area_id" = ${area.id}
                    )`,
                    // Priority score: orders per seller (higher = more urgent)
                    priorityScore: sql<number>`
                        CASE 
                            WHEN COUNT(${sellerAreaMapping.id}) = 0 THEN 999
                            ELSE (
                                SELECT COUNT(*)::int FROM "order"
                                WHERE "order"."consumer_area_id" = ${area.id}
                            )::float / NULLIF(COUNT(${sellerAreaMapping.id}), 0)
                        END
                    `,
                })
                .from(area)
                .leftJoin(
                    sellerAreaMapping,
                    and(
                        eq(sellerAreaMapping.areaId, area.id),
                        eq(sellerAreaMapping.isActive, true),
                    ),
                )
                .where(eq(area.isActive, true))
                .groupBy(area.id)
                .orderBy(
                    desc(
                        sql`CASE 
                            WHEN COUNT(${sellerAreaMapping.id}) = 0 THEN 999
                            ELSE (
                                SELECT COUNT(*)::int FROM "order"
                                WHERE "order"."consumer_area_id" = ${area.id}
                            )::float / NULLIF(COUNT(${sellerAreaMapping.id}), 0)
                        END`,
                    ),
                );

            return { priorities };
        }),
};
