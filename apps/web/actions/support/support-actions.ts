"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import {
  type NewSupportTicket,
  type NewSupportTicketReply,
  supportTicket,
  supportTicketReply,
} from "@/db/schema/support";
import { auth } from "@/lib/auth";
import {
  type AddReplyFormValues,
  addReplySchema,
  type CreateTicketFormValues,
  createTicketSchema,
} from "@/schema/support.schema";

// Generate unique ticket number
function generateTicketNumber(): string {
  const prefix = "TKT";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Create a new support ticket
export async function createSupportTicket(data: CreateTicketFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Please login to create a ticket" };
    }

    const validatedData = createTicketSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { subject, message, priority } = validatedData.data;

    const [newTicket] = await db
      .insert(supportTicket)
      .values({
        ticketNumber: generateTicketNumber(),
        customerId: session.user.id,
        subject,
        message,
        priority,
        status: "open",
      } as NewSupportTicket)
      .returning();

    revalidatePath("/account/support");

    return { success: true, ticket: newTicket };
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return { success: false, error: "Failed to create ticket" };
  }
}

// Get customer's tickets with pagination
export async function getCustomerTickets(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions = [eq(supportTicket.customerId, session.user.id)];
    if (
      params?.status &&
      ["open", "in_progress", "resolved", "closed"].includes(params.status)
    ) {
      conditions.push(
        eq(
          supportTicket.status,
          params.status as "open" | "in_progress" | "resolved" | "closed",
        ),
      );
    }

    // Get tickets
    const tickets = await db
      .select()
      .from(supportTicket)
      .where(
        sql`${conditions.map((c) => c).reduce((a, b) => sql`${a} AND ${b}`)}`,
      )
      .orderBy(desc(supportTicket.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(supportTicket)
      .where(eq(supportTicket.customerId, session.user.id));

    return {
      success: true,
      data: {
        tickets,
        pagination: {
          page,
          limit,
          totalCount: Number(countResult?.count) || 0,
          totalPages: Math.ceil((Number(countResult?.count) || 0) / limit),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return { success: false, error: "Failed to fetch tickets" };
  }
}

// Get single ticket with replies
export async function getTicketDetails(ticketId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get ticket
    const [ticket] = await db
      .select()
      .from(supportTicket)
      .where(eq(supportTicket.id, ticketId));

    if (!ticket) {
      return { success: false, error: "Ticket not found" };
    }

    // Check ownership
    if (ticket.customerId !== session.user.id) {
      return { success: false, error: "Unauthorized" };
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
      .where(eq(supportTicketReply.ticketId, ticketId))
      .orderBy(supportTicketReply.createdAt);

    return {
      success: true,
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
  } catch (error) {
    console.error("Error fetching ticket details:", error);
    return { success: false, error: "Failed to fetch ticket details" };
  }
}

// Add reply to ticket
export async function addTicketReply(data: AddReplyFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedData = addReplySchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { ticketId, message } = validatedData.data;

    // Verify ticket exists and user owns it
    const [ticket] = await db
      .select()
      .from(supportTicket)
      .where(eq(supportTicket.id, ticketId));

    if (!ticket || ticket.customerId !== session.user.id) {
      return { success: false, error: "Ticket not found or unauthorized" };
    }

    // Add reply
    const [newReply] = await db
      .insert(supportTicketReply)
      .values({
        ticketId,
        userId: session.user.id,
        message,
        isStaffReply: false,
      } as NewSupportTicketReply)
      .returning();

    // Update ticket timestamp
    await db
      .update(supportTicket)
      .set({ updatedAt: new Date() })
      .where(eq(supportTicket.id, ticketId));

    revalidatePath(`/account/support/${ticketId}`);

    return { success: true, reply: newReply };
  } catch (error) {
    console.error("Error adding reply:", error);
    return { success: false, error: "Failed to add reply" };
  }
}
