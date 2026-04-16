/**
 * Admin Complaint Router — Complaint Management & Investigation
 *
 * All complaints land in the admin pool. Admin can:
 *   - View / filter / search all complaints
 *   - Investigate complaints (update notes, delay reasons)
 *   - Log resolution actions (contact partner, notify retailer, etc.)
 *   - Reply to users
 *   - Resolve / close complaints
 *   - Bulk operations & CSV export
 */

import { and, count, desc, eq, gte, ilike, lte, or, inArray, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import {
    complaint,
    complaintReply,
    complaintActionLog,
    user,
    order,
    deliveryGroup,
    deliveryGroupInvoice,
    invoice,
} from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

// ─── Shared filter schema ────────────────────────────────────────────────────

const complaintFiltersSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
    status: z.string().optional(),
    type: z.string().optional(),
    priority: z.string().optional(),
    userType: z.string().optional(),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const adminComplaintRouter = {
    /**
     * Get all complaints with filtering & pagination
     */
    getAll: adminProcedure
        .route({
            method: "POST",
            path: "/admin/complaints/list",
            tags: ["Admin Complaints"],
            summary: "Get all complaints",
            description: "Get all complaints with filtering and pagination",
        })
        .input(complaintFiltersSchema)
        .handler(async ({ input }) => {
            const page = input.page || 1;
            const limit = input.limit || 10;
            const offset = (page - 1) * limit;

            const conditions: ReturnType<typeof eq>[] = [];

            // Status filter
            if (
                input.status &&
                ["open", "investigating", "resolved", "closed"].includes(input.status)
            ) {
                conditions.push(
                    eq(
                        complaint.status,
                        input.status as "open" | "investigating" | "resolved" | "closed",
                    ),
                );
            }

            // Type filter
            if (
                input.type &&
                ["delivery", "payment", "product"].includes(input.type)
            ) {
                conditions.push(
                    eq(
                        complaint.type,
                        input.type as "delivery" | "payment" | "product",
                    ),
                );
            }

            // Priority filter
            if (
                input.priority &&
                ["medium", "high", "critical"].includes(input.priority)
            ) {
                conditions.push(
                    eq(
                        complaint.priority,
                        input.priority as "medium" | "high" | "critical",
                    ),
                );
            }

            // User type filter
            if (
                input.userType &&
                ["customer", "retailer", "wholesaler"].includes(input.userType)
            ) {
                conditions.push(eq(complaint.userType, input.userType));
            }

            // Date range
            if (input.dateFrom) {
                conditions.push(
                    gte(complaint.createdAt, new Date(input.dateFrom)),
                );
            }
            if (input.dateTo) {
                const endDate = new Date(input.dateTo);
                endDate.setHours(23, 59, 59, 999);
                conditions.push(lte(complaint.createdAt, endDate));
            }

            // Search (complaint number, order number, user name, phone)
            if (input.search) {
                conditions.push(
                    or(
                        ilike(complaint.complaintNumber, `%${input.search}%`),
                        ilike(user.name, `%${input.search}%`),
                        ilike(user.phoneNumber, `%${input.search}%`),
                        ilike(order.orderNumber, `%${input.search}%`),
                    ) as ReturnType<typeof eq>,
                );
            }

            const whereClause =
                conditions.length > 0 ? and(...conditions) : undefined;

            // Count
            const [countResult] = await db
                .select({ count: count() })
                .from(complaint)
                .leftJoin(user, eq(complaint.userId, user.id))
                .leftJoin(order, eq(complaint.orderId, order.id))
                .where(whereClause);

            const totalCount = countResult?.count || 0;

            // Fetch complaints
            const complaints = await db
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
                    assignedAdminId: complaint.assignedAdminId,
                    createdAt: complaint.createdAt,
                    updatedAt: complaint.updatedAt,
                    resolvedAt: complaint.resolvedAt,
                    orderNumber: order.orderNumber,
                    customer: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        shopName: user.shopName,
                        phoneNumber: user.phoneNumber,
                    },
                })
                .from(complaint)
                .leftJoin(user, eq(complaint.userId, user.id))
                .leftJoin(order, eq(complaint.orderId, order.id))
                .where(whereClause)
                .orderBy(desc(complaint.createdAt))
                .limit(limit)
                .offset(offset);

            return {
                data: {
                    complaints,
                    pagination: {
                        page,
                        limit,
                        totalCount,
                        totalPages: Math.ceil(totalCount / limit),
                    },
                },
            };
        }),

    /**
     * Get complaint stats — 5 KPIs
     */
    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/admin/complaints/stats",
            tags: ["Admin Complaints"],
            summary: "Get complaint stats",
        })
        .handler(async () => {
            const result = await db
                .select({
                    total: count(),
                    open: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'open')`,
                    investigating: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'investigating')`,
                    resolved: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'resolved')`,
                    closed: sql<number>`COUNT(*) FILTER (WHERE ${complaint.status} = 'closed')`,
                    critical: sql<number>`COUNT(*) FILTER (WHERE ${complaint.priority} = 'critical' AND ${complaint.status} IN ('open', 'investigating'))`,
                })
                .from(complaint);

            return {
                data: {
                    total: Number(result[0]?.total || 0),
                    open: Number(result[0]?.open || 0),
                    investigating: Number(result[0]?.investigating || 0),
                    resolved: Number(result[0]?.resolved || 0),
                    closed: Number(result[0]?.closed || 0),
                    critical: Number(result[0]?.critical || 0),
                },
            };
        }),

    /**
     * Get full complaint detail by ID
     */
    getById: adminProcedure
        .route({
            method: "POST",
            path: "/admin/complaints/by-id",
            tags: ["Admin Complaints"],
            summary: "Get complaint by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            // Complaint + order + customer
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
                    assignedAdminId: complaint.assignedAdminId,
                    delayReason: complaint.delayReason,
                    investigationNotes: complaint.investigationNotes,
                    resolution: complaint.resolution,
                    compensationAmount: complaint.compensationAmount,
                    createdAt: complaint.createdAt,
                    updatedAt: complaint.updatedAt,
                    resolvedAt: complaint.resolvedAt,
                    closedAt: complaint.closedAt,
                    orderNumber: order.orderNumber,
                    orderStatus: order.status,
                    orderTotal: order.total,
                    customer: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        shopName: user.shopName,
                        phoneNumber: user.phoneNumber,
                        role: user.role,
                        warehouseName: user.warehouseName,
                        image: user.image,
                    },
                })
                .from(complaint)
                .leftJoin(user, eq(complaint.userId, user.id))
                .leftJoin(order, eq(complaint.orderId, order.id))
                .where(eq(complaint.id, input.id));

            if (!complaintRecord) {
                throw new Error("Complaint not found");
            }

            // Replies
            const replies = await db
                .select({
                    id: complaintReply.id,
                    complaintId: complaintReply.complaintId,
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

            // Action logs
            const actionLogs = await db
                .select({
                    id: complaintActionLog.id,
                    complaintId: complaintActionLog.complaintId,
                    action: complaintActionLog.action,
                    note: complaintActionLog.note,
                    createdAt: complaintActionLog.createdAt,
                    performedBy: complaintActionLog.performedBy,
                    performerName: user.name,
                })
                .from(complaintActionLog)
                .leftJoin(user, eq(complaintActionLog.performedBy, user.id))
                .where(eq(complaintActionLog.complaintId, input.id))
                .orderBy(desc(complaintActionLog.createdAt));

            return {
                data: {
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
                },
            };
        }),

    /**
     * Update complaint status
     */
    updateStatus: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/complaints/status",
            tags: ["Admin Complaints"],
            summary: "Update complaint status",
        })
        .input(
            z.object({
                complaintId: z.number(),
                status: z.enum(["open", "investigating", "resolved", "closed"]),
            }),
        )
        .handler(async ({ input, context }) => {
            const updateData: Record<string, unknown> = {
                status: input.status,
                updatedAt: new Date(),
            };

            if (input.status === "resolved") {
                updateData.resolvedAt = new Date();
            } else if (input.status === "closed") {
                updateData.closedAt = new Date();
            }

            await db
                .update(complaint)
                .set(updateData)
                .where(eq(complaint.id, input.complaintId));

            // Log action
            await db.insert(complaintActionLog).values({
                complaintId: input.complaintId,
                action: `Status changed to ${input.status}`,
                performedBy: context.session.user.id,
            });

            return { success: true };
        }),

    /**
     * Update complaint priority
     */
    updatePriority: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/complaints/priority",
            tags: ["Admin Complaints"],
            summary: "Update complaint priority",
        })
        .input(
            z.object({
                complaintId: z.number(),
                priority: z.enum(["medium", "high", "critical"]),
            }),
        )
        .handler(async ({ input, context }) => {
            await db
                .update(complaint)
                .set({ priority: input.priority, updatedAt: new Date() })
                .where(eq(complaint.id, input.complaintId));

            await db.insert(complaintActionLog).values({
                complaintId: input.complaintId,
                action: `Priority changed to ${input.priority}`,
                performedBy: context.session.user.id,
            });

            return { success: true };
        }),

    /**
     * Assign complaint to a specific admin
     */
    assignToAdmin: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/complaints/assign",
            tags: ["Admin Complaints"],
            summary: "Assign complaint to admin",
        })
        .input(
            z.object({
                complaintId: z.number(),
                adminId: z.string(),
            }),
        )
        .handler(async ({ input, context }) => {
            await db
                .update(complaint)
                .set({ assignedAdminId: input.adminId, updatedAt: new Date() })
                .where(eq(complaint.id, input.complaintId));

            // Get admin name
            const [admin] = await db
                .select({ name: user.name })
                .from(user)
                .where(eq(user.id, input.adminId));

            await db.insert(complaintActionLog).values({
                complaintId: input.complaintId,
                action: `Assigned to ${admin?.name || "Admin"}`,
                performedBy: context.session.user.id,
            });

            return { success: true };
        }),

    /**
     * Add an action log entry (resolution actions)
     */
    addActionLog: adminProcedure
        .route({
            method: "POST",
            path: "/admin/complaints/action-log",
            tags: ["Admin Complaints"],
            summary: "Log a resolution action",
        })
        .input(
            z.object({
                complaintId: z.number(),
                action: z.string().min(3).max(200),
                note: z.string().max(2000).optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const [log] = await db
                .insert(complaintActionLog)
                .values({
                    complaintId: input.complaintId,
                    action: input.action,
                    note: input.note || null,
                    performedBy: context.session.user.id,
                })
                .returning();

            // Touch complaint timestamp
            await db
                .update(complaint)
                .set({ updatedAt: new Date() })
                .where(eq(complaint.id, input.complaintId));

            return { success: true, log };
        }),

    /**
     * Update investigation fields (delayReason, investigationNotes)
     */
    addInvestigationNote: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/complaints/investigation",
            tags: ["Admin Complaints"],
            summary: "Update investigation notes",
        })
        .input(
            z.object({
                complaintId: z.number(),
                delayReason: z.string().max(2000).optional(),
                investigationNotes: z.string().max(5000).optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const updateData: Record<string, unknown> = {
                updatedAt: new Date(),
            };

            if (input.delayReason !== undefined) {
                updateData.delayReason = input.delayReason;
            }
            if (input.investigationNotes !== undefined) {
                updateData.investigationNotes = input.investigationNotes;
            }

            await db
                .update(complaint)
                .set(updateData)
                .where(eq(complaint.id, input.complaintId));

            await db.insert(complaintActionLog).values({
                complaintId: input.complaintId,
                action: "Investigation notes updated",
                performedBy: context.session.user.id,
            });

            return { success: true };
        }),

    /**
     * Admin reply to complaint (visible to user)
     */
    addReply: adminProcedure
        .route({
            method: "POST",
            path: "/admin/complaints/reply",
            tags: ["Admin Complaints"],
            summary: "Admin reply to complaint",
        })
        .input(
            z.object({
                complaintId: z.number(),
                message: z.string().min(5).max(5000),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Verify complaint exists
            const [comp] = await db
                .select()
                .from(complaint)
                .where(eq(complaint.id, input.complaintId));

            if (!comp) {
                throw new Error("Complaint not found");
            }

            const [newReply] = await db
                .insert(complaintReply)
                .values({
                    complaintId: input.complaintId,
                    userId,
                    message: input.message.trim(),
                    isAdminReply: true,
                })
                .returning();

            // Auto-move to investigating if still open
            if (comp.status === "open") {
                await db
                    .update(complaint)
                    .set({ status: "investigating", updatedAt: new Date() })
                    .where(eq(complaint.id, input.complaintId));
            } else {
                await db
                    .update(complaint)
                    .set({ updatedAt: new Date() })
                    .where(eq(complaint.id, input.complaintId));
            }

            return { success: true, reply: newReply };
        }),

    /**
     * Resolve a complaint with resolution text and optional compensation
     */
    resolve: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/complaints/resolve",
            tags: ["Admin Complaints"],
            summary: "Resolve complaint",
        })
        .input(
            z.object({
                complaintId: z.number(),
                resolution: z.string().min(10).max(5000),
                compensationAmount: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            await db
                .update(complaint)
                .set({
                    status: "resolved",
                    resolution: input.resolution,
                    compensationAmount: input.compensationAmount || null,
                    resolvedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(complaint.id, input.complaintId));

            const actionText = input.compensationAmount
                ? `Resolved with compensation: ৳${input.compensationAmount}`
                : "Complaint resolved";

            await db.insert(complaintActionLog).values({
                complaintId: input.complaintId,
                action: actionText,
                note: input.resolution,
                performedBy: context.session.user.id,
            });

            return { success: true };
        }),

    /**
     * Get delivery info for the linked order
     */
    getDeliveryInfo: adminProcedure
        .route({
            method: "POST",
            path: "/admin/complaints/delivery-info",
            tags: ["Admin Complaints"],
            summary: "Get delivery info for complaint order",
        })
        .input(z.object({ orderId: z.number() }))
        .handler(async ({ input }) => {
            // Get invoices for this order, then delivery groups
            const deliveries = await db
                .select({
                    groupId: deliveryGroup.id,
                    groupName: deliveryGroup.groupName,
                    groupStatus: deliveryGroup.status,
                    deliverymanId: deliveryGroup.deliverymanId,
                    deliverymanName: user.name,
                    deliverymanPhone: user.phoneNumber,
                    vehicleType: deliveryGroup.vehicleType,
                    startedAt: deliveryGroup.startedAt,
                    completedAt: deliveryGroup.completedAt,
                    invoiceStatus: deliveryGroupInvoice.status,
                    deliveredAt: deliveryGroupInvoice.deliveredAt,
                    failedReason: deliveryGroupInvoice.failedReason,
                })
                .from(deliveryGroupInvoice)
                .innerJoin(
                    deliveryGroup,
                    eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
                )
                .innerJoin(
                    invoice,
                    eq(deliveryGroupInvoice.invoiceId, invoice.id),
                )
                .leftJoin(user, eq(deliveryGroup.deliverymanId, user.id))
                .where(eq(invoice.orderId, input.orderId));

            return { data: deliveries };
        }),

    /**
     * Bulk update status for multiple complaints
     */
    bulkUpdateStatus: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/complaints/bulk-status",
            tags: ["Admin Complaints"],
            summary: "Bulk update complaint status",
        })
        .input(
            z.object({
                complaintIds: z.array(z.number()).min(1),
                status: z.enum(["open", "investigating", "resolved", "closed"]),
            }),
        )
        .handler(async ({ input, context }) => {
            const now = new Date();
            const updateData: Record<string, unknown> = {
                status: input.status,
                updatedAt: now,
            };

            if (input.status === "resolved") {
                updateData.resolvedAt = now;
            } else if (input.status === "closed") {
                updateData.closedAt = now;
            }

            await db
                .update(complaint)
                .set(updateData)
                .where(inArray(complaint.id, input.complaintIds));

            // Log for each
            const logs = input.complaintIds.map((id) => ({
                complaintId: id,
                action: `Bulk status change to ${input.status}`,
                performedBy: context.session.user.id,
            }));

            if (logs.length > 0) {
                await db.insert(complaintActionLog).values(logs);
            }

            return { success: true, updated: input.complaintIds.length };
        }),

    /**
     * Export filtered complaints as JSON (frontend converts to CSV)
     */
    exportComplaints: adminProcedure
        .route({
            method: "POST",
            path: "/admin/complaints/export",
            tags: ["Admin Complaints"],
            summary: "Export complaints",
        })
        .input(complaintFiltersSchema.omit({ page: true, limit: true }))
        .handler(async ({ input }) => {
            const conditions: ReturnType<typeof eq>[] = [];

            if (
                input.status &&
                ["open", "investigating", "resolved", "closed"].includes(input.status)
            ) {
                conditions.push(
                    eq(
                        complaint.status,
                        input.status as "open" | "investigating" | "resolved" | "closed",
                    ),
                );
            }

            if (
                input.type &&
                ["delivery", "payment", "product"].includes(input.type)
            ) {
                conditions.push(
                    eq(complaint.type, input.type as "delivery" | "payment" | "product"),
                );
            }

            if (
                input.priority &&
                ["medium", "high", "critical"].includes(input.priority)
            ) {
                conditions.push(
                    eq(
                        complaint.priority,
                        input.priority as "medium" | "high" | "critical",
                    ),
                );
            }

            if (
                input.userType &&
                ["customer", "retailer", "wholesaler"].includes(input.userType)
            ) {
                conditions.push(eq(complaint.userType, input.userType));
            }

            if (input.dateFrom) {
                conditions.push(gte(complaint.createdAt, new Date(input.dateFrom)));
            }

            if (input.dateTo) {
                const endDate = new Date(input.dateTo);
                endDate.setHours(23, 59, 59, 999);
                conditions.push(lte(complaint.createdAt, endDate));
            }

            const whereClause =
                conditions.length > 0 ? and(...conditions) : undefined;

            const complaints = await db
                .select({
                    complaintNumber: complaint.complaintNumber,
                    orderNumber: order.orderNumber,
                    type: complaint.type,
                    priority: complaint.priority,
                    status: complaint.status,
                    userType: complaint.userType,
                    description: complaint.description,
                    resolution: complaint.resolution,
                    createdAt: complaint.createdAt,
                    resolvedAt: complaint.resolvedAt,
                    customerName: user.name,
                    customerEmail: user.email,
                    customerPhone: user.phoneNumber,
                })
                .from(complaint)
                .leftJoin(user, eq(complaint.userId, user.id))
                .leftJoin(order, eq(complaint.orderId, order.id))
                .where(whereClause)
                .orderBy(desc(complaint.createdAt));

            return { data: complaints };
        }),
};
