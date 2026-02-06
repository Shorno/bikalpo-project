"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import {
  type DeliverymanStats,
  deliveryGroup,
  deliveryGroupInvoice,
} from "@/db/schema/delivery";
import { estimate, type SalesmanStats } from "@/db/schema/estimate";
import { orderReturn } from "@/db/schema/order-return";
import { auth } from "@/lib/auth";

// Union type for employee stats
export type EmployeeStats = SalesmanStats | DeliverymanStats;

// Action response types
export type EmployeeStatsSuccessResponse = {
  success: true;
  stats: EmployeeStats;
};

export type EmployeeStatsErrorResponse = {
  success: false;
  error: string;
};

export type EmployeeStatsResponse =
  | EmployeeStatsSuccessResponse
  | EmployeeStatsErrorResponse;

export async function getEmployeeStats(): Promise<EmployeeStatsResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const role = session.user.role;

    if (role === "salesman") {
      return getSalesmanStats(session.user.id);
    } else if (role === "deliveryman") {
      return getDeliverymanStats(session.user.id);
    }

    return { success: false, error: "Invalid role" };
  } catch (error) {
    console.error("Error getting employee stats:", error);
    return { success: false, error: "Failed to get stats" };
  }
}

async function getSalesmanStats(userId: string) {
  try {
    // Get current month dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get estimates stats
    const estimates = await db.query.estimate.findMany({
      where: eq(estimate.salesmanId, userId),
      columns: {
        status: true,
        total: true,
        createdAt: true,
      },
    });

    // Calculate estimate stats
    const estimateStats = {
      total: estimates.length,
      draft: 0,
      sent: 0,
      approved: 0,
      rejected: 0,
      converted: 0,
      thisMonth: 0,
      today: 0,
      totalValue: 0,
      convertedValue: 0,
    };

    for (const est of estimates) {
      estimateStats[est.status as keyof typeof estimateStats]++;
      estimateStats.totalValue += Number(est.total);

      if (est.status === "converted") {
        estimateStats.convertedValue += Number(est.total);
      }

      if (est.createdAt >= startOfMonth) {
        estimateStats.thisMonth++;
      }
      if (est.createdAt >= today) {
        estimateStats.today++;
      }
    }

    // Calculate conversion rate
    const conversionRate =
      estimateStats.total > 0
        ? Math.round((estimateStats.converted / estimateStats.total) * 100)
        : 0;

    // Get recent estimates
    const recentEstimates = await db.query.estimate.findMany({
      where: eq(estimate.salesmanId, userId),
      with: {
        customer: {
          columns: {
            id: true,
            name: true,
            shopName: true,
          },
        },
      },
      orderBy: [desc(estimate.createdAt)],
      limit: 5,
    });

    return {
      success: true as const,
      stats: {
        role: "salesman" as const,
        estimates: estimateStats,
        conversionRate,
        recentEstimates,
      },
    };
  } catch (error) {
    console.error("Error getting salesman stats:", error);
    return { success: false as const, error: "Failed to get stats" };
  }
}

async function getDeliverymanStats(userId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get delivery groups assigned to this deliveryman
    const groups = await db.query.deliveryGroup.findMany({
      where: eq(deliveryGroup.deliverymanId, userId),
      with: {
        invoices: true,
      },
    });

    // Get return statistics for this deliveryman
    const returnStats = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${orderReturn.totalAmount}::numeric), 0)::numeric`,
      })
      .from(orderReturn)
      .where(eq(orderReturn.userId, userId));

    const processedReturnStats = await db
      .select({
        totalAmount: sql<number>`coalesce(sum(${orderReturn.totalAmount}::numeric), 0)::numeric`,
      })
      .from(orderReturn)
      .where(
        and(
          eq(orderReturn.userId, userId),
          eq(orderReturn.status, "processed"),
        ),
      );

    // Calculate stats
    const deliveryStats = {
      totalGroups: groups.length,
      activeGroups: 0,
      completedGroups: 0,
      totalDeliveries: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      todayDelivered: 0,
      todayFailed: 0,
      // Return statistics as per requirements lines 4560-4666
      totalReturns: returnStats[0]?.count ?? 0,
      returnAmountProcessed: Number(processedReturnStats[0]?.totalAmount ?? 0),
    };

    for (const group of groups) {
      if (group.status === "assigned" || group.status === "out_for_delivery") {
        deliveryStats.activeGroups++;
      } else if (group.status === "completed" || group.status === "partial") {
        deliveryStats.completedGroups++;
      }

      for (const deliveryInvoice of group.invoices) {
        deliveryStats.totalDeliveries++;

        if (deliveryInvoice.status === "delivered") {
          deliveryStats.delivered++;
          if (
            deliveryInvoice.deliveredAt &&
            deliveryInvoice.deliveredAt >= today
          ) {
            deliveryStats.todayDelivered++;
          }
        } else if (deliveryInvoice.status === "failed") {
          deliveryStats.failed++;
          deliveryStats.todayFailed++;
        } else {
          deliveryStats.pending++;
        }
      }
    }

    // Calculate success rate
    const completedDeliveries = deliveryStats.delivered + deliveryStats.failed;
    const successRate =
      completedDeliveries > 0
        ? Math.round((deliveryStats.delivered / completedDeliveries) * 100)
        : 100;

    // Get active groups with details (both assigned and out_for_delivery)
    const activeGroups = await db.query.deliveryGroup.findMany({
      where: and(
        eq(deliveryGroup.deliverymanId, userId),
        sql`${deliveryGroup.status} IN ('assigned', 'out_for_delivery')`,
      ),
      with: {
        invoices: {
          where: eq(deliveryGroupInvoice.status, "pending"),
          with: {
            invoice: {
              columns: {
                id: true,
                invoiceNumber: true,
              },
              with: {
                order: {
                  columns: {
                    shippingAddress: true,
                    shippingCity: true,
                  },
                },
              },
            },
          },
        },
      },
      limit: 5,
    });

    return {
      success: true as const,
      stats: {
        role: "deliveryman" as const,
        deliveries: deliveryStats,
        successRate,
        activeGroups,
      },
    };
  } catch (error) {
    console.error("Error getting deliveryman stats:", error);
    return { success: false as const, error: "Failed to get stats" };
  }
}
