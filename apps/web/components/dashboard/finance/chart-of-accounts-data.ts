export const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type FinanceCategory = {
  id: string;
  name: string;
  accountType: AccountType;
  isDefault: boolean;
};

export type ChartAccount = {
  id: string;
  name: string;
  accountType: AccountType;
  categoryId: string;
  amount: number;
  description: string;
  isSubaccount: boolean;
  parentAccountId: string;
};

const categoryGroups: Record<AccountType, string[]> = {
  ASSET: [
    "Cash Balance",
    "Accounts Receivable (A/R)",
    "Current Assets",
    "Fixed Assets",
  ],
  LIABILITY: ["Accounts Payable (A/P)", "Current Liabilities"],
  EQUITY: ["Owner's Equity"],
  INCOME: ["Income", "Other Income"],
  EXPENSE: [
    "Expenses",
    "Staff Bonus & Incentives",
    "Staff Salary",
    "Staff Training",
    "Transport & Delivery",
    "Utility Bills (Electricity, Gas, Water)",
    "Warehouse Rent",
    "Accounting & Software Expenses",
    "Advertising & Promotion",
    "Bank Interest & Charges",
    "Cleaning & Hygiene Supplies",
    "Depreciation",
    "Equipment & Maintenance",
    "Health Insurance",
    "Insurance Premium",
    "Internet & Mobile Bill",
    "License & Govt. Fees",
    "Miscellaneous Expenses",
    "Office Stationery & Supplies",
    "Packaging & Shopping Bags",
    "Refreshments & Hospitality",
    "Security Service",
    "Shop Renovation & Repairs",
    "Shop Rent",
  ],
};

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategory[] =
  ACCOUNT_TYPES.flatMap((accountType) =>
    categoryGroups[accountType].map((name) => ({
      id: `${accountType.toLowerCase()}-${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")}`,
      name,
      accountType,
      isDefault: true,
    })),
  );

const getCategoryId = (accountType: AccountType, name: string) => {
  const category = DEFAULT_FINANCE_CATEGORIES.find(
    (item) => item.accountType === accountType && item.name === name,
  );

  if (!category) {
    throw new Error(`Missing default finance category: ${accountType} ${name}`);
  }

  return category.id;
};

export const DUMMY_PARENT_ACCOUNTS = [
  { id: "parent-cash", name: "Main Cash Ledger" },
  { id: "parent-bank", name: "Primary Bank Account" },
  { id: "parent-expense", name: "General Expense Account" },
  { id: "parent-income", name: "Sales Income Account" },
] as const;

export const DEFAULT_CHART_ACCOUNTS: ChartAccount[] = [
  {
    id: "account-cash-on-hand",
    name: "Cash on Hand",
    accountType: "ASSET",
    categoryId: getCategoryId("ASSET", "Cash Balance"),
    amount: 90000,
    description: "Opening shop cash balance",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-receivable",
    name: "Accounts Receivable (A/R)",
    accountType: "ASSET",
    categoryId: getCategoryId("ASSET", "Accounts Receivable (A/R)"),
    amount: 2200,
    description: "Customer balances waiting to be collected",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-inventory",
    name: "Inventory",
    accountType: "ASSET",
    categoryId: getCategoryId("ASSET", "Current Assets"),
    amount: 0,
    description: "Available product inventory",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-payable",
    name: "Accounts Payable (A/P)",
    accountType: "LIABILITY",
    categoryId: getCategoryId("LIABILITY", "Accounts Payable (A/P)"),
    amount: 10400,
    description: "Supplier balances to be paid",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-owner-equity",
    name: "Owner's Equity",
    accountType: "EQUITY",
    categoryId: getCategoryId("EQUITY", "Owner's Equity"),
    amount: 81800,
    description: "Owner retained equity",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-product-sales",
    name: "Product Sales",
    accountType: "INCOME",
    categoryId: getCategoryId("INCOME", "Income"),
    amount: 2200,
    description: "Product sales income",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-uncategorized-income",
    name: "Uncategorized Income",
    accountType: "INCOME",
    categoryId: getCategoryId("INCOME", "Other Income"),
    amount: 90000,
    description: "Income waiting for final category review",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-product-purchase",
    name: "Product Purchase",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Expenses"),
    amount: 1200,
    description: "Product purchase expense",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-staff-salary",
    name: "Staff Salary",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Staff Salary"),
    amount: 0,
    description: "Monthly staff salary tracking",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-shop-rent",
    name: "Shop Rent",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Shop Rent"),
    amount: 0,
    description: "Retail space rent",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-utility-bills",
    name: "Utility Bills",
    accountType: "EXPENSE",
    categoryId: getCategoryId(
      "EXPENSE",
      "Utility Bills (Electricity, Gas, Water)",
    ),
    amount: 0,
    description: "Electricity, gas, and water bills",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-advertising",
    name: "Advertising & Promotion",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Advertising & Promotion"),
    amount: 0,
    description: "Promotional campaign costs",
    isSubaccount: false,
    parentAccountId: "",
  },
];
