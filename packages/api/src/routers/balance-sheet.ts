import { db } from "@bikalpo-project/db";
import {
  deliveryGroupInvoice,
  expense,
  financeAccount,
  financialLedger,
  invoice,
  order,
  purchase,
  warehouseDueCollection,
  warehousePosSale,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const ACTIVE_SALE_STATUSES = new Set(["confirmed", "processing", "delivered"]);
const PAID_INVOICE_STATUSES = new Set(["collected", "settled"]);
const PAYABLE_ORDER_STATUSES = new Set([
  "confirmed",
  "processing",
  "delivered",
]);

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

function isOrderPaid(
  orderPaymentStatus: string | null | undefined,
  invoicePaymentStatus: string | null | undefined,
) {
  return (
    orderPaymentStatus === "paid" ||
    PAID_INVOICE_STATUSES.has(invoicePaymentStatus || "")
  );
}

function isPayableOrder(
  status: string | null | undefined,
  orderPaymentStatus: string | null | undefined,
  invoicePaymentStatus: string | null | undefined,
) {
  return (
    PAYABLE_ORDER_STATUSES.has(status || "") &&
    !isOrderPaid(orderPaymentStatus, invoicePaymentStatus)
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
      const role = context.session.user.role;
      if (role !== "shop_owner" && role !== "warehouse") {
        throw new ORPCError("FORBIDDEN", {
          message: "Balance sheet access required",
        });
      }

      const ownerId = context.session.user.id;
      const ownerType = role === "warehouse" ? "warehouse" : "shop";
      const startDate = input.startDate ?? `${input.year}-01-01`;
      const endDate = input.endDate ?? input.asOfDate ?? `${input.year}-12-31`;
      const startDateTime = new Date(`${startDate}T00:00:00.000`);
      const asOfEnd = new Date(`${endDate}T23:59:59.999`);
      const isCashBasis = input.reportType === "cash";
      const manualPurchaseEntryTypes = isCashBasis
        ? (["purchase_cash"] as const)
        : (["purchase_cash", "purchase_credit"] as const);

      const fixedAssetRows = await db
        .select({
          amount: financeAccount.currentBalance,
          label: financeAccount.name,
        })
        .from(financeAccount)
        .where(
          and(
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            eq(financeAccount.accountType, "asset"),
            eq(financeAccount.balanceSheetLine, "fixed_assets"),
          ),
        )
        .orderBy(asc(financeAccount.sortOrder), asc(financeAccount.name));
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

      const supplierAdvanceRows = await db
        .select({
          amount: financeAccount.currentBalance,
          label: financeAccount.name,
        })
        .from(financeAccount)
        .where(
          and(
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            eq(financeAccount.accountType, "asset"),
            eq(financeAccount.balanceSheetLine, "supplier_advance"),
          ),
        )
        .orderBy(asc(financeAccount.sortOrder), asc(financeAccount.name));
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

      const inventoryRows = await db
        .select({
          amount: financeAccount.currentBalance,
          label: financeAccount.name,
        })
        .from(financeAccount)
        .where(
          and(
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            eq(financeAccount.accountType, "asset"),
            eq(financeAccount.balanceSheetLine, "inventory"),
          ),
        )
        .orderBy(asc(financeAccount.sortOrder), asc(financeAccount.name));
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

      const loanPayableRows = await db
        .select({
          amount: financeAccount.currentBalance,
          label: financeAccount.name,
        })
        .from(financeAccount)
        .where(
          and(
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            eq(financeAccount.accountType, "liability"),
            eq(financeAccount.balanceSheetLine, "loan_payable"),
          ),
        )
        .orderBy(asc(financeAccount.sortOrder), asc(financeAccount.name));
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

      const accountsPayableRows = await db
        .select({
          amount: financeAccount.currentBalance,
          label: financeAccount.name,
        })
        .from(financeAccount)
        .where(
          and(
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            eq(financeAccount.accountType, "liability"),
            eq(financeAccount.balanceSheetLine, "accounts_payable"),
          ),
        )
        .orderBy(asc(financeAccount.sortOrder), asc(financeAccount.name));
      const currentAccountsPayableRows = accountsPayableRows
        .map((row) => ({
          amount: toNumber(row.amount),
          label: row.label,
        }))
        .filter((row) => row.amount !== 0);
      const manualAccountsPayable = isCashBasis
        ? 0
        : currentAccountsPayableRows.reduce((sum, row) => sum + row.amount, 0);

      const accountsReceivableRows = await db
        .select({
          amount: financeAccount.currentBalance,
          label: financeAccount.name,
        })
        .from(financeAccount)
        .where(
          and(
            eq(financeAccount.ownerId, ownerId),
            eq(financeAccount.ownerType, ownerType),
            eq(financeAccount.accountType, "asset"),
            eq(financeAccount.balanceSheetLine, "accounts_receivable"),
          ),
        )
        .orderBy(asc(financeAccount.sortOrder), asc(financeAccount.name));
      const manualAccountsReceivable = isCashBasis
        ? 0
        : accountsReceivableRows.reduce(
            (sum, row) => sum + toNumber(row.amount),
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

      const manualProductPurchaseRows = await db
        .select({ total: financialLedger.amount })
        .from(financialLedger)
        .where(
          and(
            eq(financialLedger.ownerId, ownerId),
            eq(financialLedger.ownerType, ownerType),
            inArray(financialLedger.entryType, manualPurchaseEntryTypes),
            eq(financialLedger.referenceType, "adjustment"),
            gte(financialLedger.createdAt, startDateTime),
            lte(financialLedger.createdAt, asOfEnd),
          ),
        );
      const manualProductPurchase = manualProductPurchaseRows.reduce(
        (sum, row) => sum + toNumber(row.total),
        0,
      );

      let revenue = 0;
      let expenseTotal = expenses + manualProductPurchase;
      let receivable = 0;
      let payable = 0;

      if (role === "warehouse") {
        const [orderRows, purchaseRows, supplierPaymentRows, posRows] =
          await Promise.all([
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
            db
              .select({ amount: financialLedger.amount })
              .from(financialLedger)
              .where(
                and(
                  eq(financialLedger.ownerId, ownerId),
                  eq(financialLedger.ownerType, "warehouse"),
                  eq(financialLedger.referenceType, "supplier_payment"),
                  gte(financialLedger.createdAt, startDateTime),
                  lte(financialLedger.createdAt, asOfEnd),
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

        const purchaseExpense = purchaseRows.reduce((sum, row) => {
          if (isCashBasis && row.paymentType !== "cash") {
            return sum;
          }
          return sum + toNumber(row.total);
        }, 0);
        expenseTotal += purchaseExpense;

        const creditPurchases = purchaseRows.reduce(
          (sum, row) =>
            sum + (row.paymentType === "credit" ? toNumber(row.total) : 0),
          0,
        );
        const supplierPayments = supplierPaymentRows.reduce(
          (sum, row) => sum + toNumber(row.amount),
          0,
        );
        payable = isCashBasis
          ? 0
          : Math.max(0, creditPurchases - supplierPayments);
      } else {
        const [salesRows, purchaseOrderRows] = await Promise.all([
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
                eq(order.shopId, ownerId),
                eq(order.orderType, "b2c"),
                gte(order.createdAt, startDateTime),
                lte(order.createdAt, asOfEnd),
              ),
            ),
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
                eq(order.userId, ownerId),
                eq(order.orderType, "b2b"),
                isNotNull(order.warehouseId),
                gte(order.createdAt, startDateTime),
                lte(order.createdAt, asOfEnd),
              ),
            ),
        ]);

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

        const purchaseExpense = purchaseOrderRows.reduce((sum, row) => {
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
        expenseTotal += purchaseExpense;

        payable = isCashBasis
          ? 0
          : purchaseOrderRows.reduce((sum, row) => {
              if (
                !isPayableOrder(
                  row.status,
                  row.paymentStatus,
                  row.invoicePaymentStatus,
                )
              ) {
                return sum;
              }
              return sum + toNumber(row.total);
            }, 0);
      }

      payable += manualAccountsPayable;
      receivable += manualAccountsReceivable;

      const retainedEarnings = revenue - expenseTotal;
      const cashAndBank =
        retainedEarnings +
        payable +
        loanPayable -
        receivable -
        supplierAdvance -
        inventory -
        fixedAssets;
      const totalAssets =
        cashAndBank + receivable + supplierAdvance + inventory + fixedAssets;
      const totalLiabilities = payable + loanPayable;
      const totalEquity = totalAssets - totalLiabilities;
      const netAssets =
        cashAndBank +
        receivable +
        supplierAdvance +
        inventory +
        fixedAssets -
        payable -
        loanPayable;
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
                rows: [{ label: "Cash on Hand", amount: toMoney(cashAndBank) }],
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
                ],
                total: toMoney(receivable),
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
                  ...currentLoanRows.map((row) => ({
                    label: row.label,
                    amount: toMoney(row.amount),
                  })),
                ],
                total: toMoney(payable + loanPayable),
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
