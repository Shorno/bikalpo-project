"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_SUPPLIER_ADVANCE_STORAGE_KEY =
  "bikalpo.daybook.supplier-advances.v1";

export const DAYBOOK_SUPPLIER_ADVANCE_EVENT =
  "bikalpo:daybook-supplier-advances-changed";

export type DaybookSupplierAdvanceEntry = {
  advanceNo: string;
  amount: number;
  createdAt: string;
  id: string;
  isSynced?: boolean;
  notes: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType: DaybookPaymentAccountType;
  paymentDate: string;
  paymentMethod: DaybookPaymentAccountType;
  referenceNo: string;
  scope: DaybookExpenseScope;
  supplier: string;
};

const isBrowser = () => typeof window !== "undefined";

const normalizeSupplierAdvance = (
  advance: DaybookSupplierAdvanceEntry,
): DaybookSupplierAdvanceEntry => ({
  ...advance,
  amount: Number.isFinite(advance.amount) ? advance.amount : 0,
  isSynced: Boolean(advance.isSynced),
});

export function loadDaybookSupplierAdvances(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_SUPPLIER_ADVANCE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const advances = JSON.parse(raw) as DaybookSupplierAdvanceEntry[];
    const normalizedAdvances = advances.map(normalizeSupplierAdvance);

    return scope
      ? normalizedAdvances.filter((advance) => advance.scope === scope)
      : normalizedAdvances;
  } catch {
    return [];
  }
}

export function saveDaybookSupplierAdvances(
  advances: DaybookSupplierAdvanceEntry[],
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_SUPPLIER_ADVANCE_STORAGE_KEY,
    JSON.stringify(advances.map(normalizeSupplierAdvance)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_SUPPLIER_ADVANCE_EVENT));
}

export function addDaybookSupplierAdvance(
  advance: DaybookSupplierAdvanceEntry,
) {
  saveDaybookSupplierAdvances([
    ...loadDaybookSupplierAdvances(),
    normalizeSupplierAdvance(advance),
  ]);
}

export function markDaybookSupplierAdvanceSynced(id: string) {
  saveDaybookSupplierAdvances(
    loadDaybookSupplierAdvances().map((advance) =>
      advance.id === id
        ? normalizeSupplierAdvance({ ...advance, isSynced: true })
        : advance,
    ),
  );
}

export function createDaybookSupplierAdvanceId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
