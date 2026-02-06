"use server";

import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import {
  type NewSupportTicketReply,
  supportTicket,
  supportTicketReply,
  type TicketStatus,
} from "@/db/schema/support";
import { auth } from "@/lib/auth";

interface TicketFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

// Get all tickets (admin only)
export async function getAllTickets(filters?: TicketFilters) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Admin access required", data: null };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    if (
      filters?.status &&
      ["open", "in_progress", "resolved", "closed"].includes(filters.status)
    ) {
      conditions.push(eq(supportTicket.status, filters.status as TicketStatus));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(supportTicket.subject, `%${filters.search}%`),
          ilike(supportTicket.ticketNumber, `%${filters.search}%`),
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
      success: true,
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
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    return { success: false, error: "Failed to fetch tickets", data: null };
  }
}

// Get ticket stats for admin dashboard
export async function getTicketStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Admin access required", data: null };
    }

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
      success: true,
      data: {
        total: totalResult?.count || 0,
        open: openResult?.count || 0,
        inProgress: inProgressResult?.count || 0,
        resolved: resolvedResult?.count || 0,
      },
    };
  } catch (error) {
    console.error("Error fetching ticket stats:", error);
    return { success: false, error: "Failed to fetch stats", data: null };
  }
}

// Get single ticket details (admin)
export async function getAdminTicketDetails(ticketId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Admin access required" };
    }

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
      .where(eq(supportTicket.id, ticketId));

    if (!ticket) {
      return { success: false, error: "Ticket not found" };
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

// Add staff reply to ticket
export async function addStaffReply(ticketId: number, message: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Admin access required" };
    }

    if (!message || message.trim().length < 5) {
      return { success: false, error: "Reply must be at least 5 characters" };
    }

    // Verify ticket exists
    const [ticket] = await db
      .select()
      .from(supportTicket)
      .where(eq(supportTicket.id, ticketId));

    if (!ticket) {
      return { success: false, error: "Ticket not found" };
    }

    // Add staff reply
    const [newReply] = await db
      .insert(supportTicketReply)
      .values({
        ticketId,
        userId: session.user.id,
        message: message.trim(),
        isStaffReply: true,
      } as NewSupportTicketReply)
      .returning();

    // Update ticket status to in_progress if it was open
    if (ticket.status === "open") {
      await db
        .update(supportTicket)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(supportTicket.id, ticketId));
    } else {
      await db
        .update(supportTicket)
        .set({ updatedAt: new Date() })
        .where(eq(supportTicket.id, ticketId));
    }

    revalidatePath(`/dashboard/admin/tickets/${ticketId}`);
    revalidatePath("/dashboard/admin/tickets");
    revalidatePath(`/account/support/${ticketId}`);

    return { success: true, reply: newReply };
  } catch (error) {
    console.error("Error adding staff reply:", error);
    return { success: false, error: "Failed to add reply" };
  }
}

// Update ticket status
export async function updateTicketStatus(
  ticketId: number,
  status: TicketStatus,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Admin access required" };
    }

    const updateData: {
      status: TicketStatus;
      updatedAt: Date;
      resolvedAt?: Date;
      closedAt?: Date;
    } = {
      status,
      updatedAt: new Date(),
    };

    if (status === "resolved") {
      updateData.resolvedAt = new Date();
    } else if (status === "closed") {
      updateData.closedAt = new Date();
    }

    await db
      .update(supportTicket)
      .set(updateData)
      .where(eq(supportTicket.id, ticketId));

    revalidatePath(`/dashboard/admin/tickets/${ticketId}`);
    revalidatePath("/dashboard/admin/tickets");
    revalidatePath(`/account/support/${ticketId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating ticket status:", error);
    return { success: false, error: "Failed to update status" };
  }
}
