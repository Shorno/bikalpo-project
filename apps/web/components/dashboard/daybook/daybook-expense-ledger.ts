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
  isSynced?: boolean;
  memo: string;
  payee: string;
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType: DaybookPaymentAccountType;
  paymentDate: string;
  paymentMethod: string;
  referenceNo: string;
  scope: DaybookExpenseScope;
  serverExpenseIds?: number[];
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

export const DAYBOOK_EXPENSE_CATEGORIES = [
  "Bills / Utilities",
  "Transport & Delivery",
  "Shop Rent",
  "Warehouse Rent",
  "Office Stationery & Supplies",
  "Packaging & Shopping Bags",
  "Staff Salary",
  "Staff Bonus & Incentives",
  "Internet & Mobile Bill",
  "Bank Interest & Charges",
  "Cleaning & Hygiene Supplies",
  "Equipment & Maintenance",
  "Advertising & Promotion",
  "Refreshments & Hospitality",
  "Miscellaneous Expenses",
] as const;

const isBrowser = () => typeof window !== "undefined";

export function detectDaybookExpenseScope(): DaybookExpenseScope {
  if (!isBrowser()) {
    return "retailer";
  }

  const { hostname, pathname } = window.location;
  return hostname.startsWith("warehouse.") || pathname.startsWith("/warehouse")
    ? "warehouse"
    : "retailer";
}

const normalizeEntry = (entry: DaybookExpenseEntry): DaybookExpenseEntry => ({
  ...entry,
  isSynced: Boolean(entry.isSynced),
  serverExpenseIds: Array.isArray(entry.serverExpenseIds)
    ? entry.serverExpenseIds.filter((id) => Number.isFinite(id))
    : [],
  total: Number.isFinite(entry.total) ? entry.total : 0,
  lines: entry.lines.map((line) => ({
    ...line,
    amount: Number.isFinite(line.amount) ? line.amount : 0,
  })),
});

export function loadDaybookExpenses(scope?: DaybookExpenseScope) {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(DAYBOOK_EXPENSE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const entries = JSON.parse(raw) as DaybookExpenseEntry[];
    const normalizedEntries = entries.map(normalizeEntry);

    return scope
      ? normalizedEntries.filter((entry) => entry.scope === scope)
      : normalizedEntries;
  } catch {
    return [];
  }
}

export function saveDaybookExpenses(entries: DaybookExpenseEntry[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    DAYBOOK_EXPENSE_STORAGE_KEY,
    JSON.stringify(entries.map(normalizeEntry)),
  );
  window.dispatchEvent(new CustomEvent(DAYBOOK_EXPENSE_EVENT));
}

export function addDaybookExpense(entry: DaybookExpenseEntry) {
  saveDaybookExpenses([...loadDaybookExpenses(), normalizeEntry(entry)]);
}

export function markDaybookExpenseSynced(
  id: string,
  serverExpenseIds: number[],
) {
  saveDaybookExpenses(
    loadDaybookExpenses().map((entry) =>
      entry.id === id
        ? normalizeEntry({ ...entry, isSynced: true, serverExpenseIds })
        : entry,
    ),
  );
}

export function createDaybookExpenseId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
