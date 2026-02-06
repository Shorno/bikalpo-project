"use server";

import { and, count, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { deliveryGroup, deliveryGroupInvoice } from "@/db/schema/delivery";
import { invoice } from "@/db/schema/invoice";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";
import {
  type MarkDeliveredFormValues,
  type MarkFailedFormValues,
  markDeliveredSchema,
  markFailedSchema,
} from "@/schema/delivery.schema";

export async function getAssignedGroups() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", groups: [] };
    }

    if (session.user.role !== "deliveryman") {
      return {
        success: false,
        error: "Only deliverymen can access this",
        groups: [],
      };
    }

    const groups = await db.query.deliveryGroup.findMany({
      where: and(
        eq(deliveryGroup.deliverymanId, session.user.id),
        // Show assigned, out_for_delivery, and partial groups
        sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery', 'partial')`,
      ),
      with: {
        invoices: {
          with: {
            invoice: {
              with: {
                customer: {
                  columns: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    shopName: true,
                  },
                },
                items: true,
                order: true,
              },
            },
          },
          orderBy: [deliveryGroupInvoice.sequence],
        },
      },
      orderBy: [desc(deliveryGroup.assignedAt)],
    });

    return { success: true, groups };
  } catch (error) {
    console.error("Error getting assigned groups:", error);
    return {
      success: false,
      error: "Failed to get assigned groups",
      groups: [],
    };
  }
}

export async function startDelivery(groupId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "deliveryman") {
      return { success: false, error: "Unauthorized" };
    }

    const group = await db.query.deliveryGroup.findFirst({
      where: eq(deliveryGroup.id, groupId),
      with: {
        invoices: true,
      },
    });

    if (!group) {
      return { success: false, error: "Delivery group not found" };
    }

    if (group.deliverymanId !== session.user.id) {
      return { success: false, error: "Not assigned to this group" };
    }

    if (group.status !== "assigned") {
      return { success: false, error: "Can only start assigned deliveries" };
    }

    // Generate 4-digit OTP
    const generateOtp = () =>
      Math.floor(1000 + Math.random() * 9000).toString();

    await db.transaction(async (tx) => {
      // Update group status
      await tx
        .update(deliveryGroup)
        .set({ status: "out_for_delivery" })
        .where(eq(deliveryGroup.id, groupId));

      // Generate OTP for each invoice in the group and update invoice delivery status
      for (const deliveryInvoice of group.invoices) {
        await tx
          .update(deliveryGroupInvoice)
          .set({ deliveryOtp: generateOtp() })
          .where(eq(deliveryGroupInvoice.id, deliveryInvoice.id));

        // Update invoice delivery status to out_for_delivery
        await tx
          .update(invoice)
          .set({ deliveryStatus: "out_for_delivery" })
          .where(eq(invoice.id, deliveryInvoice.invoiceId));
      }
    });

    revalidatePath("/employee/delivery");
    revalidatePath("/dashboard/delivery");

    return { success: true };
  } catch (error) {
    console.error("Error starting delivery:", error);
    return { success: false, error: "Failed to start delivery" };
  }
}

export async function markInvoiceDelivered(data: MarkDeliveredFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "deliveryman") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = markDeliveredSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { deliveryInvoiceId, deliveryPhoto, deliveryOtp } =
      validatedData.data;

    // Get delivery invoice with group
    const deliveryInvoiceData = await db.query.deliveryGroupInvoice.findFirst({
      where: eq(deliveryGroupInvoice.id, deliveryInvoiceId),
      with: { group: true, invoice: true },
    });

    if (!deliveryInvoiceData) {
      return { success: false, error: "Delivery invoice not found" };
    }

    if (deliveryInvoiceData.group.deliverymanId !== session.user.id) {
      return { success: false, error: "Not assigned to this delivery" };
    }

    // Server-side enforcement: delivery must be started before marking invoices
    if (deliveryInvoiceData.group.status !== "out_for_delivery") {
      return {
        success: false,
        error: "Delivery must be started before marking invoices",
      };
    }

    if (deliveryInvoiceData.status !== "pending") {
      return { success: false, error: "Invoice already processed" };
    }

    // Verify OTP
    if (!deliveryOtp) {
      return { success: false, error: "OTP is required" };
    }

    if (deliveryInvoiceData.deliveryOtp !== deliveryOtp) {
      return {
        success: false,
        error: "Invalid OTP. Please check with customer.",
      };
    }

    await db.transaction(async (tx) => {
      // Mark delivery invoice as delivered
      await tx
        .update(deliveryGroupInvoice)
        .set({
          status: "delivered",
          deliveredAt: new Date(),
          deliveryPhoto: deliveryPhoto || null,
          deliveryOtp: deliveryOtp || null,
        })
        .where(eq(deliveryGroupInvoice.id, deliveryInvoiceId));

      // Update invoice status
      await tx
        .update(invoice)
        .set({
          deliveryStatus: "delivered",
          deliveredAt: new Date(),
        })
        .where(eq(invoice.id, deliveryInvoiceData.invoiceId));

      // Update order status to delivered
      if (deliveryInvoiceData.invoice?.orderId) {
        await tx
          .update(order)
          .set({
            status: "delivered",
            deliveredAt: new Date(),
          })
          .where(eq(order.id, deliveryInvoiceData.invoice.orderId));
      }

      // Update group completed count
      await tx
        .update(deliveryGroup)
        .set({
          completedInvoices: sql`${deliveryGroup.completedInvoices} + 1`,
        })
        .where(eq(deliveryGroup.id, deliveryInvoiceData.groupId));

      // Check if all invoices are completed
      const remainingPending = await tx
        .select({ count: count() })
        .from(deliveryGroupInvoice)
        .where(
          and(
            eq(deliveryGroupInvoice.groupId, deliveryInvoiceData.groupId),
            eq(deliveryGroupInvoice.status, "pending"),
          ),
        );

      if (remainingPending[0]?.count === 0) {
        // Check for any failed invoices
        const failedInvoices = await tx
          .select({ count: count() })
          .from(deliveryGroupInvoice)
          .where(
            and(
              eq(deliveryGroupInvoice.groupId, deliveryInvoiceData.groupId),
              eq(deliveryGroupInvoice.status, "failed"),
            ),
          );

        const newStatus =
          failedInvoices[0]?.count > 0 ? "partial" : "completed";

        await tx
          .update(deliveryGroup)
          .set({
            status: newStatus,
            completedAt: new Date(),
          })
          .where(eq(deliveryGroup.id, deliveryInvoiceData.groupId));
      }
    });

    revalidatePath("/employee/delivery");
    revalidatePath("/dashboard/delivery");
    revalidatePath("/dashboard/admin/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error marking invoice delivered:", error);
    return { success: false, error: "Failed to mark invoice as delivered" };
  }
}

export async function markInvoiceFailed(data: MarkFailedFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "deliveryman") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = markFailedSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { deliveryInvoiceId, failedReason } = validatedData.data;

    // Get delivery invoice with group
    const deliveryInvoiceData = await db.query.deliveryGroupInvoice.findFirst({
      where: eq(deliveryGroupInvoice.id, deliveryInvoiceId),
      with: { group: true },
    });

    if (!deliveryInvoiceData) {
      return { success: false, error: "Delivery invoice not found" };
    }

    if (deliveryInvoiceData.group.deliverymanId !== session.user.id) {
      return { success: false, error: "Not assigned to this delivery" };
    }

    // Server-side enforcement: delivery must be started before marking invoices
    if (deliveryInvoiceData.group.status !== "out_for_delivery") {
      return {
        success: false,
        error: "Delivery must be started before marking invoices",
      };
    }

    if (deliveryInvoiceData.status !== "pending") {
      return { success: false, error: "Invoice already processed" };
    }

    await db.transaction(async (tx) => {
      // Mark delivery invoice as failed
      await tx
        .update(deliveryGroupInvoice)
        .set({
          status: "failed",
          failedReason,
        })
        .where(eq(deliveryGroupInvoice.id, deliveryInvoiceId));

      // Update invoice status
      await tx
        .update(invoice)
        .set({
          deliveryStatus: "failed",
        })
        .where(eq(invoice.id, deliveryInvoiceData.invoiceId));

      // Check if all invoices are processed
      const remainingPending = await tx
        .select({ count: count() })
        .from(deliveryGroupInvoice)
        .where(
          and(
            eq(deliveryGroupInvoice.groupId, deliveryInvoiceData.groupId),
            eq(deliveryGroupInvoice.status, "pending"),
          ),
        );

      if (remainingPending[0]?.count === 0) {
        await tx
          .update(deliveryGroup)
          .set({
            status: "partial",
            completedAt: new Date(),
          })
          .where(eq(deliveryGroup.id, deliveryInvoiceData.groupId));
      }
    });

    revalidatePath("/employee/delivery");
    revalidatePath("/dashboard/delivery");
    revalidatePath("/dashboard/admin/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error marking invoice failed:", error);
    return { success: false, error: "Failed to mark invoice as failed" };
  }
}

export async function getDeliveryStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "deliveryman") {
      return { success: false, error: "Unauthorized" };
    }

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all delivery invoices for this deliveryman
    const groups = await db.query.deliveryGroup.findMany({
      where: eq(deliveryGroup.deliverymanId, session.user.id),
      with: {
        invoices: true,
      },
    });

    let totalDeliveries = 0;
    let completedToday = 0;
    let failedToday = 0;
    let pendingToday = 0;

    for (const group of groups) {
      for (const deliveryInvoice of group.invoices) {
        totalDeliveries++;

        if (deliveryInvoice.status === "delivered") {
          if (
            deliveryInvoice.deliveredAt &&
            deliveryInvoice.deliveredAt >= today
          ) {
            completedToday++;
          }
        } else if (deliveryInvoice.status === "failed") {
          failedToday++;
        } else if (deliveryInvoice.status === "pending") {
          pendingToday++;
        }
      }
    }

    // Get active groups count
    const activeGroups = groups.filter(
      (g) => g.status === "assigned" || g.status === "out_for_delivery",
    ).length;

    return {
      success: true,
      stats: {
        totalDeliveries,
        completedToday,
        failedToday,
        pendingToday,
        activeGroups,
        successRate:
          totalDeliveries > 0
            ? Math.round(
                ((totalDeliveries - failedToday) / totalDeliveries) * 100,
              )
            : 100,
      },
    };
  } catch (error) {
    console.error("Error getting delivery stats:", error);
    return { success: false, error: "Failed to get stats" };
  }
}
