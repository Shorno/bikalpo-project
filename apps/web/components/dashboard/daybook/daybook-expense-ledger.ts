"use client";

export const DAYBOOK_EXPENSE_STORAGE_KEY =
  "bikalpo.daybook.cash-bank-expenses.v1";

export const DAYBOOK_EXPENSE_EVENT = "bikalpo:daybook-expenses-changed";

export type DaybookExpenseScope = "retailer" | "warehouse";

export type DaybookPaymentAccountType = "bank" | "cash";

export type DaybookPaymentAccount = {
  balance: number;
  id: string;
  name: string;
  type: DaybookPaymentAccountType;
};

export type DaybookExpenseLine = {
  amount: number;
  category: string;
  description: string;
  id: string;
};

export type DaybookExpenseEntry = {
  createdAt: string;
  id: string;
  memo: string;
  payee: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType: DaybookPaymentAccountType;
  paymentDate: string;
  paymentMethod: string;
  referenceNo: string;
  scope: DaybookExpenseScope;
  total: number;
  lines: DaybookExpenseLine[];
};

export const DAYBOOK_PAYMENT_ACCOUNTS: DaybookPaymentAccount[] = [
  {
    balance: 90_000,
    id: "cash-on-hand",
    name: "Cash on Hand",
    type: "cash",
  },
  {
    balance: 0,
    id: "bank-account",
    name: "Bank Account",
    type: "bank",
  },
];
