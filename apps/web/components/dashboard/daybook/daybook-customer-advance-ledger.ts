"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_CUSTOMER_ADVANCE_STORAGE_KEY =
  "bikalpo.daybook.customer-advances.v1";

export const DAYBOOK_CUSTOMER_ADVANCE_EVENT =
  "bikalpo:daybook-customer-advances-changed";

export type DaybookCustomerAdvanceEntry = {
  advanceType: string;
  amount: number;
  createdAt: string;
  customer: string;
  customerId: string;
  description: string;
  depositAccountId: string;
  depositAccountName: string;
  depositAccountType: DaybookPaymentAccountType;
  id: string;
  isSynced?: boolean;
  notes: string;
  paymentMethod: DaybookPaymentAccountType;
  receiveDate: string;
  referenceNo: string;
  scope: DaybookExpenseScope;
};

const isBrowser = () => typeof window !== "undefined";

const normalizeCustomerAdvance = (
  advance: DaybookCustomerAdvanceEntry,
): DaybookCustomerAdvanceEntry => ({
  ...advance,
  amount: Number.isFinite(advance.amount) ? advance.amount : 0,
  isSynced: Boolean(advance.isSynced),
});

export function loadDaybookCustomerAdvances(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_CUSTOMER_ADVANCE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const advances = JSON.parse(raw) as DaybookCustomerAdvanceEntry[];
    const normalizedAdvances = advances.map(normalizeCustomerAdvance);

    return scope
      ? normalizedAdvances.filter((advance) => advance.scope === scope)
      : normalizedAdvances;
  } catch {
    return [];
  }
}

export function saveDaybookCustomerAdvances(
  advances: DaybookCustomerAdvanceEntry[],
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_CUSTOMER_ADVANCE_STORAGE_KEY,
    JSON.stringify(advances.map(normalizeCustomerAdvance)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_CUSTOMER_ADVANCE_EVENT));
}

export function addDaybookCustomerAdvance(
  advance: DaybookCustomerAdvanceEntry,
) {
  saveDaybookCustomerAdvances([
    ...loadDaybookCustomerAdvances(),
    normalizeCustomerAdvance(advance),
  ]);
}

export function markDaybookCustomerAdvanceSynced(id: string) {
  saveDaybookCustomerAdvances(
    loadDaybookCustomerAdvances().map((advance) =>
      advance.id === id
        ? normalizeCustomerAdvance({ ...advance, isSynced: true })
        : advance,
    ),
  );
}

export function createDaybookCustomerAdvanceId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
