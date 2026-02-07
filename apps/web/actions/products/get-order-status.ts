"use server";

import { and, eq } from "drizzle-orm";
import { checkAuth } from "@/utils/auth";
import { db } from "@/db/config";
import { type Order, order } from "@/db/schema";
import { type Payment, payment } from "@/db/schema/payment";

export type OrderStatusResponse =
  | {
      success: true;
      order: Order;
      payment: Payment | null;
    }
  | {
      success: false;
      error: string;
    };

export async function getOrderStatus(
  orderId: number,
): Promise<OrderStatusResponse> {
  try {
    const session = await checkAuth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const [orderData] = await db
      .select()
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.userId, session.user.id)))
      .limit(1);

    if (!orderData) {
      return {
        success: false,
        error: "Order not found",
      };
    }

    const [paymentData] = await db
      .select()
      .from(payment)
      .where(eq(payment.orderId, orderId))
      .limit(1);

    return {
      success: true,
      order: orderData,
      payment: paymentData || null,
    };
  } catch (error) {
    console.error("Error fetching order:", error);
    return {
      success: false,
      error: "Failed to fetch order status",
    };
  }
}
