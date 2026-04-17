/**
 * Warehouse Delivery Router
 *
 * Warehouse-scoped delivery area and schedule management.
 * All endpoints use warehouseProcedure and filter by warehouseId.
 */
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import {
    deliveryArea,
    deliverySchedule,
    user,
    order,
} from "@bikalpo-project/db/schema";
import { warehouseProcedure } from "../index";

// ── Helpers ──

const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
] as const;

function slugify(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

// ── Input Schemas ──

const createAreaInput = z.object({
    name: z.string().min(2).max(150).trim(),
    description: z.string().optional(),
    polygon: z.array(z.array(z.array(z.number()))).optional().nullable(),
    centerLat: z.string().optional().nullable(),
    centerLng: z.string().optional().nullable(),
    radiusKm: z.string().optional().nullable(),
});

const updateAreaInput = z.object({
    id: z.number().int(),
    name: z.string().min(2).max(150).trim().optional(),
    description: z.string().optional().nullable(),
    polygon: z.array(z.array(z.array(z.number()))).optional().nullable(),
    centerLat: z.string().optional().nullable(),
    centerLng: z.string().optional().nullable(),
    radiusKm: z.string().optional().nullable(),
    status: z.enum(["active", "inactive"]).optional(),
});

const upsertScheduleInput = z.object({
    areaId: z.number().int(),
    days: z.array(z.number().int().min(0).max(6)),
    defaultRiderId: z.string().optional().nullable(),
});

// ── Router ──

export const warehouseDeliveryRouter = {
    // ==================== AREA CRUD ====================

    /**
     * List all delivery areas for this warehouse
     */
    getAreas: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/delivery/areas",
            tags: ["Warehouse Delivery"],
            summary: "List delivery areas",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;

            const areas = await db.query.deliveryArea.findMany({
                where: eq(deliveryArea.warehouseId, warehouseId),
                with: {
                    schedules: {
                        where: eq(deliverySchedule.isActive, true),
                        with: {
                            defaultRider: true,
                        },
                    },
                },
                orderBy: [asc(deliveryArea.sortOrder), asc(deliveryArea.name)],
            });

            return {
                areas: areas.map((a) => ({
                    ...a,
                    deliveryDays: a.schedules
                        .map((s) => ({
                            dayOfWeek: s.dayOfWeek,
                            dayName: DAY_NAMES[s.dayOfWeek],
                            riderId: s.defaultRiderId,
                            riderName: s.defaultRider?.name ?? null,
                        }))
                        .sort((x, y) => x.dayOfWeek - y.dayOfWeek),
                    scheduleCount: a.schedules.length,
                })),
            };
        }),

    /**
     * Get area detail by ID
     */
    getAreaById: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/delivery/areas/detail",
            tags: ["Warehouse Delivery"],
            summary: "Get area detail",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            const area = await db.query.deliveryArea.findFirst({
                where: and(
                    eq(deliveryArea.id, input.id),
                    eq(deliveryArea.warehouseId, warehouseId),
                ),
                with: {
                    schedules: {
                        with: { defaultRider: true },
                        orderBy: [asc(deliverySchedule.dayOfWeek)],
                    },
                },
            });

            if (!area) throw new ORPCError("NOT_FOUND", { message: "Area not found" });

            // Get order stats for this area (matching by area name in shippingArea)
            const orderStats = await db
                .select({
                    total: count(),
                })
                .from(order)
                .where(
                    and(
                        eq(order.warehouseId, warehouseId),
                        eq(order.shippingArea, area.name),
                    ),
                );

            return {
                ...area,
                deliveryDays: area.schedules.map((s) => ({
                    id: s.id,
                    dayOfWeek: s.dayOfWeek,
                    dayName: DAY_NAMES[s.dayOfWeek],
                    riderId: s.defaultRiderId,
                    riderName: s.defaultRider?.name ?? null,
                    riderPhone: s.defaultRider?.phoneNumber ?? null,
                    isActive: s.isActive,
                })),
                totalOrders: orderStats[0]?.total ?? 0,
            };
        }),

    /**
     * Create a new delivery area
     */
    createArea: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/delivery/areas/create",
            tags: ["Warehouse Delivery"],
            summary: "Create delivery area",
        })
        .input(createAreaInput)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Generate slug
            let slug = slugify(input.name);

            // Ensure unique slug within this warehouse
            const existing = await db
                .select({ id: deliveryArea.id })
                .from(deliveryArea)
                .where(
                    and(
                        eq(deliveryArea.warehouseId, warehouseId),
                        eq(deliveryArea.slug, slug),
                    ),
                )
                .limit(1);

            if (existing.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }

            const [created] = await db
                .insert(deliveryArea)
                .values({
                    warehouseId,
                    name: input.name,
                    slug,
                    description: input.description ?? null,
                    polygon: input.polygon ?? null,
                    centerLat: input.centerLat ?? null,
                    centerLng: input.centerLng ?? null,
                    radiusKm: input.radiusKm ?? null,
                })
                .returning();

            return { area: created };
        }),

    /**
     * Update an existing delivery area
     */
    updateArea: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/delivery/areas/update",
            tags: ["Warehouse Delivery"],
            summary: "Update delivery area",
        })
        .input(updateAreaInput)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Verify ownership
            const existing = await db
                .select({ id: deliveryArea.id })
                .from(deliveryArea)
                .where(
                    and(
                        eq(deliveryArea.id, input.id),
                        eq(deliveryArea.warehouseId, warehouseId),
                    ),
                )
                .limit(1);

            if (existing.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Area not found" });
            }

            const { id, ...updateData } = input;

            // Regenerate slug if name changed
            const updates: Record<string, any> = { ...updateData };
            if (updateData.name) {
                updates.slug = slugify(updateData.name);
            }

            await db
                .update(deliveryArea)
                .set(updates)
                .where(eq(deliveryArea.id, id));

            return { success: true };
        }),

    /**
     * Delete a delivery area (cascades to schedules)
     */
    deleteArea: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/delivery/areas/delete",
            tags: ["Warehouse Delivery"],
            summary: "Delete delivery area",
        })
        .input(z.object({ id: z.number().int() }))
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            const existing = await db
                .select({ id: deliveryArea.id })
                .from(deliveryArea)
                .where(
                    and(
                        eq(deliveryArea.id, input.id),
                        eq(deliveryArea.warehouseId, warehouseId),
                    ),
                )
                .limit(1);

            if (existing.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Area not found" });
            }

            await db.delete(deliveryArea).where(eq(deliveryArea.id, input.id));

            return { success: true };
        }),

    // ==================== SCHEDULE MANAGEMENT ====================

    /**
     * Get weekly delivery schedule
     */
    getWeeklySchedule: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/delivery/schedule/weekly",
            tags: ["Warehouse Delivery"],
            summary: "Get weekly delivery schedule",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;

            const schedules = await db.query.deliverySchedule.findMany({
                where: and(
                    eq(deliverySchedule.warehouseId, warehouseId),
                    eq(deliverySchedule.isActive, true),
                ),
                with: {
                    area: true,
                    defaultRider: true,
                },
                orderBy: [
                    asc(deliverySchedule.dayOfWeek),
                    asc(deliverySchedule.areaId),
                ],
            });

            // Build the weekly view: group by day
            const weekly = DAY_NAMES.map((dayName, dayIndex) => {
                const daySchedules = schedules.filter(
                    (s) => s.dayOfWeek === dayIndex,
                );
                return {
                    dayOfWeek: dayIndex,
                    dayName,
                    areas: daySchedules.map((s) => ({
                        scheduleId: s.id,
                        areaId: s.area.id,
                        areaName: s.area.name,
                        areaStatus: s.area.status,
                        riderId: s.defaultRiderId,
                        riderName: s.defaultRider?.name ?? null,
                        riderPhone: s.defaultRider?.phoneNumber ?? null,
                    })),
                    isOff: daySchedules.length === 0,
                };
            });

            return { weekly };
        }),

    /**
     * Get today's delivery plan
     */
    getTodayPlan: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/delivery/schedule/today",
            tags: ["Warehouse Delivery"],
            summary: "Get today's delivery plan",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;
            const today = new Date().getDay(); // 0=Sunday

            const todaySchedules = await db.query.deliverySchedule.findMany({
                where: and(
                    eq(deliverySchedule.warehouseId, warehouseId),
                    eq(deliverySchedule.dayOfWeek, today),
                    eq(deliverySchedule.isActive, true),
                ),
                with: {
                    area: true,
                    defaultRider: true,
                },
            });

            return {
                dayName: DAY_NAMES[today],
                dayOfWeek: today,
                date: new Date().toISOString().split("T")[0],
                areas: todaySchedules.map((s) => ({
                    scheduleId: s.id,
                    areaId: s.area.id,
                    areaName: s.area.name,
                    riderId: s.defaultRiderId,
                    riderName: s.defaultRider?.name ?? null,
                    riderPhone: s.defaultRider?.phoneNumber ?? null,
                })),
            };
        }),

    /**
     * Set delivery schedule for an area
     * Replaces all existing schedules for the area with new ones
     */
    upsertSchedule: warehouseProcedure
        .route({
            method: "POST",
            path: "/warehouse/delivery/schedule/upsert",
            tags: ["Warehouse Delivery"],
            summary: "Set delivery schedule for area",
        })
        .input(upsertScheduleInput)
        .handler(async ({ input, context }) => {
            const warehouseId = context.session.user.id;

            // Verify area belongs to this warehouse
            const area = await db
                .select({ id: deliveryArea.id })
                .from(deliveryArea)
                .where(
                    and(
                        eq(deliveryArea.id, input.areaId),
                        eq(deliveryArea.warehouseId, warehouseId),
                    ),
                )
                .limit(1);

            if (area.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Area not found" });
            }

            // If rider specified, verify they belong to this warehouse
            if (input.defaultRiderId) {
                const rider = await db
                    .select({ id: user.id })
                    .from(user)
                    .where(
                        and(
                            eq(user.id, input.defaultRiderId),
                            eq(user.warehouseId, warehouseId),
                            eq(user.role, "deliveryman"),
                        ),
                    )
                    .limit(1);

                if (rider.length === 0) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Rider not found in this warehouse",
                    });
                }
            }

            await db.transaction(async (tx) => {
                // Delete existing schedules for this area
                await tx
                    .delete(deliverySchedule)
                    .where(
                        and(
                            eq(deliverySchedule.areaId, input.areaId),
                            eq(deliverySchedule.warehouseId, warehouseId),
                        ),
                    );

                // Insert new schedules
                if (input.days.length > 0) {
                    await tx.insert(deliverySchedule).values(
                        input.days.map((day) => ({
                            areaId: input.areaId,
                            warehouseId,
                            dayOfWeek: day,
                            defaultRiderId: input.defaultRiderId ?? null,
                            isActive: true,
                        })),
                    );
                }
            });

            return { success: true };
        }),

    // ==================== KPIs & PERFORMANCE ====================

    /**
     * Get area dashboard KPIs
     */
    getAreaKpis: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/delivery/areas/kpis",
            tags: ["Warehouse Delivery"],
            summary: "Get area dashboard KPIs",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;
            const today = new Date().getDay();

            // Total areas
            const [totalResult] = await db
                .select({ count: count() })
                .from(deliveryArea)
                .where(eq(deliveryArea.warehouseId, warehouseId));

            // Active areas (with status = active)
            const [activeResult] = await db
                .select({ count: count() })
                .from(deliveryArea)
                .where(
                    and(
                        eq(deliveryArea.warehouseId, warehouseId),
                        eq(deliveryArea.status, "active"),
                    ),
                );

            // Today's areas (schedules for today's day of week)
            const [todayResult] = await db
                .select({ count: count() })
                .from(deliverySchedule)
                .where(
                    and(
                        eq(deliverySchedule.warehouseId, warehouseId),
                        eq(deliverySchedule.dayOfWeek, today),
                        eq(deliverySchedule.isActive, true),
                    ),
                );

            // Total weekly plans (total schedule entries)
            const [weeklyResult] = await db
                .select({ count: count() })
                .from(deliverySchedule)
                .where(
                    and(
                        eq(deliverySchedule.warehouseId, warehouseId),
                        eq(deliverySchedule.isActive, true),
                    ),
                );

            return {
                totalAreas: totalResult?.count ?? 0,
                activeAreas: activeResult?.count ?? 0,
                todayAreas: todayResult?.count ?? 0,
                weeklyPlans: weeklyResult?.count ?? 0,
            };
        }),

    // ==================== RIDER DROPDOWN ====================

    /**
     * Get available delivery riders for this warehouse
     */
    getAvailableRiders: warehouseProcedure
        .route({
            method: "GET",
            path: "/warehouse/delivery/riders",
            tags: ["Warehouse Delivery"],
            summary: "Get available delivery riders",
        })
        .handler(async ({ context }) => {
            const warehouseId = context.session.user.id;

            const riders = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    serviceArea: user.serviceArea,
                    banned: user.banned,
                })
                .from(user)
                .where(
                    and(
                        eq(user.warehouseId, warehouseId),
                        eq(user.role, "deliveryman"),
                    ),
                )
                .orderBy(asc(user.name));

            return {
                riders: riders.filter((r) => !r.banned),
            };
        }),
};
