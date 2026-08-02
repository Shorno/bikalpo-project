"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_BILL_STORAGE_KEY = "bikalpo.daybook.bills.v1";

export const DAYBOOK_BILL_EVENT = "bikalpo:daybook-bills-changed";

export type DaybookBillPartyType = "customer" | "supplier";

export type DaybookBillLine = {
  amount: number;
  accountId?: string;
  accountName: string;
  category: string;
  description: string;
  id: string;
  price: number;
  productName: string;
};

export type DaybookBillEntry = {
  amountDue: number;
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
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType: DaybookPaymentAccountType;
  paymentDate: string;
  paymentMethod: DaybookPaymentAccountType;
  previousBillAmount: number;
  referenceNo: string;
  scope: DaybookExpenseScope;
  subtotal: number;
  total: number;
  totalPaid: number;
};

const isBrowser = () => typeof window !== "undefined";

const normalizeBillLine = (line: DaybookBillLine): DaybookBillLine => {
  const price = Number.isFinite(line.price)
    ? line.price
    : Number.isFinite(line.amount)
      ? line.amount
      : 0;
  const accountName = line.accountName || line.category || "Furniture";
  const productName =
    line.productName || line.description || "Furniture Purchased";

  return {
    ...line,
    accountName,
    amount: price,
    category: accountName,
    description: productName,
    price,
    productName,
  };
};

const normalizeBill = (bill: DaybookBillEntry): DaybookBillEntry => {
  const lines = bill.lines.map(normalizeBillLine);
  const subtotal = Number.isFinite(bill.subtotal)
    ? bill.subtotal
    : lines.reduce((sum, line) => sum + line.price, 0);
  const total = Number.isFinite(bill.total) ? bill.total : subtotal;
  const totalPaid = Number.isFinite(bill.totalPaid) ? bill.totalPaid : 0;
  const amountDue = Number.isFinite(bill.amountDue)
    ? bill.amountDue
    : Math.max(total - totalPaid, 0);

  return {
    ...bill,
    amountDue,
    dueDate: bill.dueDate || bill.paymentDate || bill.issueDate,
    issueDate: bill.issueDate || bill.paymentDate || bill.dueDate,
    lines,
    paymentAccountId: bill.paymentAccountId || "cash-on-hand",
    paymentAccountName: bill.paymentAccountName || "Cash on Hand",
    paymentAccountType: bill.paymentAccountType || "cash",
    paymentDate: bill.paymentDate || bill.issueDate || bill.dueDate,
    paymentMethod: bill.paymentMethod || "cash",
    previousBillAmount: Number.isFinite(bill.previousBillAmount)
      ? bill.previousBillAmount
      : 0,
    subtotal,
    total,
    totalPaid,
  };
};

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
    .reduce((sum, bill) => sum + bill.amountDue, 0);
}

export function getDaybookBillTotal(bills: DaybookBillEntry[]) {
  return bills.reduce((sum, bill) => sum + bill.amountDue, 0);
}

export function applyDaybookSupplierBillPayment(input: {
  amount: number;
  scope: DaybookExpenseScope;
  supplierName: string;
}) {
  if (!isBrowser() || input.amount <= 0) {
    return;
  }

  const supplierName = normalizeBillPartyName(input.supplierName);
  if (!supplierName) {
    return;
  }

  let remaining = input.amount;
  const updatedBills = loadDaybookBills().map((bill) => {
    if (
      remaining <= 0 ||
      bill.scope !== input.scope ||
      bill.partyType !== "supplier" ||
      normalizeBillPartyName(bill.partyName) !== supplierName ||
      bill.amountDue <= 0
    ) {
      return bill;
    }

    const applied = Math.min(bill.amountDue, remaining);
    remaining -= applied;

    return normalizeBill({
      ...bill,
      amountDue: Math.max(0, bill.amountDue - applied),
      totalPaid: bill.totalPaid + applied,
    });
  });

  saveDaybookBills(updatedBills);
}

export function createDaybookBillId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
