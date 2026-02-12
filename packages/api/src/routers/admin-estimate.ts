import { db } from "@bikalpo-project/db";
import { estimate } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, gte, lte, sum } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, protectedProcedure } from "../index";

// Input schemas
const estimateFiltersSchema = z.object({
    status: z.enum(["draft", "pending", "sent", "approved", "rejected", "converted"]).optional(),
    salesmanId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

const reviewEstimateSchema = z.object({
    estimateId: z.number().int().positive(),
    action: z.enum(["approve", "reject"]),
    notes: z.string().optional(),
});

const bulkApproveSchema = z.object({
    estimateIds: z.array(z.number().int().positive()).min(1),
});

const estimateIdSchema = z.object({
    id: z.number().int().positive(),
});

export const adminEstimateRouter = {
    /**
     * Get all estimates (admin view)
     * REST: GET /admin-estimates
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/admin-estimates",
            tags: ["Admin Estimates"],
            summary: "Get all estimates",
            description: "Get all estimates with optional filtering by status, salesman, and date range",
        })
        .input(estimateFiltersSchema)
        .handler(async ({ input }) => {
            const conditions = [];

            if (input.status) {
                conditions.push(eq(estimate.status, input.status));
            }

            if (input.salesmanId) {
                conditions.push(eq(estimate.salesmanId, input.salesmanId));
            }

            if (input.startDate) {
                conditions.push(gte(estimate.createdAt, new Date(input.startDate)));
            }

            if (input.endDate) {
                conditions.push(lte(estimate.createdAt, new Date(input.endDate)));
            }

            const estimates = await db.query.estimate.findMany({
                where: conditions.length > 0 ? and(...conditions) : undefined,
                with: {
                    items: true,
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                    salesman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: [desc(estimate.createdAt)],
            });

            return { estimates };
        }),

    /**
     * Get admin estimate stats
     * REST: GET /admin-estimates/stats
     */
    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/admin-estimates/stats",
            tags: ["Admin Estimates"],
            summary: "Get estimate stats",
            description: "Get estimate statistics grouped by status",
        })
        .handler(async () => {
            // Get counts by status
            const statusCounts = await db
                .select({
                    status: estimate.status,
                    count: count(),
                    totalValue: sum(estimate.total),
                })
                .from(estimate)
                .groupBy(estimate.status);

            // Get pending review count
            const pendingReview =
                statusCounts.find((s) => s.status === "pending")?.count || 0;

            // Get today's estimates
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayEstimates = await db
                .select({ count: count() })
                .from(estimate)
                .where(gte(estimate.createdAt, today));

            const stats = {
                byStatus: statusCounts.reduce(
                    (acc, curr) => {
                        acc[curr.status] = {
                            count: Number(curr.count),
                            value: Number(curr.totalValue) || 0,
                        };
                        return acc;
                    },
                    {} as Record<string, { count: number; value: number }>,
                ),
                pendingReview: Number(pendingReview),
                todayCount: todayEstimates[0]?.count || 0,
                total: statusCounts.reduce((sum, s) => sum + Number(s.count), 0),
            };

            return { stats };
        }),

    /**
     * Get estimate by ID
     * REST: GET /admin-estimates/:id
     */
    getById: protectedProcedure
        .route({
            method: "GET",
            path: "/admin-estimates/{id}",
            tags: ["Admin Estimates"],
            summary: "Get estimate by ID",
            description: "Get detailed estimate information by ID with permission checks",
        })
        .input(estimateIdSchema)
        .handler(async ({ input, context }) => {
            const estimateData = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
                with: {
                    items: true,
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                    salesman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            if (!estimateData) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            // Check permissions
            const userId = context.session.user.id;
            const isCreator = estimateData.salesmanId === userId;
            const isCustomer = estimateData.customerId === userId;
            const isAdmin = context.session.user.role === "admin";

            if (!isCreator && !isCustomer && !isAdmin) {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized to view this estimate" });
            }

            // Customers can only view approved/sent/converted estimates
            if (isCustomer && !isCreator && !isAdmin) {
                const allowedStatuses = ["sent", "approved", "converted"];
                if (!allowedStatuses.includes(estimateData.status)) {
                    throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
                }
            }

            return { estimate: estimateData };
        }),

    /**
     * Review (approve/reject) an estimate
     * REST: POST /admin-estimates/review
     */
    review: adminProcedure
        .route({
            method: "POST",
            path: "/admin-estimates/review",
            tags: ["Admin Estimates"],
            summary: "Review estimate",
            description: "Approve or reject an estimate",
        })
        .input(reviewEstimateSchema)
        .handler(async ({ input }) => {
            const { estimateId, action, notes } = input;

            // Get estimate
            const existingEstimate = await db.query.estimate.findFirst({
                where: eq(estimate.id, estimateId),
            });

            if (!existingEstimate) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (
                existingEstimate.status !== "pending" &&
                existingEstimate.status !== "sent" &&
                existingEstimate.status !== "draft"
            ) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Only pending, sent or draft estimates can be reviewed",
                });
            }

            const updateData: Record<string, unknown> = {};

            if (action === "approve") {
                updateData.status = "approved";
                updateData.approvedAt = new Date();
            } else {
                updateData.status = "rejected";
                updateData.rejectedAt = new Date();
            }

            if (notes) {
                updateData.notes = existingEstimate.notes
                    ? `${existingEstimate.notes}\n\nAdmin: ${notes}`
                    : `Admin: ${notes}`;
            }

            await db
                .update(estimate)
                .set(updateData)
                .where(eq(estimate.id, estimateId));

            return { success: true };
        }),

    /**
     * Bulk approve estimates
     * REST: POST /admin-estimates/bulk-approve
     */
    bulkApprove: adminProcedure
        .route({
            method: "POST",
            path: "/admin-estimates/bulk-approve",
            tags: ["Admin Estimates"],
            summary: "Bulk approve estimates",
            description: "Approve multiple estimates at once",
        })
        .input(bulkApproveSchema)
        .handler(async ({ input }) => {
            let approved = 0;
            let failed = 0;

            for (const id of input.estimateIds) {
                const existingEstimate = await db.query.estimate.findFirst({
                    where: eq(estimate.id, id),
                });

                if (
                    existingEstimate &&
                    (existingEstimate.status === "pending" ||
                        existingEstimate.status === "draft")
                ) {
                    await db
                        .update(estimate)
                        .set({
                            status: "approved",
                            approvedAt: new Date(),
                        })
                        .where(eq(estimate.id, id));
                    approved++;
                } else {
                    failed++;
                }
            }

            return { approved, failed };
        }),
};
