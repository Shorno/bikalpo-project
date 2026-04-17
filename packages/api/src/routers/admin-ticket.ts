import { and, count, desc, eq, gte, ilike, lte, or, inArray, asc, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import {
    supportTicket,
    supportTicketReply,
    supportTicketNote,
    supportTicketAttachment,
    user,
} from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";
import { processAutoEscalations } from "../utils/escalation-cron";

type NewSupportTicketReply = typeof supportTicketReply.$inferInsert;
type NewSupportTicketNote = typeof supportTicketNote.$inferInsert;

const ticketFiltersSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    userType: z.string().optional(),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    // Scope: 'all' | 'direct' (warehouse→admin) | 'escalated' (auto/manual escalation)
    ticketScope: z.enum(["all", "direct", "escalated"]).optional().default("all"),
});

export const adminTicketRouter = {
    /**
     * Get all tickets (admin view) — with full filtering
     */
    getAll: adminProcedure
        .route({
            method: "POST",
            path: "/admin/tickets/list",
            tags: ["Admin Tickets"],
            summary: "Get all tickets",
            description: "Get all support tickets with filtering and pagination",
        })
        .input(ticketFiltersSchema)
        .handler(async ({ input }) => {
            const page = input.page || 1;
            const limit = input.limit || 10;
            const offset = (page - 1) * limit;

            // Build where conditions
            // Admin sees: warehouse→admin direct tickets + all escalated tickets
            const conditions = [
                or(
                    // Direct warehouse→admin: level_1 with no assignee (admin pool)
                    and(
                        eq(supportTicket.currentLevel, "level_1"),
                        isNull(supportTicket.assignedToId),
                    ),
                    // Escalated to admin
                    eq(supportTicket.currentLevel, "level_2"),
                ) as ReturnType<typeof eq>,
            ];

            // Scope filter
            if (input.ticketScope === "direct") {
                // Only warehouse→admin direct tickets
                conditions.push(eq(supportTicket.currentLevel, "level_1"));
                conditions.push(isNull(supportTicket.assignedToId) as ReturnType<typeof eq>);
            } else if (input.ticketScope === "escalated") {
                // Only escalated tickets
                conditions.push(eq(supportTicket.currentLevel, "level_2"));
            }

            if (
                input.status &&
                ["open", "in_progress", "resolved", "closed"].includes(input.status)
            ) {
                conditions.push(
                    eq(
                        supportTicket.status,
                        input.status as "open" | "in_progress" | "resolved" | "closed",
                    ),
                );
            }

            if (
                input.priority &&
                ["low", "medium", "high", "critical"].includes(input.priority)
            ) {
                conditions.push(
                    eq(
                        supportTicket.priority,
                        input.priority as "low" | "medium" | "high" | "critical",
                    ),
                );
            }

            if (
                input.category &&
                ["order", "payment", "delivery", "account", "other"].includes(
                    input.category,
                )
            ) {
                conditions.push(
                    eq(
                        supportTicket.category,
                        input.category as
                            | "order"
                            | "payment"
                            | "delivery"
                            | "account"
                            | "other",
                    ),
                );
            }

            if (
                input.userType &&
                ["customer", "retailer", "wholesaler"].includes(input.userType)
            ) {
                conditions.push(eq(supportTicket.userType, input.userType));
            }

            if (input.dateFrom) {
                conditions.push(
                    gte(supportTicket.createdAt, new Date(input.dateFrom)),
                );
            }

            if (input.dateTo) {
                const endDate = new Date(input.dateTo);
                endDate.setHours(23, 59, 59, 999);
                conditions.push(lte(supportTicket.createdAt, endDate));
            }

            if (input.search) {
                conditions.push(
                    or(
                        ilike(supportTicket.subject, `%${input.search}%`),
                        ilike(supportTicket.ticketNumber, `%${input.search}%`),
                        ilike(user.name, `%${input.search}%`),
                        ilike(user.phoneNumber, `%${input.search}%`),
                    ) as ReturnType<typeof eq>,
                );
            }

            const whereClause =
                conditions.length > 0 ? and(...conditions) : undefined;

            // Get total count
            const [countResult] = await db
                .select({ count: count() })
                .from(supportTicket)
                .leftJoin(user, eq(supportTicket.customerId, user.id))
                .where(whereClause);

            const totalCount = countResult?.count || 0;

            // Get tickets with customer info
            const tickets = await db
                .select({
                    id: supportTicket.id,
                    ticketNumber: supportTicket.ticketNumber,
                    customerId: supportTicket.customerId,
                    subject: supportTicket.subject,
                    message: supportTicket.message,
                    status: supportTicket.status,
                    priority: supportTicket.priority,
                    category: supportTicket.category,
                    userType: supportTicket.userType,
                    currentLevel: supportTicket.currentLevel,
                    assignedToId: supportTicket.assignedToId,
                    escalationDeadline: supportTicket.escalationDeadline,
                    escalatedAt: supportTicket.escalatedAt,
                    autoEscalated: supportTicket.autoEscalated,
                    createdAt: supportTicket.createdAt,
                    updatedAt: supportTicket.updatedAt,
                    customer: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        shopName: user.shopName,
                        phoneNumber: user.phoneNumber,
                    },
                })
                .from(supportTicket)
                .leftJoin(user, eq(supportTicket.customerId, user.id))
                .where(whereClause)
                .orderBy(desc(supportTicket.createdAt))
                .limit(limit)
                .offset(offset);

            return {
                data: {
                    tickets,
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
     * Get ticket stats for admin dashboard — 5 KPIs
     */
    getStats: adminProcedure
        .route({
            method: "GET",
            path: "/admin/tickets/stats",
            tags: ["Admin Tickets"],
            summary: "Get ticket stats",
            description: "Get ticket statistics for admin dashboard",
        })
        .handler(async () => {
            const [totalResult] = await db
                .select({ count: count() })
                .from(supportTicket);

            const [openResult] = await db
                .select({ count: count() })
                .from(supportTicket)
                .where(eq(supportTicket.status, "open"));

            const [inProgressResult] = await db
                .select({ count: count() })
                .from(supportTicket)
                .where(eq(supportTicket.status, "in_progress"));

            const [resolvedResult] = await db
                .select({ count: count() })
                .from(supportTicket)
                .where(eq(supportTicket.status, "resolved"));

            const [closedResult] = await db
                .select({ count: count() })
                .from(supportTicket)
                .where(eq(supportTicket.status, "closed"));

            const [criticalResult] = await db
                .select({ count: count() })
                .from(supportTicket)
                .where(
                    and(
                        eq(supportTicket.priority, "critical"),
                        or(
                            eq(supportTicket.status, "open"),
                            eq(supportTicket.status, "in_progress"),
                        ),
                    ),
                );

            const [escalatedResult] = await db
                .select({ count: count() })
                .from(supportTicket)
                .where(eq(supportTicket.currentLevel, "level_2"));

            return {
                data: {
                    total: totalResult?.count || 0,
                    open: openResult?.count || 0,
                    inProgress: inProgressResult?.count || 0,
                    resolved: resolvedResult?.count || 0,
                    closed: closedResult?.count || 0,
                    critical: criticalResult?.count || 0,
                    escalated: escalatedResult?.count || 0,
                },
            };
        }),

    /**
     * Get single ticket details (admin) — with notes, attachments, escalation
     */
    getById: adminProcedure
        .route({
            method: "POST",
            path: "/admin/tickets/by-id",
            tags: ["Admin Tickets"],
            summary: "Get ticket by ID",
            description: "Get single ticket details with replies, notes, and attachments",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            // Get ticket with customer info
            const [ticket] = await db
                .select({
                    id: supportTicket.id,
                    ticketNumber: supportTicket.ticketNumber,
                    customerId: supportTicket.customerId,
                    subject: supportTicket.subject,
                    message: supportTicket.message,
                    status: supportTicket.status,
                    priority: supportTicket.priority,
                    category: supportTicket.category,
                    userType: supportTicket.userType,
                    escalatedAt: supportTicket.escalatedAt,
                    escalatedBy: supportTicket.escalatedBy,
                    createdAt: supportTicket.createdAt,
                    updatedAt: supportTicket.updatedAt,
                    resolvedAt: supportTicket.resolvedAt,
                    closedAt: supportTicket.closedAt,
                    customer: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        shopName: user.shopName,
                        phoneNumber: user.phoneNumber,
                        role: user.role,
                        warehouseName: user.warehouseName,
                    },
                })
                .from(supportTicket)
                .leftJoin(user, eq(supportTicket.customerId, user.id))
                .where(eq(supportTicket.id, input.id));

            if (!ticket) {
                throw new Error("Ticket not found");
            }

            // Get replies with user info
            const replies = await db
                .select({
                    id: supportTicketReply.id,
                    ticketId: supportTicketReply.ticketId,
                    userId: supportTicketReply.userId,
                    message: supportTicketReply.message,
                    isStaffReply: supportTicketReply.isStaffReply,
                    createdAt: supportTicketReply.createdAt,
                    userName: user.name,
                    userImage: user.image,
                })
                .from(supportTicketReply)
                .leftJoin(user, eq(supportTicketReply.userId, user.id))
                .where(eq(supportTicketReply.ticketId, input.id))
                .orderBy(asc(supportTicketReply.createdAt));

            // Get internal notes
            const notes = await db
                .select({
                    id: supportTicketNote.id,
                    ticketId: supportTicketNote.ticketId,
                    userId: supportTicketNote.userId,
                    note: supportTicketNote.note,
                    createdAt: supportTicketNote.createdAt,
                    userName: user.name,
                    userImage: user.image,
                })
                .from(supportTicketNote)
                .leftJoin(user, eq(supportTicketNote.userId, user.id))
                .where(eq(supportTicketNote.ticketId, input.id))
                .orderBy(asc(supportTicketNote.createdAt));

            // Get attachments
            const attachments = await db
                .select({
                    id: supportTicketAttachment.id,
                    url: supportTicketAttachment.url,
                    fileName: supportTicketAttachment.fileName,
                    fileType: supportTicketAttachment.fileType,
                    createdAt: supportTicketAttachment.createdAt,
                })
                .from(supportTicketAttachment)
                .where(eq(supportTicketAttachment.ticketId, input.id))
                .orderBy(asc(supportTicketAttachment.createdAt));

            return {
                data: {
                    ...ticket,
                    replies: replies.map((r) => ({
                        ...r,
                        user: {
                            id: r.userId,
                            name: r.userName || "Unknown",
                            image: r.userImage,
                        },
                    })),
                    notes: notes.map((n) => ({
                        ...n,
                        user: {
                            id: n.userId,
                            name: n.userName || "Admin",
                            image: n.userImage,
                        },
                    })),
                    attachments,
                },
            };
        }),

    /**
     * Add staff reply to ticket
     */
    addReply: adminProcedure
        .route({
            method: "POST",
            path: "/admin/tickets/reply",
            tags: ["Admin Tickets"],
            summary: "Add staff reply",
            description: "Add a staff reply to a ticket",
        })
        .input(
            z.object({
                ticketId: z.number(),
                message: z.string().min(5, "Reply must be at least 5 characters"),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Verify ticket exists
            const [ticket] = await db
                .select()
                .from(supportTicket)
                .where(eq(supportTicket.id, input.ticketId));

            if (!ticket) {
                throw new Error("Ticket not found");
            }

            // Add staff reply
            const [newReply] = await db
                .insert(supportTicketReply)
                .values({
                    ticketId: input.ticketId,
                    userId,
                    message: input.message.trim(),
                    isStaffReply: true,
                } as NewSupportTicketReply)
                .returning();

            // Update ticket status to in_progress if it was open
            if (ticket.status === "open") {
                await db
                    .update(supportTicket)
                    .set({ status: "in_progress", updatedAt: new Date() })
                    .where(eq(supportTicket.id, input.ticketId));
            } else {
                await db
                    .update(supportTicket)
                    .set({ updatedAt: new Date() })
                    .where(eq(supportTicket.id, input.ticketId));
            }

            return { success: true, reply: newReply };
        }),

    /**
     * Update ticket status
     */
    updateStatus: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/tickets/status",
            tags: ["Admin Tickets"],
            summary: "Update ticket status",
            description: "Update the status of a ticket",
        })
        .input(
            z.object({
                ticketId: z.number(),
                status: z.enum(["open", "in_progress", "resolved", "closed"]),
            }),
        )
        .handler(async ({ input }) => {
            const updateData: {
                status: "open" | "in_progress" | "resolved" | "closed";
                updatedAt: Date;
                resolvedAt?: Date;
                closedAt?: Date;
            } = {
                status: input.status,
                updatedAt: new Date(),
            };

            if (input.status === "resolved") {
                updateData.resolvedAt = new Date();
            } else if (input.status === "closed") {
                updateData.closedAt = new Date();
            }

            await db
                .update(supportTicket)
                .set(updateData)
                .where(eq(supportTicket.id, input.ticketId));

            return { success: true };
        }),

    /**
     * Update ticket priority
     */
    updatePriority: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/tickets/priority",
            tags: ["Admin Tickets"],
            summary: "Update ticket priority",
            description: "Update the priority of a ticket",
        })
        .input(
            z.object({
                ticketId: z.number(),
                priority: z.enum(["low", "medium", "high", "critical"]),
            }),
        )
        .handler(async ({ input }) => {
            await db
                .update(supportTicket)
                .set({ priority: input.priority, updatedAt: new Date() })
                .where(eq(supportTicket.id, input.ticketId));

            return { success: true };
        }),

    /**
     * Escalate a ticket
     */
    escalate: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/tickets/escalate",
            tags: ["Admin Tickets"],
            summary: "Escalate ticket",
            description: "Mark a ticket as escalated",
        })
        .input(z.object({ ticketId: z.number() }))
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            await db
                .update(supportTicket)
                .set({
                    priority: "critical",
                    escalatedAt: new Date(),
                    escalatedBy: userId,
                    updatedAt: new Date(),
                })
                .where(eq(supportTicket.id, input.ticketId));

            return { success: true };
        }),

    /**
     * Add internal note (admin-only, not visible to user)
     */
    addInternalNote: adminProcedure
        .route({
            method: "POST",
            path: "/admin/tickets/note",
            tags: ["Admin Tickets"],
            summary: "Add internal note",
            description: "Add an internal admin note to a ticket",
        })
        .input(
            z.object({
                ticketId: z.number(),
                note: z.string().min(1, "Note cannot be empty"),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            const [newNote] = await db
                .insert(supportTicketNote)
                .values({
                    ticketId: input.ticketId,
                    userId,
                    note: input.note.trim(),
                } as NewSupportTicketNote)
                .returning();

            // Update ticket timestamp
            await db
                .update(supportTicket)
                .set({ updatedAt: new Date() })
                .where(eq(supportTicket.id, input.ticketId));

            return { success: true, note: newNote };
        }),

    /**
     * Bulk update status for multiple tickets
     */
    bulkUpdateStatus: adminProcedure
        .route({
            method: "PATCH",
            path: "/admin/tickets/bulk-status",
            tags: ["Admin Tickets"],
            summary: "Bulk update ticket status",
            description: "Update the status of multiple tickets at once",
        })
        .input(
            z.object({
                ticketIds: z.array(z.number()).min(1),
                status: z.enum(["open", "in_progress", "resolved", "closed"]),
            }),
        )
        .handler(async ({ input }) => {
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
                .update(supportTicket)
                .set(updateData)
                .where(inArray(supportTicket.id, input.ticketIds));

            return { success: true, updated: input.ticketIds.length };
        }),

    /**
     * Export tickets as JSON data (can be converted to CSV on frontend)
     */
    exportTickets: adminProcedure
        .route({
            method: "POST",
            path: "/admin/tickets/export",
            tags: ["Admin Tickets"],
            summary: "Export tickets",
            description: "Export filtered tickets for download",
        })
        .input(ticketFiltersSchema.omit({ page: true, limit: true }))
        .handler(async ({ input }) => {
            const conditions = [];

            if (
                input.status &&
                ["open", "in_progress", "resolved", "closed"].includes(input.status)
            ) {
                conditions.push(
                    eq(
                        supportTicket.status,
                        input.status as "open" | "in_progress" | "resolved" | "closed",
                    ),
                );
            }

            if (
                input.priority &&
                ["low", "medium", "high", "critical"].includes(input.priority)
            ) {
                conditions.push(
                    eq(
                        supportTicket.priority,
                        input.priority as "low" | "medium" | "high" | "critical",
                    ),
                );
            }

            if (
                input.category &&
                ["order", "payment", "delivery", "account", "other"].includes(
                    input.category,
                )
            ) {
                conditions.push(
                    eq(
                        supportTicket.category,
                        input.category as
                            | "order"
                            | "payment"
                            | "delivery"
                            | "account"
                            | "other",
                    ),
                );
            }

            if (
                input.userType &&
                ["customer", "retailer", "wholesaler"].includes(input.userType)
            ) {
                conditions.push(eq(supportTicket.userType, input.userType));
            }

            if (input.dateFrom) {
                conditions.push(
                    gte(supportTicket.createdAt, new Date(input.dateFrom)),
                );
            }

            if (input.dateTo) {
                const endDate = new Date(input.dateTo);
                endDate.setHours(23, 59, 59, 999);
                conditions.push(lte(supportTicket.createdAt, endDate));
            }

            const whereClause =
                conditions.length > 0 ? and(...conditions) : undefined;

            const tickets = await db
                .select({
                    ticketNumber: supportTicket.ticketNumber,
                    subject: supportTicket.subject,
                    status: supportTicket.status,
                    priority: supportTicket.priority,
                    category: supportTicket.category,
                    userType: supportTicket.userType,
                    createdAt: supportTicket.createdAt,
                    resolvedAt: supportTicket.resolvedAt,
                    customerName: user.name,
                    customerEmail: user.email,
                    customerPhone: user.phoneNumber,
                })
                .from(supportTicket)
                .leftJoin(user, eq(supportTicket.customerId, user.id))
                .where(whereClause)
                .orderBy(desc(supportTicket.createdAt));

            return { data: tickets };
        }),

    /**
     * Process auto-escalations for overdue tickets.
     * Can be called periodically from admin dashboard or a cron job.
     */
    processEscalations: adminProcedure
        .route({
            method: "POST",
            path: "/admin/tickets/process-escalations",
            tags: ["Admin Tickets"],
            summary: "Process auto-escalations",
            description: "Escalate overdue tickets to admin level",
        })
        .handler(async () => {
            const escalatedCount = await processAutoEscalations();
            return {
                success: true,
                escalatedCount,
                message: escalatedCount > 0
                    ? `${escalatedCount} ticket(s) auto-escalated to admin`
                    : "No tickets to escalate",
            };
        }),
};
