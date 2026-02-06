"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { customerAssignment } from "@/db/schema/customer-assignment";
import { order } from "@/db/schema/order";
import { auth } from "@/lib/auth";

/**
 * Upcoming orders for the salesman: orders from their assigned customers
 * with status confirmed or processing (not yet delivered).
 */
export async function getUpcomingOrdersForSalesman(limit?: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", orders: [] };
    }

    if (session.user.role !== "salesman") {
      return { success: false, error: "Forbidden", orders: [] };
    }

    const assignments = await db
      .select({ customerId: customerAssignment.customerId })
      .from(customerAssignment)
      .where(eq(customerAssignment.salesmanId, session.user.id));

    const customerIds = assignments.map((a) => a.customerId);
    if (customerIds.length === 0) {
      return { success: true, orders: [] };
    }

    const conditions = [
      inArray(order.status, ["confirmed", "processing"]),
      inArray(order.userId, customerIds),
    ];

    const ordersList = await db.query.order.findMany({
      where: and(...conditions),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            shopName: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: [desc(order.createdAt)],
      limit: limit ?? 50,
    });

    return { success: true, orders: ordersList };
  } catch (error) {
    console.error("Error getting upcoming orders for salesman:", error);
    return { success: false, error: "Failed to load orders", orders: [] };
  }
}
