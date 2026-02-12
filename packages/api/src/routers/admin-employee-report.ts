import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@bikalpo-project/db";
import { deliveryGroup, deliveryGroupInvoice, estimate, user } from "@bikalpo-project/db/schema";
import { adminProcedure } from "../index";

export interface EmployeeMetrics {
    id: string;
    name: string;
    email: string;
    role: string | null;
    totalEstimates?: number;
    approvedEstimates?: number;
    convertedEstimates?: number;
    totalSalesValue?: number;
    conversionRate?: number;
    avgOrderValue?: number;
    totalDeliveries?: number;
    completedDeliveries?: number;
    failedDeliveries?: number;
    successRate?: number;
    avgDeliveriesPerDay?: number;
}

export const adminEmployeeReportRouter = {
    getPerformance: adminProcedure
        .route({
            method: "POST",
            path: "/admin/employee-reports/performance",
            tags: ["Admin Employee Reports"],
            summary: "Get employee performance",
            description: "Get performance metrics for employees",
        })
        .input(
            z.object({
                role: z.enum(["salesman", "deliveryman"]).optional(),
                startDate: z.coerce.date().optional(),
                endDate: z.coerce.date().optional(),
            }),
        )
        .handler(async ({ input: options }) => {
            const roleFilter = options.role
                ? eq(user.role, options.role)
                : sql`${user.role} IN ('salesman', 'deliveryman')`;

            const employees = await db.query.user.findMany({
                where: roleFilter,
                columns: { id: true, name: true, email: true, role: true },
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
                    const estimateConditions = [eq(estimate.salesmanId, emp.id)];
                    if (options.startDate) estimateConditions.push(gte(estimate.createdAt, options.startDate));
                    if (options.endDate) estimateConditions.push(lte(estimate.createdAt, options.endDate));

                    const estimates = await db.query.estimate.findMany({
                        where: and(...estimateConditions),
                        columns: { status: true, total: true },
                    });

                    metrics.totalEstimates = estimates.length;
                    metrics.approvedEstimates = estimates.filter((e) => e.status === "approved").length;
                    metrics.convertedEstimates = estimates.filter((e) => e.status === "converted").length;
                    metrics.totalSalesValue = estimates
                        .filter((e) => e.status === "converted")
                        .reduce((sum, e) => sum + Number(e.total), 0);
                    metrics.conversionRate =
                        metrics.totalEstimates > 0
                            ? Math.round((metrics.convertedEstimates / metrics.totalEstimates) * 100)
                            : 0;
                    metrics.avgOrderValue =
                        metrics.convertedEstimates > 0
                            ? Math.round(metrics.totalSalesValue / metrics.convertedEstimates)
                            : 0;
                } else if (emp.role === "deliveryman") {
                    const groupConditions = [eq(deliveryGroup.deliverymanId, emp.id)];
                    if (options.startDate) groupConditions.push(gte(deliveryGroup.createdAt, options.startDate));
                    if (options.endDate) groupConditions.push(lte(deliveryGroup.createdAt, options.endDate));

                    const groups = await db.query.deliveryGroup.findMany({
                        where: and(...groupConditions),
                        with: { invoices: true },
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
                        completed + failed > 0 ? Math.round((completed / (completed + failed)) * 100) : 100;
                    metrics.avgDeliveriesPerDay = deliveryDates.size > 0 ? Math.round(completed / deliveryDates.size) : 0;
                }

                reports.push(metrics);
            }

            reports.sort((a, b) => {
                if (a.role === "salesman" && b.role === "salesman") {
                    return (b.conversionRate || 0) - (a.conversionRate || 0);
                }
                if (a.role === "deliveryman" && b.role === "deliveryman") {
                    return (b.successRate || 0) - (a.successRate || 0);
                }
                return 0;
            });

            return reports;
        }),

    getDetailed: adminProcedure
        .route({
            method: "POST",
            path: "/admin/employee-reports/detailed",
            tags: ["Admin Employee Reports"],
            summary: "Get detailed employee report",
            description: "Get detailed performance report for a specific employee",
        })
        .input(
            z.object({
                employeeId: z.string(),
                startDate: z.coerce.date().optional(),
                endDate: z.coerce.date().optional(),
            }),
        )
        .handler(async ({ input }) => {
            const employee = await db.query.user.findFirst({
                where: eq(user.id, input.employeeId),
                columns: { id: true, name: true, email: true, role: true, createdAt: true },
            });

            if (!employee) throw new Error("Employee not found");

            if (employee.role === "salesman") {
                return getSalesmanDetailedReport(employee, input);
            } else if (employee.role === "deliveryman") {
                return getDeliverymanDetailedReport(employee, input);
            }

            throw new Error("Invalid employee role");
        }),

    getTeamOverview: adminProcedure
        .route({
            method: "GET",
            path: "/admin/employee-reports/team-overview",
            tags: ["Admin Employee Reports"],
            summary: "Get team overview",
            description: "Get overview of all team members",
        })
        .handler(async () => {
            const salesmen = await db.select({ count: count() }).from(user).where(eq(user.role, "salesman"));
            const deliverymen = await db.select({ count: count() }).from(user).where(eq(user.role, "deliveryman"));

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayEstimates = await db
                .select({ count: count() })
                .from(estimate)
                .where(gte(estimate.createdAt, today));

            const todayDeliveries = await db
                .select({ count: count() })
                .from(deliveryGroupInvoice)
                .where(and(eq(deliveryGroupInvoice.status, "delivered"), gte(deliveryGroupInvoice.deliveredAt, today)));

            return {
                salesmenCount: salesmen[0]?.count || 0,
                deliverymenCount: deliverymen[0]?.count || 0,
                todayEstimates: todayEstimates[0]?.count || 0,
                todayDeliveries: todayDeliveries[0]?.count || 0,
            };
        }),
};

// ── Private helpers ────────────────────────────────────────────

async function getSalesmanDetailedReport(
    employee: { id: string; name: string; email: string; role: string | null; createdAt: Date },
    options?: { startDate?: Date; endDate?: Date },
) {
    const conditions = [eq(estimate.salesmanId, employee.id)];
    if (options?.startDate) conditions.push(gte(estimate.createdAt, options.startDate));
    if (options?.endDate) conditions.push(lte(estimate.createdAt, options.endDate));

    const estimates = await db.query.estimate.findMany({
        where: and(...conditions),
        with: {
            customer: { columns: { id: true, name: true, shopName: true } },
        },
        orderBy: [desc(estimate.createdAt)],
    });

    const monthlyData: Record<string, { count: number; value: number; converted: number }> = {};
    for (const est of estimates) {
        const monthKey = `${est.createdAt.getFullYear()}-${String(est.createdAt.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { count: 0, value: 0, converted: 0 };
        monthlyData[monthKey].count++;
        monthlyData[monthKey].value += Number(est.total);
        if (est.status === "converted") monthlyData[monthKey].converted++;
    }

    const customerStats: Record<string, { name: string; shopName: string | null; count: number; value: number }> = {};
    for (const est of estimates) {
        if (est.customer && est.status === "converted") {
            const custId = est.customer.id;
            if (!customerStats[custId]) {
                customerStats[custId] = { name: est.customer.name, shopName: est.customer.shopName, count: 0, value: 0 };
            }
            customerStats[custId].count++;
            customerStats[custId].value += Number(est.total);
        }
    }

    const topCustomers = Object.values(customerStats)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    return {
        employee,
        summary: {
            totalEstimates: estimates.length,
            converted: estimates.filter((e) => e.status === "converted").length,
            pending: estimates.filter((e) => e.status === "sent" || e.status === "draft").length,
            rejected: estimates.filter((e) => e.status === "rejected").length,
            totalValue: estimates.reduce((sum, e) => sum + Number(e.total), 0),
        },
        monthlyTrend: Object.entries(monthlyData).map(([month, data]) => ({ month, ...data })),
        topCustomers,
        recentActivity: estimates.slice(0, 10),
    };
}

async function getDeliverymanDetailedReport(
    employee: { id: string; name: string; email: string; role: string | null; createdAt: Date },
    options?: { startDate?: Date; endDate?: Date },
) {
    const conditions = [eq(deliveryGroup.deliverymanId, employee.id)];
    if (options?.startDate) conditions.push(gte(deliveryGroup.createdAt, options.startDate));
    if (options?.endDate) conditions.push(lte(deliveryGroup.createdAt, options.endDate));

    const groups = await db.query.deliveryGroup.findMany({
        where: and(...conditions),
        with: {
            invoices: {
                with: {
                    invoice: {
                        columns: { id: true, invoiceNumber: true },
                        with: {
                            order: { columns: { id: true, orderNumber: true, shippingCity: true, shippingArea: true } },
                        },
                    },
                },
            },
        },
        orderBy: [desc(deliveryGroup.createdAt)],
    });

    const dailyData: Record<string, { delivered: number; failed: number }> = {};
    let totalDelivered = 0;
    let totalFailed = 0;
    const areaStats: Record<string, number> = {};

    for (const group of groups) {
        for (const deliveryInvoice of group.invoices) {
            if (deliveryInvoice.status === "delivered" && deliveryInvoice.deliveredAt) {
                const dateKey = deliveryInvoice.deliveredAt.toISOString().split("T")[0]!;
                if (!dailyData[dateKey]) dailyData[dateKey] = { delivered: 0, failed: 0 };
                dailyData[dateKey]!.delivered++;
                totalDelivered++;

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

    const topAreas = Object.entries(areaStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([area, cnt]) => ({ area, count: cnt }));

    return {
        employee,
        summary: {
            totalGroups: groups.length,
            completedGroups: groups.filter((g) => g.status === "completed").length,
            totalDelivered,
            totalFailed,
            successRate:
                totalDelivered + totalFailed > 0
                    ? Math.round((totalDelivered / (totalDelivered + totalFailed)) * 100)
                    : 100,
        },
        dailyTrend: Object.entries(dailyData)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        topAreas,
        recentGroups: groups.slice(0, 10),
    };
}
