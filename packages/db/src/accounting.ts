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

export const PROFIT_AND_LOSS_LINES = [
  "product_sales",
  "service_income",
  "other_income",
  "total_income",
  "product_purchase_cost",
  "gross_profit",
  "operating_expenses",
  "net_profit",
] as const;

export type ProfitAndLossLine = (typeof PROFIT_AND_LOSS_LINES)[number];

export const BALANCE_SHEET_LINES = [
  "cash_and_bank",
  "accounts_receivable",
  "inventory",
  "other_current_assets",
  "fixed_assets",
  "supplier_advance",
  "accounts_payable",
  "customer_advance",
  "loan_payable",
  "owner_capital",
  "current_year_profit",
  "owner_drawings",
] as const;

export type BalanceSheetLine = (typeof BALANCE_SHEET_LINES)[number];

export type AccountingReportLineMetadata = {
  accountType: AccountingAccountType;
  label: string;
  sortOrder: number;
};

export const PROFIT_AND_LOSS_LINE_METADATA: Record<
  ProfitAndLossLine,
  AccountingReportLineMetadata
> = {
  product_sales: {
    accountType: "income",
    label: "Product Sales",
    sortOrder: 10,
  },
  service_income: {
    accountType: "income",
    label: "Service Income",
    sortOrder: 20,
  },
  other_income: {
    accountType: "income",
    label: "Other Income",
    sortOrder: 30,
  },
  total_income: {
    accountType: "income",
    label: "Total Income",
    sortOrder: 40,
  },
  product_purchase_cost: {
    accountType: "cogs",
    label: "Product Purchase Cost",
    sortOrder: 50,
  },
  gross_profit: {
    accountType: "income",
    label: "Gross Profit",
    sortOrder: 60,
  },
  operating_expenses: {
    accountType: "expense",
    label: "Operating Expenses",
    sortOrder: 70,
  },
  net_profit: {
    accountType: "equity",
    label: "Net Profit",
    sortOrder: 80,
  },
};

export const BALANCE_SHEET_LINE_METADATA: Record<
  BalanceSheetLine,
  AccountingReportLineMetadata
> = {
  cash_and_bank: {
    accountType: "asset",
    label: "Cash & Bank",
    sortOrder: 10,
  },
  accounts_receivable: {
    accountType: "asset",
    label: "Accounts Receivable",
    sortOrder: 20,
  },
  inventory: {
    accountType: "asset",
    label: "Inventory",
    sortOrder: 30,
  },
  other_current_assets: {
    accountType: "asset",
    label: "Other Current Assets",
    sortOrder: 40,
  },
  fixed_assets: {
    accountType: "asset",
    label: "Fixed Assets",
    sortOrder: 50,
  },
  supplier_advance: {
    accountType: "asset",
    label: "Supplier Advance",
    sortOrder: 60,
  },
  accounts_payable: {
    accountType: "liability",
    label: "Accounts Payable",
    sortOrder: 70,
  },
  customer_advance: {
    accountType: "liability",
    label: "Customer Advance",
    sortOrder: 80,
  },
  loan_payable: {
    accountType: "liability",
    label: "Loan Payable",
    sortOrder: 90,
  },
  owner_capital: {
    accountType: "equity",
    label: "Owner Capital",
    sortOrder: 100,
  },
  current_year_profit: {
    accountType: "equity",
    label: "Current Year Profit",
    sortOrder: 110,
  },
  owner_drawings: {
    accountType: "equity",
    label: "Owner Drawings",
    sortOrder: 120,
  },
};
