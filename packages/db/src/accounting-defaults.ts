import type { AccountingAccountType } from "./accounting";

export type DefaultFinanceCategorySeed = {
  accountType: AccountingAccountType;
  code: string;
  description: string;
  name: string;
  sortOrder: number;
};

const expenseCategories = [
  "Staff Bonus & Incentives",
  "Staff Salary",
  "Staff Training",
  "Transport & Delivery",
  "Utility Bills",
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
] as const;

export const DEFAULT_FINANCE_CATEGORY_SEEDS: DefaultFinanceCategorySeed[] = [
  {
    accountType: "asset",
    code: "asset-cash-bank",
    description: "Cash, bank, and immediately available balance accounts.",
    name: "Cash and Bank",
    sortOrder: 10,
  },
  {
    accountType: "asset",
    code: "asset-accounts-receivable",
    description: "Customer balances expected to be collected.",
    name: "Accounts Receivable",
    sortOrder: 20,
  },
  {
    accountType: "asset",
    code: "asset-inventory",
    description: "Product stock value held for sale.",
    name: "Inventory",
    sortOrder: 30,
  },
  {
    accountType: "asset",
    code: "asset-current",
    description: "Other short-term assets.",
    name: "Current Assets",
    sortOrder: 40,
  },
  {
    accountType: "asset",
    code: "asset-fixed",
    description: "Long-term business assets such as furniture and equipment.",
    name: "Fixed Assets",
    sortOrder: 50,
  },
  {
    accountType: "asset",
    code: "asset-supplier-advance",
    description: "Advance payments made to suppliers before bills are applied.",
    name: "Supplier Advance",
    sortOrder: 60,
  },
  {
    accountType: "liability",
    code: "liability-accounts-payable",
    description: "Supplier balances to be paid.",
    name: "Accounts Payable",
    sortOrder: 100,
  },
  {
    accountType: "liability",
    code: "liability-current",
    description: "Other short-term liabilities.",
    name: "Current Liabilities",
    sortOrder: 110,
  },
  {
    accountType: "liability",
    code: "liability-customer-advance",
    description: "Customer advance payments before sales are recognized.",
    name: "Customer Advance",
    sortOrder: 120,
  },
  {
    accountType: "liability",
    code: "liability-loan-payable",
    description: "Outstanding business loans.",
    name: "Loan Payable",
    sortOrder: 130,
  },
  {
    accountType: "equity",
    code: "equity-owner",
    description: "Owner capital and retained equity.",
    name: "Owner's Equity",
    sortOrder: 200,
  },
  {
    accountType: "income",
    code: "income-product",
    description: "Revenue from product sales.",
    name: "Product Income",
    sortOrder: 300,
  },
  {
    accountType: "income",
    code: "income-service",
    description: "Revenue from services.",
    name: "Service Income",
    sortOrder: 310,
  },
  {
    accountType: "income",
    code: "income-other",
    description: "Income that is not regular product or service revenue.",
    name: "Other Income",
    sortOrder: 320,
  },
  {
    accountType: "cogs",
    code: "cogs-product",
    description: "Product purchase cost / cost of goods sold.",
    name: "Cost of Goods Sold",
    sortOrder: 400,
  },
  {
    accountType: "expense",
    code: "expense-operating",
    description: "General operating expense.",
    name: "Operating Expenses",
    sortOrder: 500,
  },
  ...expenseCategories.map((name, index) => ({
    accountType: "expense" as const,
    code: `expense-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    description: `${name} expense category.`,
    name,
    sortOrder: 510 + index,
  })),
];
