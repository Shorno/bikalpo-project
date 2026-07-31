"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_PRODUCT_SALE_STORAGE_KEY =
  "bikalpo.daybook.product-sales.v1";

export const DAYBOOK_PRODUCT_SALE_EVENT =
  "bikalpo:daybook-product-sales-changed";

export type DaybookProductSaleItem = {
  description: string;
  id: string;
  productCost: number;
  productName: string;
  saleAmount: number;
};

export type DaybookProductSalePaymentType = "cash" | "due";

export type DaybookProductSaleEntry = {
  createdAt: string;
  customer: string;
  grossProfit: number;
  id: string;
  isSynced?: boolean;
  items: DaybookProductSaleItem[];
  notes: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType?: DaybookPaymentAccountType;
  paymentMethod?: DaybookPaymentAccountType;
  paymentType: DaybookProductSalePaymentType;
  referenceNo: string;
  saleDate: string;
  saleNo: string;
  scope: DaybookExpenseScope;
  totalCost: number;
  totalSales: number;
};

const isBrowser = () => typeof window !== "undefined";

const normalizeSale = (
  sale: DaybookProductSaleEntry,
): DaybookProductSaleEntry => {
  const totalSales = Number.isFinite(sale.totalSales) ? sale.totalSales : 0;
  const totalCost = Number.isFinite(sale.totalCost) ? sale.totalCost : 0;

  return {
    ...sale,
    grossProfit: Number.isFinite(sale.grossProfit)
      ? sale.grossProfit
      : totalSales - totalCost,
    isSynced: Boolean(sale.isSynced),
    items: sale.items.map((item) => ({
      ...item,
      productCost: Number.isFinite(item.productCost) ? item.productCost : 0,
      saleAmount: Number.isFinite(item.saleAmount) ? item.saleAmount : 0,
    })),
    paymentType: sale.paymentType ?? "cash",
    totalCost,
    totalSales,
  };
};

export function loadDaybookProductSales(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_PRODUCT_SALE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const sales = JSON.parse(raw) as DaybookProductSaleEntry[];
    const normalizedSales = sales.map(normalizeSale);

    return scope
      ? normalizedSales.filter((sale) => sale.scope === scope)
      : normalizedSales;
  } catch {
    return [];
  }
}

export function saveDaybookProductSales(sales: DaybookProductSaleEntry[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_PRODUCT_SALE_STORAGE_KEY,
    JSON.stringify(sales.map(normalizeSale)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_PRODUCT_SALE_EVENT));
}

export function addDaybookProductSale(sale: DaybookProductSaleEntry) {
  saveDaybookProductSales([...loadDaybookProductSales(), normalizeSale(sale)]);
}

export function markDaybookProductSaleSynced(id: string) {
  saveDaybookProductSales(
    loadDaybookProductSales().map((sale) =>
      sale.id === id ? normalizeSale({ ...sale, isSynced: true }) : sale,
    ),
  );
}

export function createDaybookProductSaleId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
