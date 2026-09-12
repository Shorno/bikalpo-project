import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@bikalpo-project/db";
import {
    marketingMaterial,
    marketingMaterialRequest,
    user,
} from "@bikalpo-project/db/schema";

import { adminProcedure } from "../index";

// ── Helpers ─────────────────────────────────────────────────────────
async function generateRequestNumber(): Promise<string> {
    const result = await db
        .select({ cnt: count() })
        .from(marketingMaterialRequest);
    const next = (result[0]?.cnt ?? 0) + 1;
    return `MR-${String(next).padStart(3, "0")}`;
}

// ── Router ──────────────────────────────────────────────────────────
export const adminMarketingRouter = {
    // ═══════════════════════════════════════════════════════════════
    // MATERIALS (CRUD)
    // ═══════════════════════════════════════════════════════════════

    createMaterial: adminProcedure
        .input(
            z.object({
                title: z.string().min(1),
                type: z.enum(["banner", "sticker", "leaflet", "poster", "standee", "qr_sticker"]),
                category: z
                    .enum(["shop_branding", "warehouse_branding", "product_promotion", "campaign"])
                    .default("shop_branding"),
                designFileUrl: z.string().optional(),
                sizeFormat: z.string().optional(),
                description: z.string().optional(),
                stockQuantity: z.number().int().min(0).default(0),
                status: z.enum(["active", "disabled"]).default("active"),
            }),
        )
        .handler(async ({ input }) => {
            const [created] = await db
                .insert(marketingMaterial)
                .values(input)
                .returning();
            return created;
        }),

    updateMaterial: adminProcedure
        .input(
            z.object({
                id: z.string(),
                title: z.string().min(1).optional(),
                type: z
                    .enum(["banner", "sticker", "leaflet", "poster", "standee", "qr_sticker"])
                    .optional(),
                category: z
                    .enum(["shop_branding", "warehouse_branding", "product_promotion", "campaign"])
                    .optional(),
                designFileUrl: z.string().optional(),
                sizeFormat: z.string().optional(),
                description: z.string().optional(),
                stockQuantity: z.number().int().min(0).optional(),
                status: z.enum(["active", "disabled"]).optional(),
            }),
        )
        .handler(async ({ input }) => {
            const { id, ...data } = input;
            const [updated] = await db
                .update(marketingMaterial)
                .set(data)
                .where(eq(marketingMaterial.id, id))
                .returning();
            return updated;
        }),

    listMaterials: adminProcedure
        .input(
            z
                .object({
                    status: z.enum(["active", "disabled"]).optional(),
                    type: z.string().optional(),
                    category: z.string().optional(),
                })
                .optional(),
        )
        .handler(async ({ input }) => {
            const conditions = [];
            if (input?.status) conditions.push(eq(marketingMaterial.status, input.status));
            if (input?.type) conditions.push(eq(marketingMaterial.type, input.type));
            if (input?.category)
                conditions.push(eq(marketingMaterial.category, input.category));

            const materials = await db.query.marketingMaterial.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                orderBy: [desc(marketingMaterial.createdAt)],
            });

            return { materials };
        }),

    getMaterialById: adminProcedure
        .input(z.object({ id: z.string() }))
        .handler(async ({ input }) => {
            const material = await db.query.marketingMaterial.findFirst({
                where: eq(marketingMaterial.id, input.id),
                with: { requests: true },
            });
            return material ?? null;
        }),

    deleteMaterial: adminProcedure
        .input(z.object({ id: z.string() }))
        .handler(async ({ input }) => {
            const [updated] = await db
                .update(marketingMaterial)
                .set({ status: "disabled" })
                .where(eq(marketingMaterial.id, input.id))
                .returning();
            return updated;
        }),

    // ═══════════════════════════════════════════════════════════════
    // REQUESTS (Order fulfillment)
    // ═══════════════════════════════════════════════════════════════

    listRequests: adminProcedure
        .input(
            z
                .object({
                    status: z.string().optional(),
                    materialType: z.string().optional(),
                    userType: z.string().optional(),
                    search: z.string().optional(),
                    page: z.number().int().min(1).default(1),
                    limit: z.number().int().min(1).max(100).default(50),
                })
                .optional(),
        )
        .handler(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 50;
            const offset = (page - 1) * limit;

            const conditions = [];
            if (input?.status)
                conditions.push(eq(marketingMaterialRequest.status, input.status));
            if (input?.userType)
                conditions.push(eq(marketingMaterialRequest.userType, input.userType));
            if (input?.search) {
                conditions.push(
                    or(
                        ilike(marketingMaterialRequest.requestNumber, `%${input.search}%`),
                        ilike(marketingMaterialRequest.deliveryContact, `%${input.search}%`),
                    ),
                );
            }

            const whereClause =
                conditions.length > 0 ? and(...conditions) : undefined;

            const requests = await db.query.marketingMaterialRequest.findMany({
                where: whereClause,
                with: {
                    material: true,
                    requestedBy: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: [desc(marketingMaterialRequest.createdAt)],
                limit,
                offset,
            });

            // Filter by material type after join (drizzle limitation)
            const filtered = input?.materialType
                ? requests.filter((r) => r.material?.type === input.materialType)
                : requests;

            const totalResult = await db
                .select({ cnt: count() })
                .from(marketingMaterialRequest)
                .where(whereClause);

            return {
                requests: filtered,
                total: totalResult[0]?.cnt ?? 0,
                page,
                limit,
            };
        }),

    getRequestById: adminProcedure
        .input(z.object({ id: z.string() }))
        .handler(async ({ input }) => {
            const request = await db.query.marketingMaterialRequest.findFirst({
                where: eq(marketingMaterialRequest.id, input.id),
                with: {
                    material: true,
                    requestedBy: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                    reviewedBy: {
                        columns: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            return request ?? null;
        }),

    approveRequest: adminProcedure
        .input(
            z.object({
                requestId: z.string(),
                adminNote: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const [updated] = await db
                .update(marketingMaterialRequest)
                .set({
                    status: "approved",
                    adminNote: input.adminNote || null,
                    reviewedByUserId: context.session.user.id,
                    reviewedAt: new Date(),
                })
                .where(
                    and(
                        eq(marketingMaterialRequest.id, input.requestId),
                        eq(marketingMaterialRequest.status, "pending"),
                    ),
                )
                .returning();
            if (!updated) throw new Error("Request not found or already processed");
            return updated;
        }),

    rejectRequest: adminProcedure
        .input(
            z.object({
                requestId: z.string(),
                adminNote: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const [updated] = await db
                .update(marketingMaterialRequest)
                .set({
                    status: "rejected",
                    adminNote: input.adminNote || null,
                    reviewedByUserId: context.session.user.id,
                    reviewedAt: new Date(),
                })
                .where(
                    and(
                        eq(marketingMaterialRequest.id, input.requestId),
                        eq(marketingMaterialRequest.status, "pending"),
                    ),
                )
                .returning();
            if (!updated) throw new Error("Request not found or already processed");
            return updated;
        }),

    markDispatched: adminProcedure
        .input(
            z.object({
                requestId: z.string(),
                adminNote: z.string().optional(),
            }),
        )
        .handler(async ({ input }) => {
            // Fetch the request to deduct stock
            const existing = await db.query.marketingMaterialRequest.findFirst({
                where: eq(marketingMaterialRequest.id, input.requestId),
            });
            if (!existing || existing.status !== "approved")
                throw new Error("Request must be approved before dispatch");

            // Deduct stock
            await db
                .update(marketingMaterial)
                .set({
                    stockQuantity: sql`GREATEST(${marketingMaterial.stockQuantity} - ${existing.quantity}, 0)`,
                })
                .where(eq(marketingMaterial.id, existing.materialId));

            const [updated] = await db
                .update(marketingMaterialRequest)
                .set({
                    status: "dispatched",
                    dispatchedAt: new Date(),
                    adminNote: input.adminNote || existing.adminNote,
                })
                .where(eq(marketingMaterialRequest.id, input.requestId))
                .returning();
            return updated;
        }),

    markDelivered: adminProcedure
        .input(
            z.object({
                requestId: z.string(),
                adminNote: z.string().optional(),
            }),
        )
        .handler(async ({ input }) => {
            const [updated] = await db
                .update(marketingMaterialRequest)
                .set({
                    status: "delivered",
                    deliveredAt: new Date(),
                    adminNote: input.adminNote || undefined,
                })
                .where(
                    and(
                        eq(marketingMaterialRequest.id, input.requestId),
                        eq(marketingMaterialRequest.status, "dispatched"),
                    ),
                )
                .returning();
            if (!updated) throw new Error("Request must be dispatched before marking delivered");
            return updated;
        }),

    bulkApprove: adminProcedure
        .input(z.object({ requestIds: z.array(z.string()).min(1) }))
        .handler(async ({ input, context }) => {
            const results = [];
            for (const requestId of input.requestIds) {
                const [updated] = await db
                    .update(marketingMaterialRequest)
                    .set({
                        status: "approved",
                        reviewedByUserId: context.session.user.id,
                        reviewedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(marketingMaterialRequest.id, requestId),
                            eq(marketingMaterialRequest.status, "pending"),
                        ),
                    )
                    .returning();
                if (updated) results.push(updated);
            }
            return { approved: results.length };
        }),

    bulkDispatch: adminProcedure
        .input(z.object({ requestIds: z.array(z.string()).min(1) }))
        .handler(async ({ input }) => {
            const results = [];
            for (const requestId of input.requestIds) {
                const existing = await db.query.marketingMaterialRequest.findFirst({
                    where: eq(marketingMaterialRequest.id, requestId),
                });
                if (!existing || existing.status !== "approved") continue;

                await db
                    .update(marketingMaterial)
                    .set({
                        stockQuantity: sql`GREATEST(${marketingMaterial.stockQuantity} - ${existing.quantity}, 0)`,
                    })
                    .where(eq(marketingMaterial.id, existing.materialId));

                const [updated] = await db
                    .update(marketingMaterialRequest)
                    .set({ status: "dispatched", dispatchedAt: new Date() })
                    .where(eq(marketingMaterialRequest.id, requestId))
                    .returning();
                if (updated) results.push(updated);
            }
            return { dispatched: results.length };
        }),

    // ═══════════════════════════════════════════════════════════════
    // INVENTORY & STATS
    // ═══════════════════════════════════════════════════════════════

    inventorySummary: adminProcedure.handler(async () => {
        const materials = await db
            .select({
                id: marketingMaterial.id,
                title: marketingMaterial.title,
                type: marketingMaterial.type,
                stockQuantity: marketingMaterial.stockQuantity,
                status: marketingMaterial.status,
            })
            .from(marketingMaterial)
            .where(eq(marketingMaterial.status, "active"))
            .orderBy(marketingMaterial.type);

        return { inventory: materials };
    }),

    stats: adminProcedure.handler(async () => {
        const statusCounts = await db
            .select({
                status: marketingMaterialRequest.status,
                cnt: count(),
            })
            .from(marketingMaterialRequest)
            .groupBy(marketingMaterialRequest.status);

        const map: Record<string, number> = {};
        for (const row of statusCounts) {
            map[row.status] = row.cnt;
        }

        return {
            totalOrders:
                (map.pending ?? 0) +
                (map.approved ?? 0) +
                (map.dispatched ?? 0) +
                (map.delivered ?? 0) +
                (map.rejected ?? 0),
            pending: map.pending ?? 0,
            approved: map.approved ?? 0,
            dispatched: map.dispatched ?? 0,
            delivered: map.delivered ?? 0,
            rejected: map.rejected ?? 0,
        };
    }),
};
