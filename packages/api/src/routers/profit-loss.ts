import { db } from "@bikalpo-project/db";
import {
  expense,
  expenseCategory,
  financialLedger,
  invoice,
  order,
  purchase,
  warehousePosSale,
} from "@bikalpo-project/db/schema";
import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const ACTIVE_ORDER_STATUSES = ["confirmed", "processing", "delivered"] as const;
const PAID_INVOICE_STATUSES = new Set(["collected", "settled"]);

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function isOrderPaid(
  orderPaymentStatus: string | null | undefined,
  invoicePaymentStatus: string | null | undefined,
) {
  return (
    orderPaymentStatus === "paid" ||
    PAID_INVOICE_STATUSES.has(invoicePaymentStatus || "")
  );
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function dateValue(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function percentage(value: number, total: number) {
  if (total === 0) {
    return "0.00";
  }

  return ((value / total) * 100).toFixed(2);
}

export const profitLossRouter = {
  /** Date range Profit & Loss report */
  getMonthlyPnL: protectedProcedure
    .route({
      method: "POST",
      path: "/profit-loss/monthly",
      tags: ["Profit & Loss"],
      summary: "Profit & Loss",
      description:
        "Profit and loss statement for warehouse and retailer accounts",
    })
    .input(
      z.object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12).optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        reportType: z.enum(["accrual", "cash"]).default("accrual"),
      }),
    )
    .handler(async ({ context, input }) => {
      const month = input.month ?? 1;
      const startDate = input.startDate ?? dateValue(input.year, month, 1);
      const endDate =
        input.endDate ??
        dateValue(input.year, month, endOfMonth(input.year, month));
      const startDateTime = new Date(`${startDate}T00:00:00.000`);
      const endDateTime = new Date(`${endDate}T23:59:59.999`);
      const ownerId = context.session.user.id;
      const role = context.session.user.role;
      const ownerType = role === "warehouse" ? "warehouse" : "shop";
      const isCashBasis = input.reportType === "cash";
      const manualPurchaseEntryTypes = isCashBasis
        ? (["purchase_cash"] as const)
        : (["purchase_cash", "purchase_credit"] as const);

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
            eq(expense.ownerType, ownerType),
            eq(expense.isVoided, false),
            gte(expense.paymentDate, startDate),
            lte(expense.paymentDate, endDate),
          ),
        )
        .groupBy(expenseCategory.name, expenseCategory.slug);

      const manualProductPurchaseRows = await db
        .select({
          balanceBefore: financialLedger.balanceBefore,
          total: financialLedger.amount,
        })
        .from(financialLedger)
        .where(
          and(
            eq(financialLedger.ownerId, ownerId),
            eq(financialLedger.ownerType, ownerType),
            inArray(financialLedger.entryType, manualPurchaseEntryTypes),
            eq(financialLedger.referenceType, "adjustment"),
            gte(financialLedger.createdAt, startDateTime),
            lte(financialLedger.createdAt, endDateTime),
          ),
        );
      const manualProductPurchase = manualProductPurchaseRows.reduce(
        (sum, row) => sum + toNumber(row.total),
        0,
      );
      const manualProductSaleRows = await db
        .select({
          balanceBefore: financialLedger.balanceBefore,
          direction: financialLedger.direction,
          total: financialLedger.amount,
        })
        .from(financialLedger)
        .where(
          and(
            eq(financialLedger.ownerId, ownerId),
            eq(financialLedger.ownerType, ownerType),
            eq(financialLedger.entryType, "sale"),
            eq(financialLedger.referenceType, "adjustment"),
            gte(financialLedger.createdAt, startDateTime),
            lte(financialLedger.createdAt, endDateTime),
          ),
        );
      const recognizedManualSales = isCashBasis
        ? manualProductSaleRows.filter((row) => row.balanceBefore !== null)
        : manualProductSaleRows;
      const manualProductSales = recognizedManualSales.reduce(
        (sum, row) =>
          row.direction === "credit" ? sum + toNumber(row.total) : sum,
        0,
      );
      const manualProductSaleCost = recognizedManualSales.reduce(
        (sum, row) =>
          row.direction === "debit" ? sum + toNumber(row.total) : sum,
        0,
      );

      let productSales = 0;
      let productPurchase = 0;

      if (role === "warehouse") {
        const [orderRevenueRows, posRevenueRows, purchaseRows] =
          await Promise.all([
            db
              .select({
                total: order.total,
                paymentStatus: order.paymentStatus,
                invoicePaymentStatus: invoice.paymentStatus,
              })
              .from(order)
              .leftJoin(
                invoice,
                and(
                  eq(invoice.orderId, order.id),
                  eq(invoice.invoiceType, "main"),
                ),
              )
              .where(
                and(
                  eq(order.warehouseId, ownerId),
                  eq(order.orderType, "b2b"),
                  inArray(order.status, ACTIVE_ORDER_STATUSES),
                  gte(order.createdAt, startDateTime),
                  lte(order.createdAt, endDateTime),
                ),
              ),
            db
              .select({
                paid: warehousePosSale.paid,
                total: warehousePosSale.total,
              })
              .from(warehousePosSale)
              .where(
                and(
                  eq(warehousePosSale.warehouseId, ownerId),
                  eq(warehousePosSale.status, "completed"),
                  gte(warehousePosSale.createdAt, startDateTime),
                  lte(warehousePosSale.createdAt, endDateTime),
                ),
              ),
            db
              .select({
                total: purchase.total,
                paymentType: purchase.paymentType,
              })
              .from(purchase)
              .where(
                and(
                  eq(purchase.warehouseId, ownerId),
                  eq(purchase.status, "received"),
                  gte(purchase.purchaseDate, startDate),
                  lte(purchase.purchaseDate, endDate),
                ),
              ),
          ]);

        productSales += orderRevenueRows.reduce((sum, row) => {
          if (
            isCashBasis &&
            !isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
          ) {
            return sum;
          }

          return sum + toNumber(row.total);
        }, 0);
        productSales += posRevenueRows.reduce(
          (sum, row) => sum + toNumber(isCashBasis ? row.paid : row.total),
          0,
        );
        productPurchase = purchaseRows.reduce((sum, row) => {
          if (isCashBasis && row.paymentType !== "cash") {
            return sum;
          }

          return sum + toNumber(row.total);
        }, 0);
      } else {
        const [salesRows, purchaseOrderRows] = await Promise.all([
          db
            .select({
              total: order.total,
              paymentStatus: order.paymentStatus,
              invoicePaymentStatus: invoice.paymentStatus,
            })
            .from(order)
            .leftJoin(
              invoice,
              and(
                eq(invoice.orderId, order.id),
                eq(invoice.invoiceType, "main"),
              ),
            )
            .where(
              and(
                eq(order.shopId, ownerId),
                eq(order.orderType, "b2c"),
                inArray(order.status, ACTIVE_ORDER_STATUSES),
                gte(order.createdAt, startDateTime),
                lte(order.createdAt, endDateTime),
              ),
            ),
          db
            .select({
              total: order.total,
              paymentStatus: order.paymentStatus,
              invoicePaymentStatus: invoice.paymentStatus,
            })
            .from(order)
            .leftJoin(
              invoice,
              and(
                eq(invoice.orderId, order.id),
                eq(invoice.invoiceType, "main"),
              ),
            )
            .where(
              and(
                eq(order.userId, ownerId),
                eq(order.orderType, "b2b"),
                isNotNull(order.warehouseId),
                inArray(order.status, ACTIVE_ORDER_STATUSES),
                gte(order.createdAt, startDateTime),
                lte(order.createdAt, endDateTime),
              ),
            ),
        ]);

        productSales = salesRows.reduce((sum, row) => {
          if (
            isCashBasis &&
            !isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
          ) {
            return sum;
          }

          return sum + toNumber(row.total);
        }, 0);
        productPurchase = purchaseOrderRows.reduce((sum, row) => {
          if (
            isCashBasis &&
            !isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
          ) {
            return sum;
          }

          return sum + toNumber(row.total);
        }, 0);
      }

      const uncategorizedIncome = 0;
      productSales += manualProductSales;
      const revenue = productSales + uncategorizedIncome;
      productPurchase += manualProductPurchase + manualProductSaleCost;

      const cogs = productPurchase;
      const grossProfit = revenue - cogs;
      const totalExpenses = expenseRows.reduce(
        (sum, row) => sum + toNumber(row.total),
        0,
      );
      const netProfit = grossProfit - totalExpenses;

      return {
        period: {
          year: input.year,
          month,
          startDate,
          endDate,
          reportType: input.reportType,
        },
        revenue: toMoney(revenue),
        income: {
          breakdown: [
            {
              category: "Product Sales",
              slug: "product-sales",
              amount: toMoney(productSales),
            },
            {
              category: "Uncategorized Income",
              slug: "uncategorized-income",
              amount: toMoney(uncategorizedIncome),
            },
          ],
          total: toMoney(revenue),
        },
        cogs: toMoney(cogs),
        costOfGoods: {
          breakdown: [
            {
              category: "Product Purchase",
              slug: "product-purchase",
              amount: toMoney(productPurchase),
            },
          ],
          total: toMoney(cogs),
        },
        grossProfit: toMoney(grossProfit),
        grossProfitPercent: percentage(grossProfit, revenue),
        expenses: {
          breakdown: expenseRows.map((row) => ({
            category: row.categoryName,
            slug: row.categorySlug,
            amount: toMoney(toNumber(row.total)),
          })),
          total: toMoney(totalExpenses),
        },
        netProfit: toMoney(netProfit),
        netProfitPercent: percentage(netProfit, revenue),
      };
    }),
};
