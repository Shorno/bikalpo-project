import { db } from "@bikalpo-project/db";
import {
  deliveryGroupInvoice,
  expense,
  financeAccount,
  financePaymentAccount,
  financialLedger,
  invoice,
  order,
  warehouseDueCollection,
  warehousePosSale,
} from "@bikalpo-project/db/schema";
import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { shopOrWarehouseOwnerScope } from "../shop-portal-scope";

const ACTIVE_SALE_STATUSES = new Set(["confirmed", "processing", "delivered"]);
const PAID_INVOICE_STATUSES = new Set(["collected", "settled"]);

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function signedProfitLossAmount(input: {
  amount: number;
  direction: "credit" | "debit";
  normalBalance: "credit" | "debit";
}) {
  return input.direction === input.normalBalance ? input.amount : -input.amount;
}

function getCashAndBankRows(rows: Array<{ amount: number; label: string }>) {
  return rows.length > 0 ? rows : [{ amount: 0, label: "Cash on Hand" }];
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

function formatReportDate(value: string) {
  const [rawYear, rawMonth, rawDay] = value.split("-");
  const year = Number.parseInt(rawYear ?? "", 10);
  const month = Number.parseInt(rawMonth ?? "", 10);
  const day = Number.parseInt(rawDay ?? "", 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function withinActiveSales(status: string | null | undefined) {
  return ACTIVE_SALE_STATUSES.has(status || "");
}

export const balanceSheetRouter = {
  getBalanceSheet: protectedProcedure
    .route({
      method: "POST",
      path: "/balance-sheet",
      tags: ["Balance Sheet"],
      summary: "Balance sheet",
      description: "As-of balance sheet for warehouse and retailer accounts",
    })
    .input(
      z.object({
        year: z.number().int().min(2020).max(2100),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        asOfDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        reportType: z.enum(["accrual", "cash"]).default("accrual"),
      }),
    )
    .handler(async ({ context, input }) => {
      const { ownerId, ownerType } = shopOrWarehouseOwnerScope(
        context.session.user,
        "finance",
      );
      const startDate = input.startDate ?? `${input.year}-01-01`;
      const endDate = input.endDate ?? input.asOfDate ?? `${input.year}-12-31`;
      const startDateTime = new Date(`${startDate}T00:00:00.000`);
      const asOfEnd = new Date(`${endDate}T23:59:59.999`);
      const isCashBasis = input.reportType === "cash";
      const cashBankRows = await db
        .select({
          amount: financePaymentAccount.currentBalance,
          label: financePaymentAccount.name,
        })
        .from(financePaymentAccount)
        .where(
          and(
            eq(financePaymentAccount.ownerId, ownerId),
            eq(financePaymentAccount.ownerType, ownerType),
            eq(financePaymentAccount.isActive, true),
            inArray(financePaymentAccount.type, ["cash", "bank"]),
          ),
        )
        .orderBy(
          asc(financePaymentAccount.type),
          asc(financePaymentAccount.name),
        );
      const currentCashBankRows = cashBankRows.map((row) => ({
        amount: toNumber(row.amount),
        label: row.label,
      }));

      const balanceSheetAccountRows = await db
        .select({
          amount: financeAccount.currentBalance,
          accountType: financeAccount.accountType,
          balanceSheetLine: financeAccount.balanceSheetLine,
          label: financeAccount.name,
          normalBalance: financeAccount.normalBalance,
        })
        .from(financeAccount)
        .where(
          and(
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            inArray(financeAccount.balanceSheetLine, [
              "fixed_assets",
              "supplier_advance",
              "supplier_refund_receivable",
              "inventory",
              "loan_payable",
              "customer_advance",
              "accounts_payable",
              "accounts_receivable",
              "owner_capital",
              "owner_drawings",
            ]),
          ),
        )
        .orderBy(asc(financeAccount.sortOrder), asc(financeAccount.name));
      const fixedAssetRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "asset" &&
          row.balanceSheetLine === "fixed_assets",
      );
      const longTermAssetRows = fixedAssetRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const fixedAssets = longTermAssetRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      const supplierAdvanceRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "asset" &&
          row.balanceSheetLine === "supplier_advance",
      );
      const currentSupplierAdvanceRows = supplierAdvanceRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const supplierAdvance = currentSupplierAdvanceRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      const supplierRefundRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "asset" &&
          row.balanceSheetLine === "supplier_refund_receivable",
      );
      const currentSupplierRefundRows = supplierRefundRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const supplierRefundReceivable = currentSupplierRefundRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      const inventoryRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "asset" && row.balanceSheetLine === "inventory",
      );
      const currentInventoryRows = inventoryRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const inventory = currentInventoryRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      const loanPayableRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "liability" &&
          row.balanceSheetLine === "loan_payable",
      );
      const currentLoanRows = loanPayableRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const loanPayable = currentLoanRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      const customerAdvanceRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "liability" &&
          row.balanceSheetLine === "customer_advance",
      );
      const currentCustomerAdvanceRows = customerAdvanceRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const customerAdvance = currentCustomerAdvanceRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      const accountsPayableRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "liability" &&
          row.balanceSheetLine === "accounts_payable",
      );
      const currentAccountsPayableRows = accountsPayableRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const manualAccountsPayable = isCashBasis
        ? 0
        : currentAccountsPayableRows.reduce((sum, row) => sum + row.amount, 0);

      const accountsReceivableRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "asset" &&
          row.balanceSheetLine === "accounts_receivable",
      );
      const manualAccountsReceivable = isCashBasis
        ? 0
        : accountsReceivableRows.reduce(
            (sum, row) => sum + toNumber(row.amount),
            0,
          );

      const equityRows = balanceSheetAccountRows.filter(
        (row) =>
          row.accountType === "equity" &&
          (row.balanceSheetLine === "owner_capital" ||
            row.balanceSheetLine === "owner_drawings"),
      );
      const currentEquityRows = equityRows
        .map((row) => {
          const amount = toNumber(row.amount);
          const signedAmount =
            row.balanceSheetLine === "owner_drawings" ||
            row.normalBalance === "debit"
              ? -Math.abs(amount)
              : amount;

          return {
            amount: signedAmount,
            label: row.label,
          };
        })
        .filter((row) => Math.abs(row.amount) >= 0.005);
      const currentEquity = currentEquityRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      const expenseRows = await db
        .select({ total: expense.amount })
        .from(expense)
        .where(
          and(
            eq(expense.ownerId, ownerId),
            eq(expense.ownerType, ownerType),
            eq(expense.isVoided, false),
            gte(expense.paymentDate, startDate),
            lte(expense.paymentDate, endDate),
          ),
        );

      const expenses = expenseRows.reduce(
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
            lte(financialLedger.createdAt, asOfEnd),
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
      const centralProfitLossRows = await db
        .select({
          direction: financialLedger.direction,
          line: financeAccount.profitAndLossLine,
          normalBalance: financeAccount.normalBalance,
          total: financialLedger.amount,
        })
        .from(financialLedger)
        .innerJoin(
          financeAccount,
          eq(financialLedger.referenceId, financeAccount.id),
        )
        .where(
          and(
            eq(financialLedger.ownerId, ownerId),
            eq(financialLedger.ownerType, ownerType),
            eq(financialLedger.entryType, "adjustment"),
            eq(financialLedger.referenceType, "adjustment"),
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            isNotNull(financeAccount.profitAndLossLine),
            gte(financialLedger.createdAt, startDateTime),
            lte(financialLedger.createdAt, asOfEnd),
            sql`(${financialLedger.description} ILIKE 'Money In%' OR ${financialLedger.description} ILIKE 'Money Out%' OR ${financialLedger.description} ILIKE 'Bill due%' OR ${financialLedger.description} ILIKE 'Bill paid%')`,
          ),
        );
      const centralProfitLoss = centralProfitLossRows.reduce(
        (totals, row) => {
          const signedAmount = signedProfitLossAmount({
            amount: toNumber(row.total),
            direction: row.direction,
            normalBalance: row.normalBalance,
          });

          if (
            row.line === "product_sales" ||
            row.line === "service_income" ||
            row.line === "other_income"
          ) {
            totals.revenue += signedAmount;
          } else if (
            row.line === "product_purchase_cost" ||
            row.line === "operating_expenses"
          ) {
            totals.expense += signedAmount;
          }

          return totals;
        },
        { expense: 0, revenue: 0 },
      );

      let revenue = 0;
      let expenseTotal = expenses;
      let receivable = 0;
      let payable = 0;

      if (ownerType === "warehouse") {
        const [orderRows, posRows] = await Promise.all([
          db
            .select({
              total: order.total,
              status: order.status,
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
                gte(order.createdAt, startDateTime),
                lte(order.createdAt, asOfEnd),
              ),
            ),
          db
            .select({
              due: warehousePosSale.due,
              paid: warehousePosSale.paid,
              total: warehousePosSale.total,
            })
            .from(warehousePosSale)
            .where(
              and(
                eq(warehousePosSale.warehouseId, ownerId),
                eq(warehousePosSale.status, "completed"),
                gte(warehousePosSale.createdAt, startDateTime),
                lte(warehousePosSale.createdAt, asOfEnd),
              ),
            ),
        ]);

        const invoiceRows = await db
          .select({
            id: invoice.id,
            grandTotal: invoice.grandTotal,
            paymentStatus: invoice.paymentStatus,
          })
          .from(invoice)
          .innerJoin(order, eq(invoice.orderId, order.id))
          .where(
            and(
              eq(order.warehouseId, ownerId),
              eq(order.orderType, "b2b"),
              eq(invoice.invoiceType, "main"),
              gte(invoice.createdAt, startDateTime),
              lte(invoice.createdAt, asOfEnd),
            ),
          );

        const invoiceIds = invoiceRows.map((row) => row.id);
        const [deliveryPayments, dueCollections] = await Promise.all([
          invoiceIds.length
            ? db
                .select({
                  invoiceId: deliveryGroupInvoice.invoiceId,
                  amount: deliveryGroupInvoice.amountCollected,
                })
                .from(deliveryGroupInvoice)
                .where(
                  and(
                    inArray(deliveryGroupInvoice.invoiceId, invoiceIds),
                    gte(deliveryGroupInvoice.createdAt, startDateTime),
                    lte(deliveryGroupInvoice.createdAt, asOfEnd),
                  ),
                )
            : Promise.resolve([]),
          invoiceIds.length
            ? db
                .select({
                  invoiceId: warehouseDueCollection.invoiceId,
                  amount: warehouseDueCollection.amount,
                })
                .from(warehouseDueCollection)
                .where(
                  and(
                    inArray(warehouseDueCollection.invoiceId, invoiceIds),
                    gte(warehouseDueCollection.createdAt, startDateTime),
                    lte(warehouseDueCollection.createdAt, asOfEnd),
                  ),
                )
            : Promise.resolve([]),
        ]);

        const paidByInvoice = new Map<number, number>();
        for (const payment of deliveryPayments) {
          const amount = toNumber(payment.amount);
          if (amount <= 0) {
            continue;
          }
          paidByInvoice.set(
            payment.invoiceId,
            (paidByInvoice.get(payment.invoiceId) ?? 0) + amount,
          );
        }
        for (const collection of dueCollections) {
          const amount = toNumber(collection.amount);
          if (amount <= 0) {
            continue;
          }
          paidByInvoice.set(
            collection.invoiceId,
            (paidByInvoice.get(collection.invoiceId) ?? 0) + amount,
          );
        }

        const invoiceDue = invoiceRows.reduce((sum, row) => {
          const total = toNumber(row.grandTotal);
          const paid = PAID_INVOICE_STATUSES.has(row.paymentStatus)
            ? total
            : (paidByInvoice.get(row.id) ?? 0);
          return sum + Math.max(0, total - paid);
        }, 0);

        const orderRevenue = orderRows.reduce((sum, row) => {
          if (!withinActiveSales(row.status)) {
            return sum;
          }
          if (
            isCashBasis &&
            !isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
          ) {
            return sum;
          }
          return sum + toNumber(row.total);
        }, 0);
        const posRevenue = posRows.reduce(
          (sum, row) => sum + toNumber(isCashBasis ? row.paid : row.total),
          0,
        );
        const posDue = posRows.reduce(
          (sum, row) => sum + Math.max(0, toNumber(row.due)),
          0,
        );

        revenue = orderRevenue + posRevenue;
        receivable = isCashBasis ? 0 : invoiceDue + posDue;
      } else {
        const salesRows = await db
          .select({
            total: order.total,
            status: order.status,
            paymentStatus: order.paymentStatus,
            invoicePaymentStatus: invoice.paymentStatus,
          })
          .from(order)
          .leftJoin(
            invoice,
            and(eq(invoice.orderId, order.id), eq(invoice.invoiceType, "main")),
          )
          .where(
            and(
              eq(order.shopId, ownerId),
              eq(order.orderType, "b2c"),
              gte(order.createdAt, startDateTime),
              lte(order.createdAt, asOfEnd),
            ),
          );

        revenue = salesRows.reduce((sum, row) => {
          if (!withinActiveSales(row.status)) {
            return sum;
          }
          if (
            isCashBasis &&
            !isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
          ) {
            return sum;
          }
          return sum + toNumber(row.total);
        }, 0);

        receivable = isCashBasis
          ? 0
          : salesRows.reduce((sum, row) => {
              if (!withinActiveSales(row.status)) {
                return sum;
              }
              if (isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)) {
                return sum;
              }
              return sum + toNumber(row.total);
            }, 0);
      }

      payable += manualAccountsPayable;
      receivable += manualAccountsReceivable;
      revenue += manualProductSales + centralProfitLoss.revenue;
      expenseTotal += manualProductSaleCost + centralProfitLoss.expense;

      const retainedEarnings = revenue - expenseTotal;
      const displayedCashBankRows = getCashAndBankRows(currentCashBankRows);
      const cashAndBank = displayedCashBankRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );
      const totalAssets =
        cashAndBank +
        receivable +
        supplierAdvance +
        supplierRefundReceivable +
        inventory +
        fixedAssets;
      const totalLiabilities = payable + customerAdvance + loanPayable;
      const netAssets = totalAssets - totalLiabilities;
      const openingBalanceEquity = netAssets - currentEquity - retainedEarnings;
      const ownerEquityRows =
        Math.abs(openingBalanceEquity) >= 0.005
          ? [
              ...currentEquityRows,
              {
                label: "Opening Balance Equity",
                amount: openingBalanceEquity,
              },
            ]
          : currentEquityRows;
      const ownerCapital = ownerEquityRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );
      const totalEquity = ownerCapital + retainedEarnings;
      const asOfLabel = formatReportDate(endDate);
      const startLabel = formatReportDate(startDate);

      return {
        period: {
          asOfDate: endDate,
          asOfLabel,
          endDate,
          reportType: input.reportType,
          startDate,
          year: input.year,
          yearLabel: startLabel,
          yearStart: startDate,
        },
        summary: {
          cashAndBank: toMoney(cashAndBank),
          inventory: toMoney(inventory),
          receivable: toMoney(receivable),
          supplierAdvance: toMoney(supplierAdvance),
          supplierRefundReceivable: toMoney(supplierRefundReceivable),
          customerAdvance: toMoney(customerAdvance),
          payable: toMoney(payable),
          netAssets: toMoney(netAssets),
          retainedEarnings: toMoney(retainedEarnings),
          totalAssets: toMoney(totalAssets),
          totalLiabilities: toMoney(totalLiabilities),
          totalEquity: toMoney(totalEquity),
        },
        sections: [
          {
            title: "Assets",
            groups: [
              {
                title: "Cash and Bank",
                rows: displayedCashBankRows.map((row) => ({
                  label: row.label,
                  amount: toMoney(row.amount),
                  muted: row.amount === 0,
                })),
                total: toMoney(cashAndBank),
                totalLabel: "Total Cash and Bank",
              },
              {
                title: "Inventory",
                rows:
                  currentInventoryRows.length > 0
                    ? currentInventoryRows.map((row) => ({
                        label: row.label,
                        amount: toMoney(row.amount),
                      }))
                    : [
                        {
                          label: "Inventory",
                          amount: toMoney(0),
                          muted: true,
                        },
                      ],
                total: toMoney(inventory),
                totalLabel: "Total Inventory",
              },
              {
                title: "Supplier Advance",
                rows:
                  currentSupplierAdvanceRows.length > 0
                    ? currentSupplierAdvanceRows.map((row) => ({
                        label: row.label,
                        amount: toMoney(row.amount),
                      }))
                    : [
                        {
                          label: "Supplier Advance",
                          amount: toMoney(0),
                          muted: true,
                        },
                      ],
                total: toMoney(supplierAdvance),
                totalLabel: "Total Supplier Advance",
              },
              {
                title: "Other Current Assets",
                rows: [
                  {
                    label: "Accounts Receivable",
                    amount: toMoney(receivable),
                  },
                  ...currentSupplierRefundRows.map((row) => ({
                    label: row.label,
                    amount: toMoney(row.amount),
                  })),
                ],
                total: toMoney(receivable + supplierRefundReceivable),
                totalLabel: "Total Other Current Assets",
              },
              {
                title: "Long-term Assets",
                rows:
                  longTermAssetRows.length > 0
                    ? longTermAssetRows.map((row) => ({
                        label: row.label,
                        amount: toMoney(row.amount),
                      }))
                    : [
                        {
                          label: "Other Long-term Assets",
                          amount: toMoney(0),
                          muted: true,
                        },
                      ],
                total: toMoney(fixedAssets),
                totalLabel: "Total Long-term Assets",
              },
            ],
            total: toMoney(totalAssets),
            totalLabel: "Total Assets",
          },
          {
            title: "Liabilities",
            groups: [
              {
                title: "Current Liabilities",
                rows: [
                  { label: "Accounts Payable", amount: toMoney(payable) },
                  ...currentCustomerAdvanceRows.map((row) => ({
                    label: row.label,
                    amount: toMoney(row.amount),
                  })),
                  ...currentLoanRows.map((row) => ({
                    label: row.label,
                    amount: toMoney(row.amount),
                  })),
                ],
                total: toMoney(payable + customerAdvance + loanPayable),
                totalLabel: "Total Current Liabilities",
              },
              {
                title: "Long-term Liabilities",
                rows: [
                  {
                    label: "Bank Loan",
                    amount: toMoney(0),
                    muted: true,
                  },
                ],
                total: toMoney(0),
                totalLabel: "Total Long-term Liabilities",
              },
            ],
            total: toMoney(totalLiabilities),
            totalLabel: "Total Liabilities",
          },
          {
            title: "Equity",
            groups: [
              {
                title: "Owner Equity",
                rows: ownerEquityRows.map((row) => ({
                  label: row.label,
                  amount: toMoney(row.amount),
                })),
                total: toMoney(ownerCapital),
                totalLabel: "Total Owner Equity",
              },
              {
                title: "Retained Earnings",
                rows: [
                  {
                    label: `Profit between ${startLabel} and ${asOfLabel}`,
                    amount: toMoney(retainedEarnings),
                  },
                ],
                total: toMoney(retainedEarnings),
                totalLabel: "Total Retained Earnings",
              },
            ],
            total: toMoney(totalEquity),
            totalLabel: "Total Equity",
          },
        ],
      };
    }),
};
