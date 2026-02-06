"use server";

import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  lte,
  sql,
  sum,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import {
  type OrderStatus,
  order,
  orderItem,
  type PaymentStatus,
} from "@/db/schema/order";
import { product } from "@/db/schema/product";
import { auth } from "@/lib/auth";

export async function getOrdersWithPriceChange() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", orders: [] };
    }
    const orders = await db.query.order.findMany({
      where: and(eq(order.status, "pending"), isNotNull(order.previousTotal)),
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
      orderBy: [desc(order.totalPriceChangedAt)],
    });
    return { success: true, orders };
  } catch (error) {
    console.error("Error getting price-changed orders:", error);
    return { success: false, error: "Failed to load", orders: [] };
  }
}

export async function getAllOrders(options?: {
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", orders: [] };
    }

    const conditions = [];

    if (options?.status) {
      conditions.push(eq(order.status, options.status));
    }

    if (options?.startDate) {
      conditions.push(gte(order.createdAt, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(order.createdAt, options.endDate));
    }

    const orders = await db.query.order.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
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
      orderBy: [desc(order.createdAt)],
    });

    return { success: true, orders };
  } catch (error) {
    console.error("Error getting all orders:", error);
    return { success: false, error: "Failed to get orders", orders: [] };
  }
}

export async function getOrderById(orderId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Only check for authentication - role is verified in layout
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

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
            ownerName: true,
          },
        },
      },
    });

    if (!orderData) {
      return { success: false, error: "Order not found" };
    }

    return { success: true, order: orderData };
  } catch (error) {
    console.error("Error getting order:", error);
    return { success: false, error: "Failed to get order" };
  }
}

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  adminNote?: string,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const existingOrder = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
      },
    });

    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status,
    };

    if (adminNote) {
      updateData.adminNote = adminNote;
    }

    // Set timestamp based on status
    switch (status) {
      case "confirmed":
        updateData.confirmedAt = new Date();
        updateData.confirmedSubtotal = existingOrder.subtotal;
        updateData.confirmedTotal = existingOrder.total;
        break;
      case "delivered":
        updateData.deliveredAt = new Date();
        break;
      case "cancelled":
        updateData.cancelledAt = new Date();
        // Restore stock when admin cancels
        if (existingOrder.status !== "cancelled") {
          await db.transaction(async (tx) => {
            for (const item of existingOrder.items) {
              await tx
                .update(product)
                .set({
                  stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
                })
                .where(eq(product.id, item.productId));
            }
          });
        }
        break;
    }

    await db.update(order).set(updateData).where(eq(order.id, orderId));

    // Auto-generate invoice when order is confirmed
    if (status === "confirmed") {
      const { generateInvoiceFromOrder } = await import(
        "@/actions/invoice/invoice-actions"
      );
      await generateInvoiceFromOrder(orderId);
    }

    revalidatePath("/dashboard/orders");
    revalidatePath("/orders");

    return { success: true };
  } catch (error) {
    console.error("Error updating order status:", error);
    return { success: false, error: "Failed to update order status" };
  }
}

export async function updatePaymentStatus(
  orderId: number,
  paymentStatus: PaymentStatus,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    await db.update(order).set({ paymentStatus }).where(eq(order.id, orderId));

    revalidatePath("/dashboard/orders");
    revalidatePath("/orders");

    return { success: true };
  } catch (error) {
    console.error("Error updating payment status:", error);
    return { success: false, error: "Failed to update payment status" };
  }
}

export async function getOrderStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Get total orders by status
    const ordersByStatus = await db
      .select({
        status: order.status,
        count: count(),
      })
      .from(order)
      .groupBy(order.status);

    // Get total revenue
    const revenueResult = await db
      .select({
        totalRevenue: sum(order.total),
      })
      .from(order)
      .where(eq(order.status, "delivered"));

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await db
      .select({
        count: count(),
      })
      .from(order)
      .where(gte(order.createdAt, today));

    // Get pending orders count
    const pendingOrders = await db
      .select({
        count: count(),
      })
      .from(order)
      .where(eq(order.status, "pending"));

    return {
      success: true,
      stats: {
        ordersByStatus: ordersByStatus.reduce(
          (
            acc: Record<string, number>,
            curr: { status: string; count: number },
          ) => {
            acc[curr.status] = curr.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        totalRevenue: revenueResult[0]?.totalRevenue || "0",
        todayOrdersCount: todayOrders[0]?.count || 0,
        pendingOrdersCount: pendingOrders[0]?.count || 0,
      },
    };
  } catch (error) {
    console.error("Error getting order stats:", error);
    return { success: false, error: "Failed to get order stats" };
  }
}

export async function addAdminNote(orderId: number, note: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    await db
      .update(order)
      .set({ adminNote: note })
      .where(eq(order.id, orderId));

    revalidatePath("/dashboard/orders");

    return { success: true };
  } catch (error) {
    console.error("Error adding admin note:", error);
    return { success: false, error: "Failed to add note" };
  }
}

export async function approveOrder(orderId: number, adminNote?: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const existingOrder = await db.query.order.findFirst({
      where: eq(order.id, orderId),
    });

    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }

    if (existingOrder.status !== "pending") {
      return { success: false, error: "Only pending orders can be approved" };
    }

    // Update order status to confirmed
    await db
      .update(order)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        ...(adminNote && { adminNote }),
      })
      .where(eq(order.id, orderId));

    // Auto-generate invoice when order is confirmed
    const { generateInvoiceFromOrder } = await import(
      "@/actions/invoice/invoice-actions"
    );
    await generateInvoiceFromOrder(orderId);

    revalidatePath("/dashboard/admin/orders");
    revalidatePath(`/dashboard/admin/orders/${orderId}`);

    return { success: true };
  } catch (error) {
    console.error("Error approving order:", error);
    return { success: false, error: "Failed to approve order" };
  }
}

export async function rejectOrder(orderId: number, rejectionReason: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const existingOrder = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
      },
    });

    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }

    if (existingOrder.status !== "pending") {
      return { success: false, error: "Only pending orders can be rejected" };
    }

    // Update order status to cancelled with rejection reason
    await db
      .update(order)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        adminNote: rejectionReason,
      })
      .where(eq(order.id, orderId));

    // Restore stock when order is rejected
    await db.transaction(async (tx) => {
      for (const item of existingOrder.items) {
        await tx
          .update(product)
          .set({
            stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
          })
          .where(eq(product.id, item.productId));
      }
    });

    revalidatePath("/dashboard/admin/orders");
    revalidatePath(`/dashboard/admin/orders/${orderId}`);

    return { success: true };
  } catch (error) {
    console.error("Error rejecting order:", error);
    return { success: false, error: "Failed to reject order" };
  }
}

// Types for order item updates
interface OrderItemUpdate {
  itemId?: number; // existing item ID (undefined = new item)
  productId: number;
  quantity: number;
  remove?: boolean; // true to remove this item
}

export async function updateOrderItems(
  orderId: number,
  itemUpdates: OrderItemUpdate[],
  adminNote?: string,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const existingOrder = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      with: {
        items: true,
      },
    });

    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }

    if (existingOrder.status !== "pending") {
      return { success: false, error: "Only pending orders can be edited" };
    }

    await db.transaction(async (tx) => {
      // Process each item update
      for (const update of itemUpdates) {
        if (update.itemId && update.remove) {
          // Remove existing item - restore stock
          const existingItem = existingOrder.items.find(
            (i) => i.id === update.itemId,
          );
          if (existingItem) {
            await tx
              .update(product)
              .set({
                stockQuantity: sql`${product.stockQuantity} + ${existingItem.quantity}`,
              })
              .where(eq(product.id, existingItem.productId));

            await tx.delete(orderItem).where(eq(orderItem.id, update.itemId));
          }
        } else if (update.itemId) {
          // Update existing item
          const existingItem = existingOrder.items.find(
            (i) => i.id === update.itemId,
          );
          if (existingItem) {
            const quantityDiff = update.quantity - existingItem.quantity;

            // Check stock if increasing quantity
            if (quantityDiff > 0) {
              const productData = await tx.query.product.findFirst({
                where: eq(product.id, update.productId),
              });
              if (!productData || productData.stockQuantity < quantityDiff) {
                throw new Error(
                  `Insufficient stock for product ${update.productId}`,
                );
              }
            }

            // Adjust stock (negative diff = restore, positive = deduct)
            await tx
              .update(product)
              .set({
                stockQuantity: sql`${product.stockQuantity} - ${quantityDiff}`,
              })
              .where(eq(product.id, existingItem.productId));

            // Get product for price info
            const productData = await tx.query.product.findFirst({
              where: eq(product.id, update.productId),
            });

            if (productData) {
              const unitPrice = Number(productData.price);
              const totalPrice = unitPrice * update.quantity;

              await tx
                .update(orderItem)
                .set({
                  quantity: update.quantity,
                  totalPrice: totalPrice.toFixed(2),
                })
                .where(eq(orderItem.id, update.itemId));
            }
          }
        } else {
          // Add new item
          const productData = await tx.query.product.findFirst({
            where: eq(product.id, update.productId),
          });

          if (!productData) {
            throw new Error(`Product ${update.productId} not found`);
          }

          if (productData.stockQuantity < update.quantity) {
            throw new Error(`Insufficient stock for ${productData.name}`);
          }

          // Deduct stock
          await tx
            .update(product)
            .set({
              stockQuantity: sql`${product.stockQuantity} - ${update.quantity}`,
            })
            .where(eq(product.id, update.productId));

          // Add new order item
          const unitPrice = Number(productData.price);
          const totalPrice = unitPrice * update.quantity;

          await tx.insert(orderItem).values({
            orderId,
            productId: update.productId,
            productName: productData.name,
            productImage: productData.image || "",
            productSize: productData.size || "N/A",
            quantity: update.quantity,
            unitPrice: unitPrice.toFixed(2),
            totalPrice: totalPrice.toFixed(2),
          });
        }
      }

      // Recalculate order totals
      const updatedItems = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, orderId),
      });

      const subtotal = updatedItems.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );
      const total =
        subtotal -
        Number(existingOrder.discount) +
        Number(existingOrder.shippingCost);

      const previousTotal = existingOrder.total;
      const totalChanged = Math.abs(Number(previousTotal) - total) > 0.01;

      await tx
        .update(order)
        .set({
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          adminModifiedAt: new Date(),
          ...(totalChanged && {
            previousTotal: previousTotal,
            totalPriceChangedAt: new Date(),
          }),
          ...(adminNote && { adminNote }),
        })
        .where(eq(order.id, orderId));
    });

    revalidatePath("/dashboard/admin/orders");
    revalidatePath("/dashboard/admin/orders/price-changes");
    revalidatePath(`/dashboard/admin/orders/${orderId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating order items:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update order items",
    };
  }
}
