"use client";

import type {
  DaybookProductSaleEntry,
  DaybookProductSalePaymentType,
} from "@/components/dashboard/daybook/daybook-product-sale-ledger";

type ProductSaleRange = {
  endDate: string;
  startDate: string;
};

type ProductSaleTotals = {
  cashSales: number;
  dueSales: number;
  grossProfit: number;
  bankSales: number;
  totalCost: number;
  totalSales: number;
};

function parseDateValue(value: string) {
  const date = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSaleInRange(sale: DaybookProductSaleEntry, range: ProductSaleRange) {
  const saleDate = parseDateValue(sale.saleDate);
  const startDate = parseDateValue(range.startDate);
  const endDate = parseDateValue(range.endDate);

  if (!saleDate || !startDate || !endDate) {
    return false;
  }

  return saleDate >= startDate && saleDate <= endDate;
}

function emptyTotals(): ProductSaleTotals {
  return {
    cashSales: 0,
    dueSales: 0,
    grossProfit: 0,
    bankSales: 0,
    totalCost: 0,
    totalSales: 0,
  };
}

export function getUnsyncedDaybookProductSalesInRange(
  sales: DaybookProductSaleEntry[],
  range: ProductSaleRange,
) {
  return sales.filter((sale) => !sale.isSynced && isSaleInRange(sale, range));
}

export function summarizeDaybookProductSales(sales: DaybookProductSaleEntry[]) {
  return sales.reduce<ProductSaleTotals>((totals, sale) => {
    const paymentType: DaybookProductSalePaymentType =
      sale.paymentType ?? "cash";

    totals.totalSales += sale.totalSales;
    totals.totalCost += sale.totalCost;
    totals.grossProfit += sale.grossProfit;

    if (paymentType === "due") {
      totals.dueSales += sale.totalSales;
    } else if (sale.paymentAccountType === "bank") {
      totals.bankSales += sale.totalSales;
    } else {
      totals.cashSales += sale.totalSales;
    }

    return totals;
  }, emptyTotals());
}
