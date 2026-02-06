"use server";

import { and, count, desc, eq, gte, lte, ne, sql, sum } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import {
  type InvoiceDeliveryStatus,
  type InvoicePaymentStatus,
  type InvoiceVehicleType,
  invoice,
  invoiceItem,
  type NewInvoice,
  type NewInvoiceItem,
} from "@/db/schema/invoice";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";

/**
 * Generate a unique invoice number
 * Format: INV-YYYY-XXXX (e.g., INV-2025-0001)
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Get the latest invoice number for this year
  const latestInvoice = await db.query.invoice.findFirst({
    where: sql`${invoice.invoiceNumber} LIKE ${prefix + "%"}`,
    orderBy: [desc(invoice.invoiceNumber)],
  });

  let sequence = 1;
  if (latestInvoice) {
    const lastSequence = Number.parseInt(
      latestInvoice.invoiceNumber.split("-")[2],
      10,
    );
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

/**
 * Generate invoice from an order (called when order is confirmed)
 */
export async function generateInvoiceFromOrder(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Check if invoice already exists for this order
    const existingInvoice = await db.query.invoice.findFirst({
      where: and(eq(invoice.orderId, orderId), eq(invoice.invoiceType, "main")),
    });

    if (existingInvoice) {
      return { success: false, error: "Invoice already exists for this order" };
    }

    // Get order with items
    const orderData = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
      },
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice
    const [newInvoice] = await db
      .insert(invoice)
      .values({
        invoiceNumber,
        orderId: orderData.id,
        customerId: orderData.userId,
        invoiceType: "main",
        paymentStatus: "unpaid",
        deliveryStatus: "not_assigned",
        subtotal: orderData.subtotal,
        discountAmount: orderData.discount,
        deliveryCharge: orderData.shippingCost,
        taxAmount: "0",
        grandTotal: orderData.total,
        customerNotes: orderData.customerNote,
      } satisfies NewInvoice)
      .returning();

    // Create invoice items from order items
    if (orderData.items.length > 0) {
      await db.insert(invoiceItem).values(
        orderData.items.map(
          (item) =>
            ({
              invoiceId: newInvoice.id,
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSize, // Using productSize as SKU for now
              productImage: item.productImage,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.totalPrice,
            }) satisfies NewInvoiceItem,
        ),
      );
    }

    revalidatePath("/dashboard/admin/invoices");
    revalidatePath("/dashboard/admin/orders");

    return { success: true, invoice: newInvoice };
  } catch (error) {
    console.error("Error generating invoice:", error);
    return { success: false, error: "Failed to generate invoice" };
  }
}

/**
 * Get all invoices with filters (Admin)
 */
export async function getAllInvoices(options?: {
  paymentStatus?: InvoicePaymentStatus;
  deliveryStatus?: InvoiceDeliveryStatus;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", invoices: [] };
    }

    const conditions = [];

    if (options?.deliveryStatus) {
      conditions.push(eq(invoice.deliveryStatus, options.deliveryStatus));
    }

    if (options?.paymentStatus) {
      conditions.push(eq(invoice.paymentStatus, options.paymentStatus));
    }

    if (options?.deliveryStatus) {
      conditions.push(eq(invoice.deliveryStatus, options.deliveryStatus));
    }

    if (options?.startDate) {
      conditions.push(gte(invoice.createdAt, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(invoice.createdAt, options.endDate));
    }

    const invoices = await db.query.invoice.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        items: true,
        order: {
          columns: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
        customer: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            shopName: true,
            ownerName: true,
          },
        },
        deliveryman: {
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: [desc(invoice.createdAt)],
    });

    return { success: true, invoices };
  } catch (error) {
    console.error("Error getting invoices:", error);
    return { success: false, error: "Failed to get invoices", invoices: [] };
  }
}

/**
 * Get invoice by ID (Admin)
 */
export async function getInvoiceById(invoiceId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const invoiceData = await db.query.invoice.findFirst({
      where: eq(invoice.id, invoiceId),
      with: {
        items: true,
        order: {
          columns: {
            id: true,
            orderNumber: true,
            status: true,
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
            email: true,
            phoneNumber: true,
            shopName: true,
            ownerName: true,
          },
        },
        deliveryman: {
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        splitInvoices: {
          with: {
            items: true,
          },
        },
        parentInvoice: true,
      },
    });

    if (!invoiceData) {
      return { success: false, error: "Invoice not found" };
    }

    return { success: true, invoice: invoiceData };
  } catch (error) {
    console.error("Error getting invoice:", error);
    return { success: false, error: "Failed to get invoice" };
  }
}

/**
 * Update invoice delivery status (Admin)
 * Note: This is typically automated via delivery group status changes
 */
export async function updateInvoiceDeliveryStatus(
  invoiceId: number,
  deliveryStatus: InvoiceDeliveryStatus,
  adminNotes?: string,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const updateData: Record<string, unknown> = { deliveryStatus };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    if (deliveryStatus === "delivered") {
      updateData.deliveredAt = new Date();
    }

    await db.update(invoice).set(updateData).where(eq(invoice.id, invoiceId));

    revalidatePath("/dashboard/admin/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error updating invoice status:", error);
    return { success: false, error: "Failed to update invoice status" };
  }
}

/**
 * Update invoice payment status (Admin)
 */
export async function updateInvoicePaymentStatus(
  invoiceId: number,
  paymentStatus: InvoicePaymentStatus,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    await db
      .update(invoice)
      .set({ paymentStatus })
      .where(eq(invoice.id, invoiceId));

    revalidatePath("/dashboard/admin/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error updating payment status:", error);
    return { success: false, error: "Failed to update payment status" };
  }
}

/**
 * Check if a deliveryman has an active unpaid (COD) invoice.
 * Enforces: one deliveryman can hold only one active unpaid invoice at a time;
 * until COD is settled (collected/settled), no new invoice is assignable.
 * Active = assigned to them (deliverymanId) and paymentStatus=unpaid.
 *
 * @param excludeInvoiceId - When reassigning the same invoice, exclude it from the check.
 */
async function hasActiveUnpaidInvoice(
  deliverymanId: string,
  excludeInvoiceId?: number,
): Promise<boolean> {
  const conditions = [
    eq(invoice.deliverymanId, deliverymanId),
    eq(invoice.paymentStatus, "unpaid"),
  ];
  if (excludeInvoiceId != null) {
    conditions.push(ne(invoice.id, excludeInvoiceId));
  }
  const found = await db.query.invoice.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });
  return !!found;
}

const ACTIVE_UNPAID_BLOCK_MESSAGE =
  "This deliveryman already has an active unpaid COD invoice. Settle it before assigning a new one.";

/**
 * Check if a deliveryman can be assigned to an (other) invoice.
 * Use in UIs to disable or warn before assigning.
 * Enforces: one deliveryman = one active unpaid; until COD settled, no new assignable.
 *
 * @param deliverymanId - Deliveryman to check
 * @param excludeInvoiceId - When reassigning the same invoice, exclude it
 */
export async function checkDeliverymanAvailableForInvoice(
  deliverymanId: string,
  excludeInvoiceId?: number,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id || session.user.role !== "admin") {
      return { available: false, error: "Unauthorized" };
    }
    const blocked = await hasActiveUnpaidInvoice(
      deliverymanId,
      excludeInvoiceId,
    );
    return {
      available: !blocked,
      error: blocked ? ACTIVE_UNPAID_BLOCK_MESSAGE : undefined,
    };
  } catch {
    return { available: false, error: "Failed to check" };
  }
}

/**
 * Assign deliveryman to invoice (Admin)
 * Enforces: one deliveryman can hold only one active unpaid invoice until COD is settled.
 * Vehicle can be assigned by type; optional expected delivery date.
 */
export async function assignDeliverymanToInvoice(
  invoiceId: number,
  deliverymanId: string,
  opts?: {
    vehicleInfo?: string;
    vehicleType?: InvoiceVehicleType;
    expectedDeliveryAt?: Date | null;
  },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const blocked = await hasActiveUnpaidInvoice(deliverymanId, invoiceId);
    if (blocked) {
      return { success: false, error: ACTIVE_UNPAID_BLOCK_MESSAGE };
    }

    const set: Record<string, unknown> = {
      deliverymanId,
      vehicleInfo: opts?.vehicleInfo,
      deliveryStatus: "out_for_delivery",
    };
    if (opts?.vehicleType !== undefined) set.vehicleType = opts.vehicleType;
    if (opts?.expectedDeliveryAt !== undefined)
      set.expectedDeliveryAt = opts.expectedDeliveryAt;

    await db.update(invoice).set(set).where(eq(invoice.id, invoiceId));

    revalidatePath("/dashboard/admin/invoices");

    return { success: true };
  } catch (error) {
    console.error("Error assigning deliveryman:", error);
    return { success: false, error: "Failed to assign deliveryman" };
  }
}

/**
 * Create split invoice from existing invoice (Admin)
 */
export async function createSplitInvoice(
  parentInvoiceId: number,
  items: { productId: number; quantity: number }[],
  deliveryInfo?: {
    deliverymanId?: string;
    vehicleInfo?: string;
    vehicleType?: InvoiceVehicleType;
    expectedDeliveryAt?: Date | null;
  },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Get parent invoice
    const parentInvoice = await db.query.invoice.findFirst({
      where: eq(invoice.id, parentInvoiceId),
      with: {
        items: true,
      },
    });

    if (!parentInvoice) {
      return { success: false, error: "Parent invoice not found" };
    }

    if (parentInvoice.invoiceType !== "main") {
      return { success: false, error: "Can only split main invoices" };
    }

    if (deliveryInfo?.deliverymanId) {
      const blocked = await hasActiveUnpaidInvoice(deliveryInfo.deliverymanId);
      if (blocked) {
        return { success: false, error: ACTIVE_UNPAID_BLOCK_MESSAGE };
      }
    }

    // Get next split sequence
    const existingSplits = await db.query.invoice.findMany({
      where: eq(invoice.parentInvoiceId, parentInvoiceId),
    });
    const nextSequence = existingSplits.length + 1;

    // Calculate totals for split items
    let subtotal = 0;
    const splitItems: NewInvoiceItem[] = [];

    for (const item of items) {
      const originalItem = parentInvoice.items.find(
        (i) => i.productId === item.productId,
      );
      if (!originalItem) continue;

      const unitPrice = Number.parseFloat(originalItem.unitPrice);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      splitItems.push({
        invoiceId: 0, // Will be set after invoice creation
        productId: item.productId,
        productName: originalItem.productName,
        productSku: originalItem.productSku,
        productImage: originalItem.productImage,
        quantity: item.quantity,
        unitPrice: originalItem.unitPrice,
        lineTotal: lineTotal.toFixed(2),
      });
    }

    // Generate split invoice number
    const splitInvoiceNumber = `${parentInvoice.invoiceNumber}-${nextSequence}`;

    // Create split invoice
    const [newSplitInvoice] = await db
      .insert(invoice)
      .values({
        invoiceNumber: splitInvoiceNumber,
        orderId: parentInvoice.orderId,
        customerId: parentInvoice.customerId,
        parentInvoiceId: parentInvoiceId,
        splitSequence: nextSequence,
        invoiceType: "split",
        paymentStatus: "unpaid",
        deliveryStatus: deliveryInfo?.deliverymanId
          ? "pending"
          : "not_assigned",
        deliverymanId: deliveryInfo?.deliverymanId,
        vehicleType: deliveryInfo?.vehicleType,
        vehicleInfo: deliveryInfo?.vehicleInfo,
        expectedDeliveryAt: deliveryInfo?.expectedDeliveryAt ?? undefined,
        subtotal: subtotal.toFixed(2),
        discountAmount: "0",
        deliveryCharge: "0",
        taxAmount: "0",
        grandTotal: subtotal.toFixed(2),
      })
      .returning();

    // Insert split items with correct invoice ID
    if (splitItems.length > 0) {
      await db.insert(invoiceItem).values(
        splitItems.map((item) => ({
          ...item,
          invoiceId: newSplitInvoice.id,
        })),
      );
    }

    revalidatePath("/dashboard/admin/invoices");

    return { success: true, invoice: newSplitInvoice };
  } catch (error) {
    console.error("Error creating split invoice:", error);
    return { success: false, error: "Failed to create split invoice" };
  }
}

/**
 * Create partial invoice (Admin) - Simplified wrapper for createSplitInvoice
 * This allows sending partial quantities of an order in multiple deliveries
 */
export async function createPartialInvoice(
  parentInvoiceId: number,
  items: { productId: number; quantity: number }[],
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate quantities against remaining items
    const parentInvoice = await db.query.invoice.findFirst({
      where: eq(invoice.id, parentInvoiceId),
      with: {
        items: true,
        splitInvoices: {
          with: {
            items: true,
          },
        },
      },
    });

    if (!parentInvoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (parentInvoice.invoiceType !== "main") {
      return {
        success: false,
        error: "Can only create partial invoices from main invoices",
      };
    }

    // Calculate already delivered quantities
    const deliveredQuantities = parentInvoice.splitInvoices.reduce(
      (acc, splitInv) => {
        splitInv.items.forEach((item) => {
          acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
        });
        return acc;
      },
      {} as Record<number, number>,
    );

    // Validate requested quantities
    for (const item of items) {
      const originalItem = parentInvoice.items.find(
        (i) => i.productId === item.productId,
      );
      if (!originalItem) {
        return {
          success: false,
          error: `Product ID ${item.productId} not found in original invoice`,
        };
      }

      const delivered = deliveredQuantities[item.productId] || 0;
      const remaining = originalItem.quantity - delivered;

      if (item.quantity > remaining) {
        return {
          success: false,
          error: `Requested quantity (${item.quantity}) exceeds remaining quantity (${remaining}) for ${originalItem.productName}`,
        };
      }
    }

    // Use the existing createSplitInvoice function
    return await createSplitInvoice(parentInvoiceId, items);
  } catch (error) {
    console.error("Error creating partial invoice:", error);
    return { success: false, error: "Failed to create partial invoice" };
  }
}

/**
 * Get invoice statistics (Admin Dashboard)
 */
export async function getInvoiceStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Get counts by delivery status
    const statusCounts = await db
      .select({
        status: invoice.deliveryStatus,
        count: count(),
      })
      .from(invoice)
      .groupBy(invoice.deliveryStatus);

    // Get counts by payment status
    const paymentCounts = await db
      .select({
        paymentStatus: invoice.paymentStatus,
        count: count(),
      })
      .from(invoice)
      .groupBy(invoice.paymentStatus);

    // Get total revenue (from delivered & paid invoices)
    const revenueResult = await db
      .select({
        totalRevenue: sum(invoice.grandTotal),
      })
      .from(invoice)
      .where(
        and(
          eq(invoice.deliveryStatus, "delivered"),
          eq(invoice.paymentStatus, "collected"),
        ),
      );

    // Get today's invoices count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayInvoices = await db
      .select({
        count: count(),
      })
      .from(invoice)
      .where(gte(invoice.createdAt, today));

    return {
      success: true,
      stats: {
        byStatus: statusCounts.reduce(
          (acc, curr) => {
            acc[curr.status] = curr.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        byPayment: paymentCounts.reduce(
          (acc, curr) => {
            acc[curr.paymentStatus] = curr.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        totalRevenue: revenueResult[0]?.totalRevenue || "0",
        todayCount: todayInvoices[0]?.count || 0,
      },
    };
  } catch (error) {
    console.error("Error getting invoice stats:", error);
    return { success: false, error: "Failed to get invoice stats" };
  }
}

/**
 * Get invoices for a specific order (Customer or Admin)
 */
export async function getInvoicesByOrderId(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", invoices: [] };
    }

    // Verify order belongs to customer (unless admin)
    if (session.user.role !== "admin") {
      const orderData = await db.query.order.findFirst({
        where: eq(order.id, orderId),
        columns: { userId: true },
      });

      if (!orderData || orderData.userId !== session.user.id) {
        return { success: false, error: "Not authorized", invoices: [] };
      }
    }

    const invoices = await db.query.invoice.findMany({
      where: eq(invoice.orderId, orderId),
      with: {
        items: true,
      },
      orderBy: [desc(invoice.createdAt)],
    });

    return { success: true, invoices };
  } catch (error) {
    console.error("Error getting invoices by order:", error);
    return { success: false, error: "Failed to get invoices", invoices: [] };
  }
}
