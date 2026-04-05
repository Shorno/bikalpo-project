import { db } from "@bikalpo-project/db";
import { expense, expenseCategory, order, purchase } from "@bikalpo-project/db/schema";
import { and, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

export const profitLossRouter = {
    /** Monthly Profit & Loss report */
    getMonthlyPnL: protectedProcedure
        .route({
            method: "POST",
            path: "/profit-loss/monthly",
            tags: ["Profit & Loss"],
            summary: "Monthly P&L",
            description: "Auto-generated monthly profit & loss statement",
        })
        .input(
            z.object({
                year: z.number().int().min(2020).max(2100),
                month: z.number().int().min(1).max(12),
            }),
        )
        .handler(async ({ context, input }) => {
            const { year, month } = input;
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            // Build endDate without toISOString() to avoid UTC timezone shift
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

            const ownerId = context.session.user.id;

            // Build date boundaries that cover full month regardless of timezone
            const monthStart = new Date(year, month - 1, 1); // First day of month at midnight local
            const monthEnd = new Date(year, month, 1); // First day of NEXT month

            // Revenue = total from completed/delivered orders (as shop or warehouse)
            const [revenueResult] = await db
                .select({ total: sql<string>`COALESCE(SUM(${order.total}::numeric), 0)::text` })
                .from(order)
                .where(
                    and(
                        sql`(${order.shopId} = ${ownerId} OR ${order.warehouseId} = ${ownerId})`,
                        inArray(order.status, ["confirmed", "delivered"]),
                        gte(order.createdAt, monthStart),
                        lt(order.createdAt, monthEnd),
                    ),
                );

            // COGS = total from received purchases (use purchaseDate which is a date column)
            const [cogsResult] = await db
                .select({ total: sql<string>`COALESCE(SUM(${purchase.total}::numeric), 0)::text` })
                .from(purchase)
                .where(
                    and(
                        eq(purchase.warehouseId, ownerId),
                        eq(purchase.status, "received"),
                        gte(purchase.purchaseDate, startDate),
                        lte(purchase.purchaseDate, endDate),
                    ),
                );

            // Expenses by category
            const expenseRows = await db
                .select({
                    categoryName: expenseCategory.name,
                    categorySlug: expenseCategory.slug,
                    total: sql<string>`COALESCE(SUM(${expense.amount}::numeric), 0)::text`,
                })
                .from(expense)
                .innerJoin(expenseCategory, eq(expense.categoryId, expenseCategory.id))
                .where(
                    and(
                        eq(expense.ownerId, ownerId),
                        eq(expense.isVoided, false),
                        gte(expense.paymentDate, startDate),
                        lte(expense.paymentDate, endDate),
                    ),
                )
                .groupBy(expenseCategory.name, expenseCategory.slug);

            const revenue = parseFloat(revenueResult?.total ?? "0");
            const cogs = parseFloat(cogsResult?.total ?? "0");
            const grossProfit = revenue - cogs;

            const totalExpenses = expenseRows.reduce(
                (sum, row) => sum + parseFloat(row.total),
                0,
            );
            const netProfit = grossProfit - totalExpenses;

            return {
                period: { year, month, startDate, endDate },
                revenue: revenue.toFixed(2),
                cogs: cogs.toFixed(2),
                grossProfit: grossProfit.toFixed(2),
                expenses: {
                    breakdown: expenseRows.map((r) => ({
                        category: r.categoryName,
                        slug: r.categorySlug,
                        amount: parseFloat(r.total).toFixed(2),
                    })),
                    total: totalExpenses.toFixed(2),
                },
                netProfit: netProfit.toFixed(2),
            };
        }),
};
