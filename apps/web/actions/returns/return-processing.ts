"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { order } from "@/db/schema/order";
import {
  type NewOrderReturn,
  orderReturn,
  type ReturnItem,
  type ReturnStatus,
} from "@/db/schema/order-return";
import { product } from "@/db/schema/product";
import { auth } from "@/lib/auth";
import {
  type ProcessReturnFormValues,
  processReturnSchema,
  type ReturnProcessingFormValues,
  returnProcessingFormSchema,
} from "@/schema/return.schema";

// Get order details for return processing page
export async function getOrderForReturn(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const isEmployee =
      session.user.role === "admin" ||
      session.user.role === "deliveryman" ||
      session.user.role === "salesman";

    if (!isEmployee) {
      return { success: false, error: "Not authorized" };
    }

    // Get order with full details
    const orderData = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            shopName: true,
          },
        },
      },
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    // Get all existing returns for this order (processed/approved only, not rejected)
    const existingReturns = await db.query.orderReturn.findMany({
      where: and(
        eq(orderReturn.orderId, orderId),
        sql`${orderReturn.status} IN ('pending', 'approved', 'processed')`,
      ),
      columns: {
        id: true,
        status: true,
        items: true,
      },
    });

    // Calculate already returned quantities per order item
    const returnedQuantities: Record<number, number> = {};

    for (const ret of existingReturns) {
      if (ret.items && Array.isArray(ret.items)) {
        for (const item of ret.items as ReturnItem[]) {
          if (!returnedQuantities[item.orderItemId]) {
            returnedQuantities[item.orderItemId] = 0;
          }
          returnedQuantities[item.orderItemId] += item.quantity;
        }
      }
    }

    // Enhance order items with returned quantities
    const itemsWithReturnInfo = orderData.items.map((item) => ({
      ...item,
      returnedQty: returnedQuantities[item.id] || 0,
      availableToReturn: item.quantity - (returnedQuantities[item.id] || 0),
    }));

    return {
      success: true,
      order: {
        ...orderData,
        items: itemsWithReturnInfo,
      },
      hasExistingReturns: existingReturns.length > 0,
      existingReturnCount: existingReturns.length,
    };
  } catch (error) {
    console.error("Error getting order for return:", error);
    return { success: false, error: "Failed to get order" };
  }
}

// Submit return from return processing form
export async function submitReturnProcessing(data: ReturnProcessingFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = returnProcessingFormSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const {
      orderId,
      returnedItems,
      refundType,
      additionalCharge,
      notes,
      attachments,
      isDraft,
    } = validatedData.data;

    // Get order
    const orderData = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: { items: true, user: true },
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    // Check for existing pending return
    const existingReturn = await db.query.orderReturn.findFirst({
      where: and(
        eq(orderReturn.orderId, orderId),
        eq(orderReturn.status, "pending"),
      ),
    });

    if (existingReturn) {
      return {
        success: false,
        error: "A return request already exists for this order",
      };
    }

    // Calculate total return amount
    const totalReturnAmount = returnedItems.reduce((sum, item) => {
      return sum + item.returnQty * Number(item.unitPrice);
    }, 0);

    const additionalChargeNum = Number(additionalCharge) || 0;
    const payableAmount = totalReturnAmount - additionalChargeNum;

    // Convert returned items to ReturnItem format
    const returnItems: ReturnItem[] = returnedItems.map((item) => ({
      orderItemId: item.orderItemId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.returnQty,
      unitPrice: item.unitPrice,
      reason: item.reason,
      attachment: item.attachment,
    }));

    // Build reason string from items
    const reasonsSummary = returnedItems
      .map((item) => `${item.productName}: ${item.reason.replace("_", " ")}`)
      .join("; ");

    // Create return request
    const [newReturn] = await db
      .insert(orderReturn)
      .values({
        orderId,
        userId: orderData.userId,
        submittedBy: session.user.id, // Track who submitted the return (deliveryman)
        reason: reasonsSummary,
        returnType: "partial",
        items: returnItems,
        totalAmount: payableAmount.toString(),
        refundType: refundType,
        status: isDraft ? "pending" : "pending",
        notes: notes || null,
        attachments: attachments && attachments.length > 0 ? attachments : null,
      } as NewOrderReturn)
      .returning();

    revalidatePath("/dashboard/delivery/returns");
    revalidatePath("/dashboard/admin/returns");
    revalidatePath("/orders");

    return { success: true, return: newReturn };
  } catch (error) {
    console.error("Error submitting return:", error);
    return { success: false, error: "Failed to submit return" };
  }
}
export async function processReturn(data: ProcessReturnFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = processReturnSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { returnId, action, refundType, adminNotes, restockItems } =
      validatedData.data;

    // Get return request
    const returnData = await db.query.orderReturn.findFirst({
      where: eq(orderReturn.id, returnId),
      with: { order: { with: { items: true } } },
    });

    if (!returnData) {
      return { success: false, error: "Return request not found" };
    }

    if (returnData.status !== "pending") {
      return { success: false, error: "Return has already been processed" };
    }

    const updateData: Record<string, unknown> = {
      processedBy: session.user.id,
      processedAt: new Date(),
    };

    if (action === "approve") {
      updateData.status = "processed";

      if (!refundType) {
        return {
          success: false,
          error: "Refund type is required for approval",
        };
      }
      updateData.refundType = refundType;

      // Restock items if requested
      if (restockItems) {
        if (returnData.returnType === "full") {
          // Restock all items from order
          for (const item of returnData.order.items) {
            await db
              .update(product)
              .set({
                stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
              })
              .where(eq(product.id, item.productId));
          }
          updateData.restocked = returnData.order.items.length;
        } else if (returnData.items) {
          // Restock only returned items
          for (const item of returnData.items) {
            await db
              .update(product)
              .set({
                stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
              })
              .where(eq(product.id, item.productId));
          }
          updateData.restocked = returnData.items.length;
        }
      }

      // Update payment status on order
      await db
        .update(order)
        .set({ paymentStatus: "refunded" })
        .where(eq(order.id, returnData.orderId));
    } else {
      updateData.status = "rejected";
    }

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    await db
      .update(orderReturn)
      .set(updateData)
      .where(eq(orderReturn.id, returnId));

    revalidatePath("/employee/returns");
    revalidatePath("/dashboard/returns");
    revalidatePath("/dashboard/admin/returns");
    revalidatePath("/dashboard/orders");

    return { success: true };
  } catch (error) {
    console.error("Error processing return:", error);
    return { success: false, error: "Failed to process return" };
  }
}

export async function getReturns(options?: {
  status?: ReturnStatus;
  isAdmin?: boolean;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", returns: [] };
    }

    const isAdmin = session.user.role === "admin";
    const isEmployee =
      session.user.role === "deliveryman" || session.user.role === "salesman";

    // Build conditions
    const conditions = [];

    if (options?.status) {
      conditions.push(eq(orderReturn.status, options.status));
    }

    if (!isAdmin && !isEmployee) {
      conditions.push(eq(orderReturn.userId, session.user.id));
    }

    const returns = await db.query.orderReturn.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        order: {
          columns: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        submitter: {
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
        processor: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(orderReturn.createdAt)],
    });

    return { success: true, returns };
  } catch (error) {
    console.error("Error getting returns:", error);
    return { success: false, error: "Failed to get returns", returns: [] };
  }
}

export async function getReturnById(returnId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const isStaff =
      session.user.role === "admin" ||
      session.user.role === "deliveryman" ||
      session.user.role === "salesman";

    const returnData = await db.query.orderReturn.findFirst({
      where: eq(orderReturn.id, returnId),
      with: {
        order: {
          with: {
            items: true,
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                shopName: true,
              },
            },
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        processor: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!returnData) {
      return { success: false, error: "Return not found" };
    }

    if (!isStaff && returnData.userId !== session.user.id) {
      return { success: false, error: "Return not found" };
    }

    return { success: true, return: returnData };
  } catch (error) {
    console.error("Error getting return:", error);
    return { success: false, error: "Failed to get return" };
  }
}

export async function getReturnStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const returns = await db.query.orderReturn.findMany({
      columns: {
        status: true,
        totalAmount: true,
        refundType: true,
      },
    });

    const stats = {
      total: returns.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      processed: 0,
      totalRefunded: 0,
      byRefundType: {
        cash: 0,
        wallet: 0,
        adjustment: 0,
      } as Record<string, number>,
    };

    for (const ret of returns) {
      stats[ret.status as keyof typeof stats]++;

      if (ret.status === "processed") {
        stats.totalRefunded += Number(ret.totalAmount);
        if (ret.refundType) {
          stats.byRefundType[ret.refundType]++;
        }
      }
    }

    return { success: true, stats };
  } catch (error) {
    console.error("Error getting return stats:", error);
    return { success: false, error: "Failed to get stats" };
  }
}
