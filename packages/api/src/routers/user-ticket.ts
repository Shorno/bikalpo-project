/**
 * User-facing Support Ticket Router
 *
 * Allows any authenticated user (consumer, shop_owner, warehouse)
 * to create, view, and reply to their own support tickets.
 */

import { db } from "@bikalpo-project/db";
import {
    supportTicket,
    supportTicketReply,
    supportTicketAttachment,
    user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

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

// ─── Router ──────────────────────────────────────────────────────────────────

export const userTicketRouter = {
    /** List current user's tickets */
    getMyTickets: protectedProcedure
        .route({
            method: "GET",
            path: "/support/my-tickets",
            tags: ["Support"],
            summary: "Get current user's support tickets",
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
                db.query.supportTicket.findMany({
                    where: whereClause,
                    orderBy: [desc(supportTicket.createdAt)],
                    limit,
                    offset,
                }),
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

    /** Get user's ticket stats */
    getMyStats: protectedProcedure
        .route({
            method: "GET",
            path: "/support/my-stats",
            tags: ["Support"],
            summary: "Get current user's ticket stats",
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
                })
                .from(supportTicket)
                .where(eq(supportTicket.customerId, userId));

            return {
                total: Number(result[0]?.total || 0),
                open: Number(result[0]?.open || 0),
                inProgress: Number(result[0]?.inProgress || 0),
                resolved: Number(result[0]?.resolved || 0),
                closed: Number(result[0]?.closed || 0),
            };
        }),

    /** Create a new support ticket */
    create: protectedProcedure
        .route({
            method: "POST",
            path: "/support/tickets",
            tags: ["Support"],
            summary: "Create a new support ticket",
        })
        .input(
            z.object({
                subject: z.string().min(5).max(200),
                message: z.string().min(10).max(5000),
                category: z.enum(["order", "payment", "delivery", "account", "other"]).default("other"),
                priority: z.enum(["low", "medium", "high"]).default("medium"),
            }),
        )
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role;
            const userType = mapRoleToUserType(userRole);

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
                })
                .returning();

            return newTicket;
        }),

    /** Get a specific ticket (owned by current user) */
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

            const ticket = await db.query.supportTicket.findFirst({
                where: and(
                    eq(supportTicket.id, input.id),
                    eq(supportTicket.customerId, userId),
                ),
            });

            if (!ticket) {
                throw new ORPCError("NOT_FOUND", { message: "Ticket not found" });
            }

            // Get replies (exclude internal notes — those are admin-only)
            const replies = await db.query.supportTicketReply.findMany({
                where: eq(supportTicketReply.ticketId, ticket.id),
                with: {
                    user: {
                        columns: { id: true, name: true, image: true },
                    },
                },
                orderBy: [desc(supportTicketReply.createdAt)],
            });

            // Get attachments
            const attachments = await db.query.supportTicketAttachment.findMany({
                where: eq(supportTicketAttachment.ticketId, ticket.id),
            });

            return {
                ...ticket,
                replies,
                attachments,
            };
        }),

    /** Reply to owned ticket */
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

            // Verify ownership
            const ticket = await db.query.supportTicket.findFirst({
                where: and(
                    eq(supportTicket.id, input.ticketId),
                    eq(supportTicket.customerId, userId),
                ),
            });

            if (!ticket) {
                throw new ORPCError("NOT_FOUND", { message: "Ticket not found" });
            }

            if (ticket.status === "closed") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Cannot reply to a closed ticket",
                });
            }

            const [reply] = await db
                .insert(supportTicketReply)
                .values({
                    ticketId: input.ticketId,
                    userId,
                    message: input.message,
                    isStaffReply: false,
                })
                .returning();

            // Reopen if it was resolved
            if (ticket.status === "resolved") {
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
};
