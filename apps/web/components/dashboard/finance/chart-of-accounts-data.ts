export const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "COGS",
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
  ASSET: ["Cash and Bank", "Accounts Receivable", "Inventory", "Fixed Assets"],
  LIABILITY: ["Loan", "Accounts Payable", "Tax Payable", "Salary Payable"],
  EQUITY: ["Capital", "Retained Earnings", "Drawings"],
  INCOME: ["Sales Income", "Service Income", "Other Income"],
  COGS: ["Purchase Cost", "Freight", "Manufacturing"],
  EXPENSE: [
    "Salary",
    "Transport & Delivery",
    "Rent",
    "Utility Bills",
    "Bank Charges",
    "Marketing",
    "Office Expense",
    "Maintenance",
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
    categoryId: getCategoryId("ASSET", "Cash and Bank"),
    amount: 90000,
    description: "Opening shop cash balance",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-receivable",
    name: "Customer Receivable",
    accountType: "ASSET",
    categoryId: getCategoryId("ASSET", "Accounts Receivable"),
    amount: 2200,
    description: "Customer balances waiting to be collected",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-inventory",
    name: "Product Inventory",
    accountType: "ASSET",
    categoryId: getCategoryId("ASSET", "Inventory"),
    amount: 0,
    description: "Available product inventory",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-payable",
    name: "Supplier Payable",
    accountType: "LIABILITY",
    categoryId: getCategoryId("LIABILITY", "Accounts Payable"),
    amount: 10400,
    description: "Supplier balances to be paid",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-owner-equity",
    name: "Owner Capital",
    accountType: "EQUITY",
    categoryId: getCategoryId("EQUITY", "Capital"),
    amount: 81800,
    description: "Owner retained equity",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-product-sales",
    name: "Product Sales",
    accountType: "INCOME",
    categoryId: getCategoryId("INCOME", "Sales Income"),
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
    name: "Product Purchase Cost",
    accountType: "COGS",
    categoryId: getCategoryId("COGS", "Purchase Cost"),
    amount: 1200,
    description: "Product purchase expense",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-staff-salary",
    name: "Staff Salary",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Salary"),
    amount: 0,
    description: "Monthly staff salary tracking",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-shop-rent",
    name: "Shop Rent",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Rent"),
    amount: 0,
    description: "Retail space rent",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-utility-bills",
    name: "Utility Bills",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Utility Bills"),
    amount: 0,
    description: "Electricity, gas, and water bills",
    isSubaccount: false,
    parentAccountId: "",
  },
  {
    id: "account-advertising",
    name: "Advertising & Promotion",
    accountType: "EXPENSE",
    categoryId: getCategoryId("EXPENSE", "Marketing"),
    amount: 0,
    description: "Promotional campaign costs",
    isSubaccount: false,
    parentAccountId: "",
  },
];
