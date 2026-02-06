"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/config";
import { order, orderItem } from "@/db/schema/order";

/**
 * Updates all pending orders that contain the specified product
 * when the product's price changes.
 *
 * This function:
 * 1. Finds all pending orders with items containing this product
 * 2. Updates the unitPrice and totalPrice for those items
 * 3. Recalculates the order subtotal and total
 *
 * @param productId - The ID of the product that was updated
 * @param newPrice - The new price of the product
 * @returns The number of orders that were updated
 */
export async function updatePendingOrdersForProduct(
  productId: number,
  newPrice: string,
): Promise<{ updatedOrders: number }> {
  try {
    // Find all order items in pending orders that contain this product
    const pendingOrderItems = await db
      .select({
        orderItemId: orderItem.id,
        orderId: orderItem.orderId,
        quantity: orderItem.quantity,
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(
        and(eq(orderItem.productId, productId), eq(order.status, "pending")),
      );

    if (pendingOrderItems.length === 0) {
      return { updatedOrders: 0 };
    }

    const newPriceDecimal = parseFloat(newPrice);

    // Get unique order IDs
    const affectedOrderIds = [
      ...new Set(pendingOrderItems.map((item) => item.orderId)),
    ];

    // Update each order item with the new price
    for (const item of pendingOrderItems) {
      const newTotalPrice = (newPriceDecimal * item.quantity).toFixed(2);

      await db
        .update(orderItem)
        .set({
          unitPrice: newPrice,
          totalPrice: newTotalPrice,
        })
        .where(eq(orderItem.id, item.orderItemId));
    }

    // Recalculate subtotal and total for each affected order
    for (const orderId of affectedOrderIds) {
      // Get all items for this order to recalculate subtotal
      const orderItems = await db
        .select({
          totalPrice: orderItem.totalPrice,
        })
        .from(orderItem)
        .where(eq(orderItem.orderId, orderId));

      const newSubtotal = orderItems.reduce(
        (sum, item) => sum + parseFloat(item.totalPrice),
        0,
      );

      // Get the current order to maintain shipping/discount and track price change
      const [currentOrder] = await db
        .select({
          total: order.total,
          shippingCost: order.shippingCost,
          discount: order.discount,
        })
        .from(order)
        .where(eq(order.id, orderId));

      const shippingCost = parseFloat(currentOrder.shippingCost);
      const discount = parseFloat(currentOrder.discount);
      const newTotal = newSubtotal + shippingCost - discount;
      const previousTotal = currentOrder.total;
      const totalChanged =
        Math.abs(parseFloat(previousTotal) - newTotal) > 0.01;

      await db
        .update(order)
        .set({
          subtotal: newSubtotal.toFixed(2),
          total: newTotal.toFixed(2),
          ...(totalChanged && {
            previousTotal: previousTotal,
            totalPriceChangedAt: new Date(),
          }),
        })
        .where(eq(order.id, orderId));
    }

    return { updatedOrders: affectedOrderIds.length };
  } catch (error) {
    console.error("Error updating pending orders for product:", error);
    throw error;
  }
}
