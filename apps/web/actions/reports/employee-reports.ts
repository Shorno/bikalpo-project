"use server";

import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { user } from "@/db/schema/auth-schema";
import { deliveryGroup, deliveryGroupInvoice } from "@/db/schema/delivery";
import { estimate } from "@/db/schema/estimate";
import { auth } from "@/lib/auth";

interface EmployeeMetrics {
  id: string;
  name: string;
  email: string;
  role: string | null;
  // Salesman metrics
  totalEstimates?: number;
  approvedEstimates?: number;
  convertedEstimates?: number;
  totalSalesValue?: number;
  conversionRate?: number;
  avgOrderValue?: number;
  // Deliveryman metrics
  totalDeliveries?: number;
  completedDeliveries?: number;
  failedDeliveries?: number;
  successRate?: number;
  avgDeliveriesPerDay?: number;
}

export async function getEmployeePerformanceReport(options?: {
  role?: "salesman" | "deliveryman";
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Get employees based on role filter
    const roleFilter = options?.role
      ? eq(user.role, options.role)
      : sql`${user.role} IN ('salesman', 'deliveryman')`;

    const employees = await db.query.user.findMany({
      where: roleFilter,
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    const reports: EmployeeMetrics[] = [];

    for (const emp of employees) {
      const metrics: EmployeeMetrics = {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
      };

      if (emp.role === "salesman") {
        // Get salesman metrics
        const estimateConditions = [eq(estimate.salesmanId, emp.id)];

        if (options?.startDate) {
          estimateConditions.push(gte(estimate.createdAt, options.startDate));
        }
        if (options?.endDate) {
          estimateConditions.push(lte(estimate.createdAt, options.endDate));
        }

        const estimates = await db.query.estimate.findMany({
          where: and(...estimateConditions),
          columns: {
            status: true,
            total: true,
          },
        });

        metrics.totalEstimates = estimates.length;
        metrics.approvedEstimates = estimates.filter(
          (e) => e.status === "approved",
        ).length;
        metrics.convertedEstimates = estimates.filter(
          (e) => e.status === "converted",
        ).length;
        metrics.totalSalesValue = estimates
          .filter((e) => e.status === "converted")
          .reduce((sum, e) => sum + Number(e.total), 0);
        metrics.conversionRate =
          metrics.totalEstimates > 0
            ? Math.round(
                (metrics.convertedEstimates / metrics.totalEstimates) * 100,
              )
            : 0;
        metrics.avgOrderValue =
          metrics.convertedEstimates > 0
            ? Math.round(metrics.totalSalesValue / metrics.convertedEstimates)
            : 0;
      } else if (emp.role === "deliveryman") {
        // Get deliveryman metrics
        const groupConditions = [eq(deliveryGroup.deliverymanId, emp.id)];

        if (options?.startDate) {
          groupConditions.push(gte(deliveryGroup.createdAt, options.startDate));
        }
        if (options?.endDate) {
          groupConditions.push(lte(deliveryGroup.createdAt, options.endDate));
        }

        const groups = await db.query.deliveryGroup.findMany({
          where: and(...groupConditions),
          with: {
            invoices: true,
          },
        });

        let totalDeliveries = 0;
        let completed = 0;
        let failed = 0;
        const deliveryDates = new Set<string>();

        for (const group of groups) {
          for (const deliveryInvoice of group.invoices) {
            totalDeliveries++;
            if (deliveryInvoice.status === "delivered") {
              completed++;
              if (deliveryInvoice.deliveredAt) {
                deliveryDates.add(deliveryInvoice.deliveredAt.toDateString());
              }
            } else if (deliveryInvoice.status === "failed") {
              failed++;
            }
          }
        }

        metrics.totalDeliveries = totalDeliveries;
        metrics.completedDeliveries = completed;
        metrics.failedDeliveries = failed;
        metrics.successRate =
          completed + failed > 0
            ? Math.round((completed / (completed + failed)) * 100)
            : 100;
        metrics.avgDeliveriesPerDay =
          deliveryDates.size > 0
            ? Math.round(completed / deliveryDates.size)
            : 0;
      }

      reports.push(metrics);
    }

    // Sort by performance (conversion rate for salesman, success rate for deliveryman)
    reports.sort((a, b) => {
      if (a.role === "salesman" && b.role === "salesman") {
        return (b.conversionRate || 0) - (a.conversionRate || 0);
      }
      if (a.role === "deliveryman" && b.role === "deliveryman") {
        return (b.successRate || 0) - (a.successRate || 0);
      }
      return 0;
    });

    return { success: true, reports };
  } catch (error) {
    console.error("Error getting employee performance report:", error);
    return { success: false, error: "Failed to get report" };
  }
}

export async function getEmployeeDetailedReport(
  employeeId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
  },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const employee = await db.query.user.findFirst({
      where: eq(user.id, employeeId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    if (employee.role === "salesman") {
      return getSalesmanDetailedReport(employee, options);
    } else if (employee.role === "deliveryman") {
      return getDeliverymanDetailedReport(employee, options);
    }

    return { success: false, error: "Invalid employee role" };
  } catch (error) {
    console.error("Error getting detailed report:", error);
    return { success: false, error: "Failed to get report" };
  }
}

async function getSalesmanDetailedReport(
  employee: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    createdAt: Date;
  },
  options?: { startDate?: Date; endDate?: Date },
) {
  const conditions = [eq(estimate.salesmanId, employee.id)];

  if (options?.startDate) {
    conditions.push(gte(estimate.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(estimate.createdAt, options.endDate));
  }

  const estimates = await db.query.estimate.findMany({
    where: and(...conditions),
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
  });

  // Group by month for trend data
  const monthlyData: Record<
    string,
    { count: number; value: number; converted: number }
  > = {};

  for (const est of estimates) {
    const monthKey = `${est.createdAt.getFullYear()}-${String(est.createdAt.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { count: 0, value: 0, converted: 0 };
    }

    monthlyData[monthKey].count++;
    monthlyData[monthKey].value += Number(est.total);

    if (est.status === "converted") {
      monthlyData[monthKey].converted++;
    }
  }

  // Get top customers
  const customerStats: Record<
    string,
    { name: string; shopName: string | null; count: number; value: number }
  > = {};

  for (const est of estimates) {
    if (est.customer && est.status === "converted") {
      if (!customerStats[est.customer.id]) {
        customerStats[est.customer.id] = {
          name: est.customer.name,
          shopName: est.customer.shopName,
          count: 0,
          value: 0,
        };
      }
      customerStats[est.customer.id].count++;
      customerStats[est.customer.id].value += Number(est.total);
    }
  }

  const topCustomers = Object.values(customerStats)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    success: true,
    report: {
      employee,
      summary: {
        totalEstimates: estimates.length,
        converted: estimates.filter((e) => e.status === "converted").length,
        pending: estimates.filter(
          (e) => e.status === "sent" || e.status === "draft",
        ).length,
        rejected: estimates.filter((e) => e.status === "rejected").length,
        totalValue: estimates.reduce((sum, e) => sum + Number(e.total), 0),
      },
      monthlyTrend: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data,
      })),
      topCustomers,
      recentActivity: estimates.slice(0, 10),
    },
  };
}

async function getDeliverymanDetailedReport(
  employee: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    createdAt: Date;
  },
  options?: { startDate?: Date; endDate?: Date },
) {
  const conditions = [eq(deliveryGroup.deliverymanId, employee.id)];

  if (options?.startDate) {
    conditions.push(gte(deliveryGroup.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(deliveryGroup.createdAt, options.endDate));
  }

  const groups = await db.query.deliveryGroup.findMany({
    where: and(...conditions),
    with: {
      invoices: {
        with: {
          invoice: {
            columns: {
              id: true,
              invoiceNumber: true,
            },
            with: {
              order: {
                columns: {
                  id: true,
                  orderNumber: true,
                  shippingCity: true,
                  shippingArea: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [desc(deliveryGroup.createdAt)],
  });

  // Calculate daily performance
  const dailyData: Record<string, { delivered: number; failed: number }> = {};
  let totalDelivered = 0;
  let totalFailed = 0;
  const areaStats: Record<string, number> = {};

  for (const group of groups) {
    for (const deliveryInvoice of group.invoices) {
      if (
        deliveryInvoice.status === "delivered" &&
        deliveryInvoice.deliveredAt
      ) {
        const dateKey = deliveryInvoice.deliveredAt.toISOString().split("T")[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { delivered: 0, failed: 0 };
        }
        dailyData[dateKey].delivered++;
        totalDelivered++;

        // Track by area
        const area =
          deliveryInvoice.invoice.order?.shippingArea ||
          deliveryInvoice.invoice.order?.shippingCity ||
          "Unknown";
        areaStats[area] = (areaStats[area] || 0) + 1;
      } else if (deliveryInvoice.status === "failed") {
        totalFailed++;
      }
    }
  }

  // Get top areas
  const topAreas = Object.entries(areaStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }));

  return {
    success: true,
    report: {
      employee,
      summary: {
        totalGroups: groups.length,
        completedGroups: groups.filter((g) => g.status === "completed").length,
        totalDelivered,
        totalFailed,
        successRate:
          totalDelivered + totalFailed > 0
            ? Math.round(
                (totalDelivered / (totalDelivered + totalFailed)) * 100,
              )
            : 100,
      },
      dailyTrend: Object.entries(dailyData)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topAreas,
      recentGroups: groups.slice(0, 10),
    },
  };
}

export async function getTeamOverview() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id || session.user.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    // Get employee counts by role
    const salesmen = await db
      .select({ count: count() })
      .from(user)
      .where(eq(user.role, "salesman"));

    const deliverymen = await db
      .select({ count: count() })
      .from(user)
      .where(eq(user.role, "deliveryman"));

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEstimates = await db
      .select({ count: count() })
      .from(estimate)
      .where(gte(estimate.createdAt, today));

    const todayDeliveries = await db
      .select({ count: count() })
      .from(deliveryGroupInvoice)
      .where(
        and(
          eq(deliveryGroupInvoice.status, "delivered"),
          gte(deliveryGroupInvoice.deliveredAt, today),
        ),
      );

    return {
      success: true,
      overview: {
        salesmenCount: salesmen[0]?.count || 0,
        deliverymenCount: deliverymen[0]?.count || 0,
        todayEstimates: todayEstimates[0]?.count || 0,
        todayDeliveries: todayDeliveries[0]?.count || 0,
      },
    };
  } catch (error) {
    console.error("Error getting team overview:", error);
    return { success: false, error: "Failed to get overview" };
  }
}
