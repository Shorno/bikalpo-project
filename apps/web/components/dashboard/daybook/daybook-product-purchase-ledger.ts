"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_PRODUCT_PURCHASE_STORAGE_KEY =
  "bikalpo.daybook.product-purchases.v1";

export const DAYBOOK_PRODUCT_PURCHASE_EVENT =
  "bikalpo:daybook-product-purchases-changed";

export type DaybookProductPurchaseItem = {
  amount: number;
  description: string;
  id: string;
  productName: string;
};

export type DaybookProductPurchasePaymentType = "cash" | "due";

export type DaybookProductPurchaseEntry = {
  billNo: string;
  createdAt: string;
  id: string;
  isSynced?: boolean;
  items: DaybookProductPurchaseItem[];
  notes: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType?: DaybookPaymentAccountType;
  paymentDate: string;
  paymentMethod?: DaybookPaymentAccountType;
  paymentType: DaybookProductPurchasePaymentType;
  referenceNo: string;
  scope: DaybookExpenseScope;
  supplier: string;
  total: number;
};

const isBrowser = () => typeof window !== "undefined";

const normalizePurchase = (
  purchase: DaybookProductPurchaseEntry,
): DaybookProductPurchaseEntry => ({
  ...purchase,
  isSynced: Boolean(purchase.isSynced),
  items: purchase.items.map((item) => ({
    ...item,
    amount: Number.isFinite(item.amount) ? item.amount : 0,
  })),
  paymentType: purchase.paymentType ?? "cash",
  total: Number.isFinite(purchase.total) ? purchase.total : 0,
});

export function loadDaybookProductPurchases(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_PRODUCT_PURCHASE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const purchases = JSON.parse(raw) as DaybookProductPurchaseEntry[];
    const normalizedPurchases = purchases.map(normalizePurchase);

    return scope
      ? normalizedPurchases.filter((purchase) => purchase.scope === scope)
      : normalizedPurchases;
  } catch {
    return [];
  }
}

export function saveDaybookProductPurchases(
  purchases: DaybookProductPurchaseEntry[],
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_PRODUCT_PURCHASE_STORAGE_KEY,
    JSON.stringify(purchases.map(normalizePurchase)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_PRODUCT_PURCHASE_EVENT));
}

export function addDaybookProductPurchase(
  purchase: DaybookProductPurchaseEntry,
) {
  saveDaybookProductPurchases([
    ...loadDaybookProductPurchases(),
    normalizePurchase(purchase),
  ]);
}

export function createDaybookProductPurchaseId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
