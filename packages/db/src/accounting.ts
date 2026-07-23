export const ACCOUNTING_ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "income",
  "cogs",
  "expense",
] as const;

export type AccountingAccountType = (typeof ACCOUNTING_ACCOUNT_TYPES)[number];

export const ACCOUNTING_OWNER_TYPES = [
  "warehouse",
  "shop",
  "restaurant",
] as const;

export type AccountingOwnerType = (typeof ACCOUNTING_OWNER_TYPES)[number];

export const ACCOUNTING_NORMAL_BALANCES = ["debit", "credit"] as const;

export type AccountingNormalBalance =
  (typeof ACCOUNTING_NORMAL_BALANCES)[number];

export type AccountingDateRange = {
  endDate: string;
  startDate: string;
};

export type AccountingAccountTypeMetadata = {
  label: string;
  normalBalance: AccountingNormalBalance;
  sortOrder: number;
};

export const ACCOUNTING_ACCOUNT_TYPE_METADATA: Record<
  AccountingAccountType,
  AccountingAccountTypeMetadata
> = {
  asset: {
    label: "Asset",
    normalBalance: "debit",
    sortOrder: 10,
  },
  liability: {
    label: "Liability",
    normalBalance: "credit",
    sortOrder: 20,
  },
  equity: {
    label: "Equity",
    normalBalance: "credit",
    sortOrder: 30,
  },
  income: {
    label: "Income",
    normalBalance: "credit",
    sortOrder: 40,
  },
  cogs: {
    label: "Cost of Goods Sold",
    normalBalance: "debit",
    sortOrder: 50,
  },
  expense: {
    label: "Expense",
    normalBalance: "debit",
    sortOrder: 60,
  },
};
