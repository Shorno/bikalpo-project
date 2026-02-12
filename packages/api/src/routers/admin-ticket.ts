import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { supportTicket, supportTicketReply, user } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

type NewSupportTicketReply = typeof supportTicketReply.$inferInsert;

const ticketFiltersSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(10),
    status: z.string().optional(),
    search: z.string().optional(),
});

export const adminTicketRouter = {
    /**
     * Get all tickets (admin view)
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

            if (input.search) {
                conditions.push(
                    or(
                        ilike(supportTicket.subject, `%${input.search}%`),
                        ilike(supportTicket.ticketNumber, `%${input.search}%`),
                    ) as ReturnType<typeof eq>,
                );
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            // Get total count
            const [countResult] = await db
                .select({ count: count() })
                .from(supportTicket)
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
                    createdAt: supportTicket.createdAt,
                    updatedAt: supportTicket.updatedAt,
                    customer: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        shopName: user.shopName,
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
     * Get ticket stats for admin dashboard
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

            return {
                data: {
                    total: totalResult?.count || 0,
                    open: openResult?.count || 0,
                    inProgress: inProgressResult?.count || 0,
                    resolved: resolvedResult?.count || 0,
                },
            };
        }),

    /**
     * Get single ticket details (admin)
     */
    getById: adminProcedure
        .route({
            method: "POST",
            path: "/admin/tickets/by-id",
            tags: ["Admin Tickets"],
            summary: "Get ticket by ID",
            description: "Get single ticket details with replies",
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
                .orderBy(supportTicketReply.createdAt);

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
};
