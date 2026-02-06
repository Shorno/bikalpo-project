"use server";

import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import {
  type DeliveryGroupStatus,
  deliveryGroup,
  deliveryGroupInvoice,
  type NewDeliveryGroup,
  type NewDeliveryGroupInvoice,
} from "@/db/schema/delivery";
import { invoice } from "@/db/schema/invoice";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";
import {
  type AssignDeliverymanFormValues,
  assignDeliverymanSchema,
  type CreateDeliveryGroupFormValues,
  createDeliveryGroupSchema,
  type UpdateDeliverySequenceFormValues,
  updateDeliverySequenceSchema,
} from "@/schema/delivery.schema";

// Helper: Get IDs of deliverymen who have active (non-completed) delivery groups
async function getDeliverymenWithActiveGroups(): Promise<string[]> {
  const activeStatuses = ["assigned", "out_for_delivery", "partial"] as const;
  const activeGroups = await db
    .select({ deliverymanId: deliveryGroup.deliverymanId })
    .from(deliveryGroup)
    .where(inArray(deliveryGroup.status, activeStatuses));
  return [...new Set(activeGroups.map((g) => g.deliverymanId))];
}

// Get invoices that are ready for delivery but not yet assigned to a delivery group
export async function getUnassignedInvoices() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", invoices: [] };
    }

    // Get invoices that are already in a delivery group
    const assignedInvoiceIds = await db
      .select({ invoiceId: deliveryGroupInvoice.invoiceId })
      .from(deliveryGroupInvoice);

    const assignedIds = assignedInvoiceIds.map((i) => i.invoiceId);

    // Get invoices that are not assigned to any delivery group yet
    const invoices = await db.query.invoice.findMany({
      where: and(
        eq(invoice.deliveryStatus, "not_assigned"),
        assignedIds.length > 0
          ? sql`${invoice.id} NOT IN (${sql.join(assignedIds, sql`, `)})`
          : undefined,
      ),
      with: {
        items: true,
        order: {
          columns: {
            id: true,
            orderNumber: true,
            shippingName: true,
            shippingPhone: true,
            shippingAddress: true,
            shippingCity: true,
            shippingArea: true,
          },
        },
        customer: {
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
            shopName: true,
          },
        },
      },
      orderBy: [desc(invoice.createdAt)],
    });

    return { success: true, invoices };
  } catch (error) {
    console.error("Error getting unassigned invoices:", error);
    return { success: false, error: "Failed to get invoices", invoices: [] };
  }
}

export async function createDeliveryGroup(data: CreateDeliveryGroupFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = createDeliveryGroupSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const {
      groupName,
      invoiceIds,
      deliverymanId,
      notes,
      vehicleType,
      expectedDeliveryAt,
    } = validatedData.data;

    // Verify deliveryman exists and has correct role
    const deliveryman = await db.query.user.findFirst({
      where: eq(user.id, deliverymanId),
    });

    if (!deliveryman) {
      return { success: false, error: "Deliveryman not found" };
    }

    if (deliveryman.role !== "deliveryman") {
      return { success: false, error: "Selected user is not a deliveryman" };
    }

    // Check if deliveryman already has an active group
    const busyDeliverymen = await getDeliverymenWithActiveGroups();
    if (busyDeliverymen.includes(deliverymanId)) {
      return {
        success: false,
        error: "This deliveryman already has an active delivery group",
      };
    }

    // Create group with invoices in a transaction
    const result = await db.transaction(async (tx) => {
      // Create delivery group with assigned deliveryman
      const [newGroup] = await tx
        .insert(deliveryGroup)
        .values({
          groupName,
          status: "assigned",
          totalInvoices: invoiceIds.length,
          completedInvoices: 0,
          deliverymanId,
          assignedAt: new Date(),
          notes: notes || null,
          vehicleType: vehicleType ?? null,
          expectedDeliveryAt: expectedDeliveryAt
            ? new Date(expectedDeliveryAt)
            : null,
        } as NewDeliveryGroup)
        .returning();

      if (!newGroup) {
        throw new Error("Failed to create delivery group");
      }

      // Add invoices to group
      const groupInvoices: NewDeliveryGroupInvoice[] = invoiceIds.map(
        (invoiceId, index) => ({
          groupId: newGroup.id,
          invoiceId,
          sequence: index + 1,
          status: "pending",
        }),
      );

      await tx.insert(deliveryGroupInvoice).values(groupInvoices);

      // Update invoice delivery status to "pending" when assigned to delivery group
      // and order status to "processing"
      for (const invoiceId of invoiceIds) {
        // Get the invoice to find its orderId
        const invoiceData = await tx.query.invoice.findFirst({
          where: eq(invoice.id, invoiceId),
          columns: { orderId: true },
        });

        // Update invoice delivery status
        await tx
          .update(invoice)
          .set({ deliveryStatus: "pending" })
          .where(eq(invoice.id, invoiceId));

        // Update order status to processing
        if (invoiceData?.orderId) {
          await tx
            .update(order)
            .set({ status: "processing" })
            .where(eq(order.id, invoiceData.orderId));
        }
      }

      return newGroup;
    });

    revalidatePath("/dashboard/delivery");
    revalidatePath("/dashboard/admin/delivery");
    revalidatePath("/dashboard/admin/invoices");

    return { success: true, group: result };
  } catch (error) {
    console.error("Error creating delivery group:", error);
    return { success: false, error: "Failed to create delivery group" };
  }
}

export async function assignDeliveryman(data: AssignDeliverymanFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = assignDeliverymanSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { groupId, deliverymanId, vehicleType, expectedDeliveryAt } =
      validatedData.data;

    // Verify deliveryman exists and has correct role
    const deliveryman = await db.query.user.findFirst({
      where: eq(user.id, deliverymanId),
    });

    if (!deliveryman) {
      return { success: false, error: "Deliveryman not found" };
    }

    if (deliveryman.role !== "deliveryman") {
      return { success: false, error: "User is not a deliveryman" };
    }

    // Check if deliveryman already has an active group (excluding the current group being reassigned)
    const activeGroups = await db.query.deliveryGroup.findMany({
      where: and(
        eq(deliveryGroup.deliverymanId, deliverymanId),
        ne(deliveryGroup.id, groupId),
        inArray(deliveryGroup.status, [
          "assigned",
          "out_for_delivery",
          "partial",
        ]),
      ),
      columns: { id: true },
    });
    if (activeGroups.length > 0) {
      return {
        success: false,
        error: "This deliveryman already has an active delivery group",
      };
    }

    // Assign deliveryman to group
    const set: Record<string, unknown> = {
      deliverymanId,
      status: "assigned",
      assignedAt: new Date(),
    };
    if (vehicleType !== undefined) set.vehicleType = vehicleType;
    if (expectedDeliveryAt !== undefined)
      set.expectedDeliveryAt = expectedDeliveryAt
        ? new Date(expectedDeliveryAt)
        : null;

    await db
      .update(deliveryGroup)
      .set(set)
      .where(eq(deliveryGroup.id, groupId));

    revalidatePath("/dashboard/delivery");
    revalidatePath("/employee/delivery");

    return { success: true };
  } catch (error) {
    console.error("Error assigning deliveryman:", error);
    return { success: false, error: "Failed to assign deliveryman" };
  }
}

export async function updateDeliverySequence(
  data: UpdateDeliverySequenceFormValues,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateDeliverySequenceSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { invoiceSequence } = validatedData.data;

    // Update each invoice's sequence
    for (const item of invoiceSequence) {
      await db
        .update(deliveryGroupInvoice)
        .set({ sequence: item.sequence })
        .where(eq(deliveryGroupInvoice.id, item.deliveryInvoiceId));
    }

    revalidatePath("/dashboard/delivery");
    revalidatePath("/employee/delivery");

    return { success: true };
  } catch (error) {
    console.error("Error updating delivery sequence:", error);
    return { success: false, error: "Failed to update sequence" };
  }
}

export async function getDeliveryGroups(options?: {
  status?: DeliveryGroupStatus;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", groups: [] };
    }

    const conditions = options?.status
      ? eq(deliveryGroup.status, options.status)
      : undefined;

    const groups = await db.query.deliveryGroup.findMany({
      where: conditions,
      with: {
        deliveryman: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
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
                order: true,
              },
            },
          },
          orderBy: [deliveryGroupInvoice.sequence],
        },
      },
      orderBy: [desc(deliveryGroup.createdAt)],
    });

    return { success: true, groups };
  } catch (error) {
    console.error("Error getting delivery groups:", error);
    return {
      success: false,
      error: "Failed to get delivery groups",
      groups: [],
    };
  }
}

export async function getDeliveryGroupById(groupId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const group = await db.query.deliveryGroup.findFirst({
      where: eq(deliveryGroup.id, groupId),
      with: {
        deliveryman: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
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
    });

    if (!group) {
      return { success: false, error: "Delivery group not found" };
    }

    // Check authorization - admin or assigned deliveryman
    const isAdmin = session.user.role === "admin";
    const isAssigned = group.deliverymanId === session.user.id;

    if (!isAdmin && !isAssigned) {
      return { success: false, error: "Not authorized" };
    }

    return { success: true, group };
  } catch (error) {
    console.error("Error getting delivery group:", error);
    return { success: false, error: "Failed to get delivery group" };
  }
}

export async function getDeliverymen() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", deliverymen: [] };
    }

    // Get deliverymen who already have active groups
    const busyDeliverymen = await getDeliverymenWithActiveGroups();

    // Fetch all deliverymen, mark those with active groups
    const allDeliverymen = await db.query.user.findMany({
      where: eq(user.role, "deliveryman"),
      columns: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      },
    });

    // Add hasActiveGroup flag to each deliveryman
    const deliverymen = allDeliverymen.map((dm) => ({
      ...dm,
      hasActiveGroup: busyDeliverymen.includes(dm.id),
    }));

    return { success: true, deliverymen };
  } catch (error) {
    console.error("Error getting deliverymen:", error);
    return {
      success: false,
      error: "Failed to get deliverymen",
      deliverymen: [],
    };
  }
}

/**
 * Deliverymen for invoice assignment, optionally filtered by area (order's shippingArea).
 * Area-based: only returns deliverymen whose serviceArea includes the given area,
 * or who have no serviceArea set (serve all areas).
 * Use when assigning a deliveryman to an invoice to suggest by area.
 */
export async function getDeliverymenForAssignment(
  orderShippingArea?: string | null,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", deliverymen: [] };
    }

    // Get deliverymen who already have active groups
    const busyDeliverymen = await getDeliverymenWithActiveGroups();

    const area = orderShippingArea?.trim();

    // Build conditions: role + area filter + exclude busy deliverymen
    const conditions = [eq(user.role, "deliveryman")];

    if (area && area.length > 0) {
      conditions.push(
        or(
          sql`${user.serviceArea} IS NULL`,
          ilike(user.serviceArea, `%${area}%`),
        )!,
      );
    }

    const where = and(...conditions);

    const allDeliverymen = await db.query.user.findMany({
      where,
      columns: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        serviceArea: true,
      },
    });

    // Add hasActiveGroup flag to each deliveryman
    const deliverymen = allDeliverymen.map((dm) => ({
      ...dm,
      hasActiveGroup: busyDeliverymen.includes(dm.id),
    }));

    return { success: true, deliverymen };
  } catch (error) {
    console.error("Error getting deliverymen for assignment:", error);
    return {
      success: false,
      error: "Failed to load deliverymen",
      deliverymen: [],
    };
  }
}

/**
 * Deliverymen for delivery group assignment, filtered by the first selected invoice's order shipping_area.
 * Use in Create Delivery Group when invoiceIds are known.
 */
export async function getDeliverymenForAssignmentByInvoiceIds(
  invoiceIds: number[],
) {
  let area: string | null = null;
  if (invoiceIds.length > 0) {
    const firstInvoice = await db.query.invoice.findFirst({
      where: eq(invoice.id, invoiceIds[0]),
      with: {
        order: {
          columns: { shippingArea: true },
        },
      },
    });
    area = firstInvoice?.order?.shippingArea ?? null;
  }
  return getDeliverymenForAssignment(area);
}

export async function deleteDeliveryGroup(groupId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const group = await db.query.deliveryGroup.findFirst({
      where: eq(deliveryGroup.id, groupId),
    });

    if (!group) {
      return { success: false, error: "Delivery group not found" };
    }

    // Cannot delete completed groups
    if (group.status === "completed") {
      return {
        success: false,
        error: "Cannot delete completed delivery groups",
      };
    }

    await db.delete(deliveryGroup).where(eq(deliveryGroup.id, groupId));

    revalidatePath("/dashboard/delivery");

    return { success: true };
  } catch (error) {
    console.error("Error deleting delivery group:", error);
    return { success: false, error: "Failed to delete delivery group" };
  }
}
