"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_BILL_STORAGE_KEY = "bikalpo.daybook.bills.v1";

export const DAYBOOK_BILL_EVENT = "bikalpo:daybook-bills-changed";

export type DaybookBillPartyType = "customer" | "supplier";

export type DaybookBillLine = {
  amount: number;
  category: string;
  description: string;
  id: string;
};

export type DaybookBillEntry = {
  billNo: string;
  createdAt: string;
  dueDate: string;
  id: string;
  issueDate: string;
  lines: DaybookBillLine[];
  notes: string;
  partyId: string;
  partyName: string;
  partyType: DaybookBillPartyType;
  previousBillAmount: number;
  referenceNo: string;
  scope: DaybookExpenseScope;
  total: number;
};

const isBrowser = () => typeof window !== "undefined";

const normalizeBill = (bill: DaybookBillEntry): DaybookBillEntry => ({
  ...bill,
  lines: bill.lines.map((line) => ({
    ...line,
    amount: Number.isFinite(line.amount) ? line.amount : 0,
  })),
  previousBillAmount: Number.isFinite(bill.previousBillAmount)
    ? bill.previousBillAmount
    : 0,
  total: Number.isFinite(bill.total) ? bill.total : 0,
});

export function loadDaybookBills(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_BILL_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const bills = JSON.parse(raw) as DaybookBillEntry[];
    const normalizedBills = bills.map(normalizeBill);

    return scope
      ? normalizedBills.filter((bill) => bill.scope === scope)
      : normalizedBills;
  } catch {
    return [];
  }
}

export function saveDaybookBills(bills: DaybookBillEntry[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_BILL_STORAGE_KEY,
    JSON.stringify(bills.map(normalizeBill)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_BILL_EVENT));
}

export function addDaybookBill(bill: DaybookBillEntry) {
  saveDaybookBills([...loadDaybookBills(), normalizeBill(bill)]);
}

export function normalizeBillPartyName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getDaybookBillPartyBalance(
  bills: DaybookBillEntry[],
  input: {
    partyName: string;
    partyType: DaybookBillPartyType;
  },
) {
  const partyName = normalizeBillPartyName(input.partyName);

  if (!partyName) {
    return 0;
  }

  return bills
    .filter(
      (bill) =>
        bill.partyType === input.partyType &&
        normalizeBillPartyName(bill.partyName) === partyName,
    )
    .reduce((sum, bill) => sum + bill.total, 0);
}

export function getDaybookBillTotal(bills: DaybookBillEntry[]) {
  return bills.reduce((sum, bill) => sum + bill.total, 0);
}

export function createDaybookBillId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
