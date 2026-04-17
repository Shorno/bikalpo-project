/**
 * User-facing Complaint Router — Direct to Admin
 *
 * Complaint flow:
 *   Any user → files complaint against an order → Admin pool
 *   Admin investigates → contacts relevant parties → resolves
 *
 * All roles can:
 *   - Create complaints against their orders
 *   - View own complaints
 *   - Reply to complaints
 *   - Close confirmed-resolved complaints
 */

import { db } from "@bikalpo-project/db";
import {
    complaint,
    complaintReply,
    complaintActionLog,
    user,
    order,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, asc, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateComplaintNumber(): string {
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `CMP-${yy}${mm}${dd}-${rand}`;
}

function mapRoleToUserType(role: string | null): string {
    switch (role) {
        case "shop_owner":
            return "retailer";
        case "warehouse":
            return "wholesaler";
        default:
            return "customer";
    }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const userComplaintRouter = {
    /**
     * Create a complaint against an order.
     * Any authenticated user can file a complaint on their own orders.
     * All complaints go directly to the admin pool.
     */
    create: protectedProcedure
        .route({
            method: "POST",
            path: "/complaints/create",
            tags: ["Complaints"],
            summary: "Create a complaint",
        })
        .input(
            z.object({
                orderId: z.number(),
                type: z.enum(["delivery", "payment", "product"]).default("delivery"),
                priority: z.enum(["medium", "high", "critical"]).default("medium"),
                description: z.string().min(10, "Description must be at least 10 characters").max(5000),
                userComment: z.string().max(2000).optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role ?? null;
            const userType = mapRoleToUserType(userRole);

            // Validate order exists and belongs to user
            const [orderRecord] = await db
                .select({ id: order.id, userId: order.userId, status: order.status })
                .from(order)
                .where(eq(order.id, input.orderId));

            if (!orderRecord) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Order not found",
                });
            }

            if (orderRecord.userId !== userId) {
                throw new ORPCError("FORBIDDEN", {
                    message: "You can only file complaints on your own orders",
                });
            }

            // Don't allow complaints on pending or cancelled orders
            if (orderRecord.status === "pending" || orderRecord.status === "cancelled") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Cannot file a complaint on a pending or cancelled order",
                });
            }

            // Check for duplicate active complaints on the same order
            const [existingComplaint] = await db
                .select({ id: complaint.id })
                .from(complaint)
                .where(
                    and(
                        eq(complaint.orderId, input.orderId),
                        eq(complaint.userId, userId),
                        sql`${complaint.status} IN ('open', 'investigating')`,
                    ),
                );

            if (existingComplaint) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "You already have an active complaint for this order",
                });
            }

            const [newComplaint] = await db
                .insert(complaint)
                .values({
                    complaintNumber: generateComplaintNumber(),
                    userId,
                    userType,
                    orderId: input.orderId,
                    type: input.type,
                    priority: input.priority,
                    status: "open",
                    description: input.description,
                    userComment: input.userComment || null,
                    assignedAdminId: null, // admin pool
                })
                .returning();

            return newComplaint;
        }),

    /**
     * List complaints the current user created
     */
    getMyComplaints: protectedProcedure
        .route({
            method: "GET",
            path: "/complaints/my-complaints",
            tags: ["Complaints"],
            summary: "Get my complaints",
        })
        .input(
            z.object({
                page: z.number().min(1).default(1),
                limit: z.number().min(1).max(50).default(10),
                status: z.string().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const { page, limit, status } = input;
            const offset = (page - 1) * limit;

            const conditions = [eq(complaint.userId, userId)];
            if (status && status !== "all") {
                conditions.push(
                    eq(
                        complaint.status,
                        status as "open" | "investigating" | "resolved" | "closed",
                    ),
                );
            }

            const whereClause = and(...conditions);

            const [complaints, totalResult] = await Promise.all([
                db
                    .select({
                        id: complaint.id,
                        complaintNumber: complaint.complaintNumber,
                        orderId: complaint.orderId,
                        type: complaint.type,
                        priority: complaint.priority,
                        status: complaint.status,
                        description: complaint.description,
                        createdAt: complaint.createdAt,
                        updatedAt: complaint.updatedAt,
                        resolvedAt: complaint.resolvedAt,
                        orderNumber: order.orderNumber,
                    })
                    .from(complaint)
                    .leftJoin(order, eq(complaint.orderId, order.id))
                    .where(whereClause)
                    .orderBy(desc(complaint.createdAt))
                    .limit(limit)
                    .offset(offset),
                db
                    .select({ count: count() })
                    .from(complaint)
                    .where(whereClause),
            ]);

            const totalCount = totalResult[0]?.count || 0;

            return {
                complaints,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /**
     * Stats for complaints I created
     */
    getMyStats: protectedProcedure
        .route({
            method: "GET",
            path: "/complaints/my-stats",
            tags: ["Complaints"],
            summary: "Stats for my complaints",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const result = await db
                .select({
                    total: count(),
                    open: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'open')`,
                    investigating: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'investigating')`,
                    resolved: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'resolved')`,
                    closed: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'closed')`,
                })
                .from(complaint)
                .where(eq(complaint.userId, userId));

            return {
                total: Number(result[0]?.total || 0),
                open: Number(result[0]?.open || 0),
                investigating: Number(result[0]?.investigating || 0),
                resolved: Number(result[0]?.resolved || 0),
                closed: Number(result[0]?.closed || 0),
            };
        }),

    /**
     * Get complaint detail — only the creator can view
     */
    getById: protectedProcedure
        .route({
            method: "GET",
            path: "/complaints/{id}",
            tags: ["Complaints"],
            summary: "Get complaint detail",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [complaintRecord] = await db
                .select({
                    id: complaint.id,
                    complaintNumber: complaint.complaintNumber,
                    orderId: complaint.orderId,
                    userId: complaint.userId,
                    userType: complaint.userType,
                    type: complaint.type,
                    priority: complaint.priority,
                    status: complaint.status,
                    description: complaint.description,
                    userComment: complaint.userComment,
                    resolution: complaint.resolution,
                    compensationAmount: complaint.compensationAmount,
                    createdAt: complaint.createdAt,
                    updatedAt: complaint.updatedAt,
                    resolvedAt: complaint.resolvedAt,
                    closedAt: complaint.closedAt,
                    orderNumber: order.orderNumber,
                    orderStatus: order.status,
                    orderTotal: order.total,
                })
                .from(complaint)
                .leftJoin(order, eq(complaint.orderId, order.id))
                .where(
                    and(
                        eq(complaint.id, input.id),
                        eq(complaint.userId, userId),
                    ),
                );

            if (!complaintRecord) {
                throw new ORPCError("NOT_FOUND", { message: "Complaint not found" });
            }

            // Get replies
            const replies = await db
                .select({
                    id: complaintReply.id,
                    userId: complaintReply.userId,
                    message: complaintReply.message,
                    isAdminReply: complaintReply.isAdminReply,
                    createdAt: complaintReply.createdAt,
                    userName: user.name,
                    userImage: user.image,
                })
                .from(complaintReply)
                .leftJoin(user, eq(complaintReply.userId, user.id))
                .where(eq(complaintReply.complaintId, input.id))
                .orderBy(asc(complaintReply.createdAt));

            // Get action logs (user can see what actions admin has taken)
            const actionLogs = await db
                .select({
                    id: complaintActionLog.id,
                    action: complaintActionLog.action,
                    note: complaintActionLog.note,
                    createdAt: complaintActionLog.createdAt,
                    performerName: user.name,
                })
                .from(complaintActionLog)
                .leftJoin(user, eq(complaintActionLog.performedBy, user.id))
                .where(eq(complaintActionLog.complaintId, input.id))
                .orderBy(desc(complaintActionLog.createdAt));

            return {
                ...complaintRecord,
                replies: replies.map((r) => ({
                    ...r,
                    user: {
                        id: r.userId,
                        name: r.userName || "Unknown",
                        image: r.userImage,
                    },
                })),
                actionLogs,
            };
        }),

    /**
     * Reply to a complaint — user side
     */
    reply: protectedProcedure
        .route({
            method: "POST",
            path: "/complaints/{complaintId}/reply",
            tags: ["Complaints"],
            summary: "Reply to a complaint",
        })
        .input(
            z.object({
                complaintId: z.number(),
                message: z.string().min(5).max(5000),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Verify user owns this complaint
            const [complaintRecord] = await db
                .select()
                .from(complaint)
                .where(
                    and(
                        eq(complaint.id, input.complaintId),
                        eq(complaint.userId, userId),
                    ),
                );

            if (!complaintRecord) {
                throw new ORPCError("NOT_FOUND", { message: "Complaint not found" });
            }

            if (complaintRecord.status === "closed") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Cannot reply to a closed complaint",
                });
            }

            const [reply] = await db
                .insert(complaintReply)
                .values({
                    complaintId: input.complaintId,
                    userId,
                    message: input.message,
                    isAdminReply: false,
                })
                .returning();

            // Update complaint timestamp
            await db
                .update(complaint)
                .set({ updatedAt: new Date() })
                .where(eq(complaint.id, input.complaintId));

            return reply;
        }),

    /**
     * Close a complaint — only the creator can close (confirms resolution)
     */
    close: protectedProcedure
        .route({
            method: "PATCH",
            path: "/complaints/{complaintId}/close",
            tags: ["Complaints"],
            summary: "Close a resolved complaint",
        })
        .input(z.object({ complaintId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [complaintRecord] = await db
                .select()
                .from(complaint)
                .where(
                    and(
                        eq(complaint.id, input.complaintId),
                        eq(complaint.userId, userId),
                    ),
                );

            if (!complaintRecord) {
                throw new ORPCError("NOT_FOUND", { message: "Complaint not found" });
            }

            await db
                .update(complaint)
                .set({
                    status: "closed",
                    closedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(complaint.id, input.complaintId));

            return { success: true };
        }),
};
