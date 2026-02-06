"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { type EstimateStatus, estimate } from "@/db/schema/estimate";
import { auth } from "@/lib/auth";

export async function getEstimateById(estimateId: number) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const estimateData = await db.query.estimate.findFirst({
      where: eq(estimate.id, estimateId),
      with: {
        items: true,
        customer: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            shopName: true,
          },
        },
        salesman: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!estimateData) {
      return { success: false, error: "Estimate not found" };
    }

    // Check permissions - salesman can only see their own, admin sees all
    const isCreator = estimateData.salesmanId === session.user.id;
    const isCustomer = estimateData.customerId === session.user.id;
    const isAdmin = session.user.role === "admin";

    if (!isCreator && !isCustomer && !isAdmin) {
      return { success: false, error: "Not authorized to view this estimate" };
    }

    // Customers can only view approved/sent/converted estimates
    if (isCustomer && !isCreator && !isAdmin) {
      const allowedStatuses: EstimateStatus[] = [
        "sent",
        "approved",
        "converted",
      ];
      if (!allowedStatuses.includes(estimateData.status)) {
        return { success: false, error: "Estimate not found" };
      }
    }

    return { success: true, estimate: estimateData };
  } catch (error) {
    console.error("Error getting estimate:", error);
    return { success: false, error: "Failed to get estimate" };
  }
}

export async function getEstimatesBySalesman(options?: {
  status?: EstimateStatus;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", estimates: [] };
    }

    if (session.user.role !== "salesman" && session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", estimates: [] };
    }

    const conditions = [eq(estimate.salesmanId, session.user.id)];

    if (options?.status) {
      conditions.push(eq(estimate.status, options.status));
    }

    const estimates = await db.query.estimate.findMany({
      where: conditions.length > 1 ? and(...conditions) : conditions[0],
      with: {
        items: true,
        customer: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            shopName: true,
          },
        },
      },
      orderBy: [desc(estimate.createdAt)],
    });

    return { success: true, estimates };
  } catch (error) {
    console.error("Error getting salesman estimates:", error);
    return { success: false, error: "Failed to get estimates", estimates: [] };
  }
}

export async function getEstimatesByCustomer(customerId?: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", estimates: [] };
    }

    // If no customerId provided, use the session user's ID
    const targetCustomerId = customerId || session.user.id;

    // Customers can only see their own, salesman/admin can see any customer
    const isOwnEstimates = targetCustomerId === session.user.id;
    const isEmployee =
      session.user.role === "salesman" || session.user.role === "admin";

    if (!isOwnEstimates && !isEmployee) {
      return { success: false, error: "Unauthorized", estimates: [] };
    }

    // Build where conditions
    let whereCondition;
    if (isEmployee) {
      // Employees see all estimates for the customer
      whereCondition = eq(estimate.customerId, targetCustomerId);
    } else {
      // Customers only see approved/converted estimates (after admin approval)
      whereCondition = and(
        eq(estimate.customerId, targetCustomerId),
        inArray(estimate.status, ["approved", "converted"]),
      );
    }

    const estimates = await db.query.estimate.findMany({
      where: whereCondition,
      with: {
        items: true,
        salesman: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [desc(estimate.createdAt)],
    });

    return { success: true, estimates };
  } catch (error) {
    console.error("Error getting customer estimates:", error);
    return { success: false, error: "Failed to get estimates", estimates: [] };
  }
}

export async function getEstimateStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== "salesman" && session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const condition =
      session.user.role === "admin"
        ? undefined
        : eq(estimate.salesmanId, session.user.id);

    const estimates = await db.query.estimate.findMany({
      where: condition,
      columns: {
        status: true,
        total: true,
      },
    });

    const stats = {
      total: estimates.length,
      draft: 0,
      sent: 0,
      approved: 0,
      rejected: 0,
      converted: 0,
      totalValue: 0,
      approvedValue: 0,
    };

    for (const est of estimates) {
      stats[est.status as keyof typeof stats]++;
      stats.totalValue += Number(est.total);
      if (est.status === "approved" || est.status === "converted") {
        stats.approvedValue += Number(est.total);
      }
    }

    return { success: true, stats };
  } catch (error) {
    console.error("Error getting estimate stats:", error);
    return { success: false, error: "Failed to get stats" };
  }
}
