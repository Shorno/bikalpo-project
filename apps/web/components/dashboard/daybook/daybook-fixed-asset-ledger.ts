"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_FIXED_ASSET_STORAGE_KEY =
  "bikalpo.daybook.fixed-asset-purchases.v1";

export const DAYBOOK_FIXED_ASSET_EVENT =
  "bikalpo:daybook-fixed-assets-changed";

export type DaybookFixedAssetLine = {
  accountId: string;
  accountName: string;
  amount: number;
  id: string;
  productName: string;
};

export type DaybookFixedAssetPurchase = {
  billNo: string;
  createdAt: string;
  id: string;
  isSynced?: boolean;
  lines: DaybookFixedAssetLine[];
  notes: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType: DaybookPaymentAccountType;
  paymentDate: string;
  paymentMethod: DaybookPaymentAccountType;
  referenceNo: string;
  scope: DaybookExpenseScope;
  supplier: string;
  total: number;
};

const isBrowser = () => typeof window !== "undefined";

const normalizePurchase = (
  purchase: DaybookFixedAssetPurchase,
): DaybookFixedAssetPurchase => ({
  ...purchase,
  isSynced: Boolean(purchase.isSynced),
  total: Number.isFinite(purchase.total) ? purchase.total : 0,
  lines: purchase.lines.map((line) => ({
    ...line,
    amount: Number.isFinite(line.amount) ? line.amount : 0,
  })),
});

export function loadDaybookFixedAssetPurchases(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_FIXED_ASSET_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const purchases = JSON.parse(raw) as DaybookFixedAssetPurchase[];
    const normalizedPurchases = purchases.map(normalizePurchase);

    return scope
      ? normalizedPurchases.filter((purchase) => purchase.scope === scope)
      : normalizedPurchases;
  } catch {
    return [];
  }
}

export function saveDaybookFixedAssetPurchases(
  purchases: DaybookFixedAssetPurchase[],
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_FIXED_ASSET_STORAGE_KEY,
    JSON.stringify(purchases.map(normalizePurchase)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_FIXED_ASSET_EVENT));
}

export function addDaybookFixedAssetPurchase(
  purchase: DaybookFixedAssetPurchase,
) {
  saveDaybookFixedAssetPurchases([
    ...loadDaybookFixedAssetPurchases(),
    normalizePurchase(purchase),
  ]);
}

export function createDaybookFixedAssetId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
