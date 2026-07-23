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
