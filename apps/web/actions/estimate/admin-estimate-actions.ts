"use server";

import { and, count, desc, eq, gte, lte, sum } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { type EstimateStatus, estimate } from "@/db/schema/estimate";
import { auth } from "@/lib/auth";
import {
  type ReviewEstimateFormValues,
  reviewEstimateSchema,
} from "@/schema/estimate.schema";

export async function getAllEstimates(options?: {
  status?: EstimateStatus;
  salesmanId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized", estimates: [] };
    }

    const conditions = [];

    if (options?.status) {
      conditions.push(eq(estimate.status, options.status));
    }

    if (options?.salesmanId) {
      conditions.push(eq(estimate.salesmanId, options.salesmanId));
    }

    if (options?.startDate) {
      conditions.push(gte(estimate.createdAt, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(estimate.createdAt, options.endDate));
    }

    const estimates = await db.query.estimate.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
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
      orderBy: [desc(estimate.createdAt)],
    });

    return { success: true, estimates };
  } catch (error) {
    console.error("Error getting all estimates:", error);
    return { success: false, error: "Failed to get estimates", estimates: [] };
  }
}

export async function reviewEstimate(data: ReviewEstimateFormValues) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = reviewEstimateSchema.safeParse(data);
    if (!validatedData.success) {
      return {
        success: false,
        error: validatedData.error.issues[0]?.message || "Invalid input",
      };
    }

    const { estimateId, action, notes } = validatedData.data;

    // Get estimate
    const existingEstimate = await db.query.estimate.findFirst({
      where: eq(estimate.id, estimateId),
    });

    if (!existingEstimate) {
      return { success: false, error: "Estimate not found" };
    }

    if (
      existingEstimate.status !== "pending" &&
      existingEstimate.status !== "sent" && // Keep backward compatibility/admin override
      existingEstimate.status !== "draft"
    ) {
      return {
        success: false,
        error: "Only pending, sent or draft estimates can be reviewed",
      };
    }

    const updateData: Record<string, unknown> = {};

    if (action === "approve") {
      // Admin approval always sets to 'approved' status
      updateData.status = "approved";
      updateData.approvedAt = new Date();
    } else {
      updateData.status = "rejected";
      updateData.rejectedAt = new Date();
    }

    if (notes) {
      updateData.notes = existingEstimate.notes
        ? `${existingEstimate.notes}\n\nAdmin: ${notes}`
        : `Admin: ${notes}`;
    }

    await db
      .update(estimate)
      .set(updateData)
      .where(eq(estimate.id, estimateId));

    revalidatePath("/employee/estimates");
    revalidatePath("/dashboard/admin/estimates");
    revalidatePath("/customer/account/orders");
    revalidatePath("/customer/account/estimates");

    return { success: true };
  } catch (error) {
    console.error("Error reviewing estimate:", error);
    return { success: false, error: "Failed to review estimate" };
  }
}

export async function bulkApproveEstimates(estimateIds: number[]) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    if (!estimateIds.length) {
      return { success: false, error: "No estimates provided" };
    }

    let approved = 0;
    let failed = 0;

    for (const id of estimateIds) {
      const existingEstimate = await db.query.estimate.findFirst({
        where: eq(estimate.id, id),
      });

      if (
        existingEstimate &&
        (existingEstimate.status === "pending" ||
          existingEstimate.status === "draft")
      ) {
        await db
          .update(estimate)
          .set({
            status: "approved", // Bulk approve sets to approved
            approvedAt: new Date(),
          })
          .where(eq(estimate.id, id));
        approved++;
      } else {
        failed++;
      }
    }

    revalidatePath("/employee/estimates");
    revalidatePath("/dashboard/admin/estimates");
    revalidatePath("/customer/account/orders");
    revalidatePath("/customer/account/estimates");

    return { success: true, approved, failed };
  } catch (error) {
    console.error("Error bulk approving estimates:", error);
    return { success: false, error: "Failed to bulk approve estimates" };
  }
}

export async function getAdminEstimateStats() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Get counts by status
    const statusCounts = await db
      .select({
        status: estimate.status,
        count: count(),
        totalValue: sum(estimate.total),
      })
      .from(estimate)
      .groupBy(estimate.status);

    // Get pending review count (pending status)
    const pendingReview =
      statusCounts.find((s) => s.status === "pending")?.count || 0;

    // Get today's estimates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEstimates = await db
      .select({ count: count() })
      .from(estimate)
      .where(gte(estimate.createdAt, today));

    const stats = {
      byStatus: statusCounts.reduce(
        (acc, curr) => {
          acc[curr.status] = {
            count: Number(curr.count),
            value: Number(curr.totalValue) || 0,
          };
          return acc;
        },
        {} as Record<string, { count: number; value: number }>,
      ),
      pendingReview: Number(pendingReview),
      todayCount: todayEstimates[0]?.count || 0,
      total: statusCounts.reduce((sum, s) => sum + Number(s.count), 0),
    };

    return { success: true, stats };
  } catch (error) {
    console.error("Error getting admin estimate stats:", error);
    return { success: false, error: "Failed to get stats" };
  }
}
