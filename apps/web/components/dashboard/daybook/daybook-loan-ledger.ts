"use client";

import {
  createDaybookExpenseId,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export const DAYBOOK_LOAN_STORAGE_KEY = "bikalpo.daybook.loans-received.v1";

export const DAYBOOK_LOAN_EVENT = "bikalpo:daybook-loans-changed";

export type DaybookLoanLine = {
  amount: number;
  description: string;
  id: string;
  loanType: string;
};

export type DaybookLoanReceivedEntry = {
  createdAt: string;
  id: string;
  isSynced?: boolean;
  lender: string;
  lines: DaybookLoanLine[];
  loanNo: string;
  notes: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType: DaybookPaymentAccountType;
  paymentMethod: DaybookPaymentAccountType;
  receiveDate: string;
  referenceNo: string;
  scope: DaybookExpenseScope;
  total: number;
};

const isBrowser = () => typeof window !== "undefined";

const normalizeLoan = (
  loan: DaybookLoanReceivedEntry,
): DaybookLoanReceivedEntry => ({
  ...loan,
  isSynced: Boolean(loan.isSynced),
  lines: loan.lines.map((line) => ({
    ...line,
    amount: Number.isFinite(line.amount) ? line.amount : 0,
  })),
  total: Number.isFinite(loan.total) ? loan.total : 0,
});

export function loadDaybookLoans(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_LOAN_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const loans = JSON.parse(raw) as DaybookLoanReceivedEntry[];
    const normalizedLoans = loans.map(normalizeLoan);

    return scope
      ? normalizedLoans.filter((loan) => loan.scope === scope)
      : normalizedLoans;
  } catch {
    return [];
  }
}

export function saveDaybookLoans(loans: DaybookLoanReceivedEntry[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_LOAN_STORAGE_KEY,
    JSON.stringify(loans.map(normalizeLoan)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_LOAN_EVENT));
}

export function addDaybookLoan(loan: DaybookLoanReceivedEntry) {
  saveDaybookLoans([...loadDaybookLoans(), normalizeLoan(loan)]);
}

export function markDaybookLoanSynced(id: string) {
  saveDaybookLoans(
    loadDaybookLoans().map((loan) =>
      loan.id === id ? normalizeLoan({ ...loan, isSynced: true }) : loan,
    ),
  );
}

export function createDaybookLoanId(prefix: string) {
  return createDaybookExpenseId(prefix);
}
