/**
 * User-facing Support Ticket Router — Hierarchical Escalation Model
 *
 * Ticket flow:
 *   Consumer → Retailer (Shop) → Admin
 *   Retailer → Warehouse → Admin
 *   Warehouse → Admin (direct)
 *
 * Each role can:
 *   - Create tickets (routed to the level above)
 *   - View own tickets
 *   - View incoming tickets assigned to them
 *   - Reply, resolve, escalate
 */

import { db } from "@bikalpo-project/db";
import {
    supportTicket,
    supportTicketReply,
    supportTicketAttachment,
    user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, sql, asc, lt, or, isNull } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default auto-escalation timeout in hours */
const ESCALATION_TIMEOUT_HOURS = 48;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateTicketNumber(): string {
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `TKT-${yy}${mm}${dd}-${rand}`;
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

function getEscalationDeadline(): Date {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + ESCALATION_TIMEOUT_HOURS);
    return deadline;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const userTicketRouter = {
    // ═══════════════════════════════════════════════════════════════════════════
    // MY TICKETS (tickets I created)
    // ═══════════════════════════════════════════════════════════════════════════

    /** List tickets the current user created */
    getMyTickets: protectedProcedure
        .route({
            method: "GET",
            path: "/support/my-tickets",
            tags: ["Support"],
            summary: "Get tickets I created",
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

            const conditions = [eq(supportTicket.customerId, userId)];
            if (status && status !== "all") {
                conditions.push(eq(supportTicket.status, status as "open" | "in_progress" | "resolved" | "closed"));
            }

            const whereClause = and(...conditions);

            const [tickets, totalResult] = await Promise.all([
                db
                    .select({
                        id: supportTicket.id,
                        ticketNumber: supportTicket.ticketNumber,
                        subject: supportTicket.subject,
                        message: supportTicket.message,
                        status: supportTicket.status,
                        priority: supportTicket.priority,
                        category: supportTicket.category,
                        currentLevel: supportTicket.currentLevel,
                        escalatedAt: supportTicket.escalatedAt,
                        autoEscalated: supportTicket.autoEscalated,
                        createdAt: supportTicket.createdAt,
                        updatedAt: supportTicket.updatedAt,
                        assignedTo: {
                            id: user.id,
                            name: user.name,
                            shopName: user.shopName,
                            warehouseName: user.warehouseName,
                        },
                    })
                    .from(supportTicket)
                    .leftJoin(user, eq(supportTicket.assignedToId, user.id))
                    .where(whereClause)
                    .orderBy(desc(supportTicket.createdAt))
                    .limit(limit)
                    .offset(offset),
                db
                    .select({ count: count() })
                    .from(supportTicket)
                    .where(whereClause),
            ]);

            const totalCount = totalResult[0]?.count || 0;

            return {
                tickets,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /** Get stats for tickets I created */
    getMyStats: protectedProcedure
        .route({
            method: "GET",
            path: "/support/my-stats",
            tags: ["Support"],
            summary: "Stats for tickets I created",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const result = await db
                .select({
                    total: count(),
                    open: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'open')`,
                    inProgress: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'in_progress')`,
                    resolved: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'resolved')`,
                    closed: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'closed')`,
                    escalated: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.currentLevel} = 'level_2')`,
                })
                .from(supportTicket)
                .where(eq(supportTicket.customerId, userId));

            return {
                total: Number(result[0]?.total || 0),
                open: Number(result[0]?.open || 0),
                inProgress: Number(result[0]?.inProgress || 0),
                resolved: Number(result[0]?.resolved || 0),
                closed: Number(result[0]?.closed || 0),
                escalated: Number(result[0]?.escalated || 0),
            };
        }),

    // ═══════════════════════════════════════════════════════════════════════════
    // INCOMING TICKETS (tickets assigned to me from the level below)
    // ═══════════════════════════════════════════════════════════════════════════

    /** List tickets assigned to the current user (shop sees consumer tickets, warehouse sees retailer tickets) */
    getIncomingTickets: protectedProcedure
        .route({
            method: "GET",
            path: "/support/incoming-tickets",
            tags: ["Support"],
            summary: "Get tickets assigned to me",
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

            const conditions = [
                eq(supportTicket.assignedToId, userId),
                eq(supportTicket.currentLevel, "level_1"),
            ];

            if (status && status !== "all") {
                conditions.push(eq(supportTicket.status, status as "open" | "in_progress" | "resolved" | "closed"));
            }

            const whereClause = and(...conditions);

            // Alias the user table for the customer join (distinct from the assigned user)
            const [tickets, totalResult] = await Promise.all([
                db
                    .select({
                        id: supportTicket.id,
                        ticketNumber: supportTicket.ticketNumber,
                        subject: supportTicket.subject,
                        message: supportTicket.message,
                        status: supportTicket.status,
                        priority: supportTicket.priority,
                        category: supportTicket.category,
                        userType: supportTicket.userType,
                        escalationDeadline: supportTicket.escalationDeadline,
                        createdAt: supportTicket.createdAt,
                        updatedAt: supportTicket.updatedAt,
                        customer: {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            phoneNumber: user.phoneNumber,
                            shopName: user.shopName,
                        },
                    })
                    .from(supportTicket)
                    .leftJoin(user, eq(supportTicket.customerId, user.id))
                    .where(whereClause)
                    .orderBy(desc(supportTicket.createdAt))
                    .limit(limit)
                    .offset(offset),
                db
                    .select({ count: count() })
                    .from(supportTicket)
                    .where(whereClause),
            ]);

            const totalCount = totalResult[0]?.count || 0;

            return {
                tickets,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            };
        }),

    /** Stats for incoming tickets assigned to current user */
    getIncomingStats: protectedProcedure
        .route({
            method: "GET",
            path: "/support/incoming-stats",
            tags: ["Support"],
            summary: "Stats for tickets assigned to me",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const now = new Date();
            const result = await db
                .select({
                    total: count(),
                    open: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'open')`,
                    inProgress: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'in_progress')`,
                    resolved: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'resolved')`,
                    closed: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'closed')`,
                    overdue: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.escalationDeadline} < ${now} AND ${supportTicket.status} IN ('open', 'in_progress'))`,
                })
                .from(supportTicket)
                .where(
                    and(
                        eq(supportTicket.assignedToId, userId),
                        eq(supportTicket.currentLevel, "level_1"),
                    ),
                );

            return {
                total: Number(result[0]?.total || 0),
                open: Number(result[0]?.open || 0),
                inProgress: Number(result[0]?.inProgress || 0),
                resolved: Number(result[0]?.resolved || 0),
                closed: Number(result[0]?.closed || 0),
                overdue: Number(result[0]?.overdue || 0),
            };
        }),

    // ═══════════════════════════════════════════════════════════════════════════
    // CREATE TICKET (smart routing per role)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a new support ticket.
     *
     * Routing:
     *   - Consumer → must provide shopId → assigned to shop owner
     *   - Retailer (shop_owner) → must provide warehouseId → assigned to warehouse owner
     *   - Warehouse → assigned to null (admin pool), no escalation deadline
     */
    create: protectedProcedure
        .route({
            method: "POST",
            path: "/support/tickets",
            tags: ["Support"],
            summary: "Create a support ticket",
        })
        .input(
            z.object({
                subject: z.string().min(5).max(200),
                message: z.string().min(10).max(5000),
                category: z.enum(["order", "payment", "delivery", "account", "other"]).default("other"),
                priority: z.enum(["low", "medium", "high"]).default("medium"),
                // For consumer: which shop to send the ticket to
                shopId: z.string().optional(),
                // For retailer: which warehouse to send the ticket to
                warehouseId: z.string().optional(),
                // File attachments (uploaded to Cloudinary first)
                attachments: z.array(
                    z.object({
                        url: z.string().url(),
                        fileName: z.string(),
                        fileType: z.string().optional(),
                    }),
                ).optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role ?? null;
            const userType = mapRoleToUserType(userRole);

            let assignedToId: string | null = null;
            let escalationDeadline: Date | null = null;
            let currentLevel = "level_1";

            if (userRole === "consumer" || (!userRole || userRole === "user")) {
                // Consumer → Shop
                if (!input.shopId) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Please select a shop to send your ticket to",
                    });
                }
                // Verify the shop exists and is a shop_owner
                const [shop] = await db
                    .select({ id: user.id, role: user.role })
                    .from(user)
                    .where(eq(user.id, input.shopId));

                if (!shop || shop.role !== "shop_owner") {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Invalid shop selected",
                    });
                }
                assignedToId = input.shopId;
                escalationDeadline = getEscalationDeadline();
            } else if (userRole === "shop_owner") {
                // Retailer → Warehouse
                if (!input.warehouseId) {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Please select a warehouse to send your ticket to",
                    });
                }
                // Verify the warehouse exists
                const [warehouse] = await db
                    .select({ id: user.id, role: user.role })
                    .from(user)
                    .where(eq(user.id, input.warehouseId));

                if (!warehouse || warehouse.role !== "warehouse") {
                    throw new ORPCError("BAD_REQUEST", {
                        message: "Invalid warehouse selected",
                    });
                }
                assignedToId = input.warehouseId;
                escalationDeadline = getEscalationDeadline();
            } else if (userRole === "warehouse") {
                // Warehouse → Admin (direct)
                assignedToId = null; // admin pool
                escalationDeadline = null; // no auto-escalation
                currentLevel = "level_1"; // already at admin
            }

            const [newTicket] = await db
                .insert(supportTicket)
                .values({
                    ticketNumber: generateTicketNumber(),
                    customerId: userId,
                    subject: input.subject,
                    message: input.message,
                    category: input.category,
                    userType,
                    priority: input.priority,
                    status: "open",
                    assignedToId,
                    currentLevel,
                    escalationDeadline,
                })
                .returning();

            // Insert file attachments if provided
            if (input.attachments && input.attachments.length > 0) {
                await db.insert(supportTicketAttachment).values(
                    input.attachments.map((att) => ({
                        ticketId: newTicket.id,
                        url: att.url,
                        fileName: att.fileName,
                        fileType: att.fileType ?? null,
                        uploadedBy: userId,
                    })),
                );
            }

            return newTicket;
        }),

    // ═══════════════════════════════════════════════════════════════════════════
    // TICKET DETAIL & ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /** Get ticket details — visible to creator OR assigned handler */
    getById: protectedProcedure
        .route({
            method: "GET",
            path: "/support/tickets/{id}",
            tags: ["Support"],
            summary: "Get ticket details",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            // Find ticket where user is either the creator or the assigned handler
            const [ticket] = await db
                .select()
                .from(supportTicket)
                .where(
                    and(
                        eq(supportTicket.id, input.id),
                        or(
                            eq(supportTicket.customerId, userId),
                            eq(supportTicket.assignedToId, userId),
                        ),
                    ),
                );

            if (!ticket) {
                throw new ORPCError("NOT_FOUND", { message: "Ticket not found" });
            }

            // Get customer info
            const [customer] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    shopName: user.shopName,
                    role: user.role,
                })
                .from(user)
                .where(eq(user.id, ticket.customerId));

            // Get assigned handler info
            let assignedHandler = null;
            if (ticket.assignedToId) {
                const [handler] = await db
                    .select({
                        id: user.id,
                        name: user.name,
                        shopName: user.shopName,
                        warehouseName: user.warehouseName,
                        role: user.role,
                    })
                    .from(user)
                    .where(eq(user.id, ticket.assignedToId));
                assignedHandler = handler || null;
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
                    userRole: user.role,
                })
                .from(supportTicketReply)
                .leftJoin(user, eq(supportTicketReply.userId, user.id))
                .where(eq(supportTicketReply.ticketId, ticket.id))
                .orderBy(asc(supportTicketReply.createdAt));

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
                .where(eq(supportTicketAttachment.ticketId, ticket.id))
                .orderBy(asc(supportTicketAttachment.createdAt));

            return {
                ...ticket,
                customer: customer || null,
                assignedHandler,
                replies: replies.map((r) => ({
                    ...r,
                    user: {
                        id: r.userId,
                        name: r.userName || "Unknown",
                        image: r.userImage,
                        role: r.userRole,
                    },
                })),
                attachments,
            };
        }),

    /** Reply to a ticket — allowed by creator OR assigned handler */
    reply: protectedProcedure
        .route({
            method: "POST",
            path: "/support/tickets/{ticketId}/reply",
            tags: ["Support"],
            summary: "Reply to a ticket",
        })
        .input(
            z.object({
                ticketId: z.number(),
                message: z.string().min(5).max(5000),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role;

            // Verify user is creator or assigned handler
            const [ticket] = await db
                .select()
                .from(supportTicket)
                .where(
                    and(
                        eq(supportTicket.id, input.ticketId),
                        or(
                            eq(supportTicket.customerId, userId),
                            eq(supportTicket.assignedToId, userId),
                        ),
                    ),
                );

            if (!ticket) {
                throw new ORPCError("NOT_FOUND", { message: "Ticket not found" });
            }

            if (ticket.status === "closed") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Cannot reply to a closed ticket",
                });
            }

            // Determine if this is a "staff" reply (handler replying to creator)
            const isStaffReply = ticket.assignedToId === userId;

            const [reply] = await db
                .insert(supportTicketReply)
                .values({
                    ticketId: input.ticketId,
                    userId,
                    message: input.message,
                    isStaffReply,
                })
                .returning();

            // Update status based on who is replying
            if (isStaffReply && ticket.status === "open") {
                // Handler first response → in_progress
                await db
                    .update(supportTicket)
                    .set({ status: "in_progress", updatedAt: new Date() })
                    .where(eq(supportTicket.id, input.ticketId));
            } else if (!isStaffReply && ticket.status === "resolved") {
                // Creator replies to resolved → reopen
                await db
                    .update(supportTicket)
                    .set({ status: "open", updatedAt: new Date() })
                    .where(eq(supportTicket.id, input.ticketId));
            } else {
                await db
                    .update(supportTicket)
                    .set({ updatedAt: new Date() })
                    .where(eq(supportTicket.id, input.ticketId));
            }

            return reply;
        }),

    /** Resolve a ticket — only the assigned handler can resolve */
    resolve: protectedProcedure
        .route({
            method: "PATCH",
            path: "/support/tickets/{ticketId}/resolve",
            tags: ["Support"],
            summary: "Resolve a ticket",
        })
        .input(z.object({ ticketId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [ticket] = await db
                .select()
                .from(supportTicket)
                .where(
                    and(
                        eq(supportTicket.id, input.ticketId),
                        eq(supportTicket.assignedToId, userId),
                    ),
                );

            if (!ticket) {
                throw new ORPCError("NOT_FOUND", { message: "Ticket not found or you are not the handler" });
            }

            if (ticket.status === "closed" || ticket.status === "resolved") {
                throw new ORPCError("BAD_REQUEST", { message: "Ticket is already resolved or closed" });
            }

            await db
                .update(supportTicket)
                .set({
                    status: "resolved",
                    resolvedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(supportTicket.id, input.ticketId));

            return { success: true };
        }),

    /** Close a ticket — only the creator can close (confirms resolution) */
    close: protectedProcedure
        .route({
            method: "PATCH",
            path: "/support/tickets/{ticketId}/close",
            tags: ["Support"],
            summary: "Close a resolved ticket",
        })
        .input(z.object({ ticketId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [ticket] = await db
                .select()
                .from(supportTicket)
                .where(
                    and(
                        eq(supportTicket.id, input.ticketId),
                        eq(supportTicket.customerId, userId),
                    ),
                );

            if (!ticket) {
                throw new ORPCError("NOT_FOUND", { message: "Ticket not found" });
            }

            await db
                .update(supportTicket)
                .set({
                    status: "closed",
                    closedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(supportTicket.id, input.ticketId));

            return { success: true };
        }),

    /** Manually escalate a ticket to admin — by the assigned handler */
    escalateToAdmin: protectedProcedure
        .route({
            method: "PATCH",
            path: "/support/tickets/{ticketId}/escalate",
            tags: ["Support"],
            summary: "Escalate ticket to admin",
        })
        .input(z.object({ ticketId: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const [ticket] = await db
                .select()
                .from(supportTicket)
                .where(
                    and(
                        eq(supportTicket.id, input.ticketId),
                        eq(supportTicket.assignedToId, userId),
                        eq(supportTicket.currentLevel, "level_1"),
                    ),
                );

            if (!ticket) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Ticket not found or already escalated",
                });
            }

            await db
                .update(supportTicket)
                .set({
                    currentLevel: "level_2",
                    assignedToId: null, // admin pool
                    escalatedAt: new Date(),
                    escalatedBy: userId,
                    autoEscalated: false,
                    updatedAt: new Date(),
                })
                .where(eq(supportTicket.id, input.ticketId));

            return { success: true };
        }),

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS for ticket creation (fetch available shops, warehouses)
    // ═══════════════════════════════════════════════════════════════════════════

    /** Get shops the consumer has ordered from (for ticket creation) */
    getMyShops: protectedProcedure
        .route({
            method: "GET",
            path: "/support/my-shops",
            tags: ["Support"],
            summary: "Get shops I can create tickets for",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Find unique shops from consumer orders
            const shops = await db
                .selectDistinctOn([user.id], {
                    id: user.id,
                    name: user.name,
                    shopName: user.shopName,
                })
                .from(user)
                .innerJoin(
                    // Use a raw SQL sub-select for the order table to avoid import conflicts
                    sql`"order" AS o`,
                    sql`o.shop_id = ${user.id} AND o.user_id = ${userId}`,
                )
                .where(eq(user.role, "shop_owner"));

            return shops;
        }),

    /** Get warehouses the retailer is connected to (for ticket creation) */
    getMyWarehouses: protectedProcedure
        .route({
            method: "GET",
            path: "/support/my-warehouses",
            tags: ["Support"],
            summary: "Get warehouses I can create tickets for",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Find connected warehouses via shop_warehouse_connection
            const warehouses = await db
                .select({
                    id: user.id,
                    name: user.name,
                    warehouseName: user.warehouseName,
                })
                .from(user)
                .innerJoin(
                    sql`"shop_warehouse_connection" AS swc`,
                    sql`swc.warehouse_id = ${user.id} AND swc.shop_id = ${userId} AND swc.status = 'active'`,
                )
                .where(eq(user.role, "warehouse"));

            return warehouses;
        }),
};
