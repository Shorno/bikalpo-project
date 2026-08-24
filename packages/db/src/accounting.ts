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
  "supplier_refund_receivable",
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
  supplier_refund_receivable: {
    accountType: "asset",
    label: "Supplier Refund Receivable",
    sortOrder: 65,
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

export const ACCOUNTING_TRANSACTION_TYPES = [
  "opening_stock",
  "owner_capital_invested",
  "fixed_asset_purchase",
  "loan_received",
  "product_purchase_cash",
  "product_purchase_due",
  "supplier_advance_payment",
  "purchase_receipt",
  "supplier_advance_applied",
  "supplier_advance_refunded",
  "supplier_payment",
  "purchase_return_due",
  "purchase_return_paid",
  "supplier_refund_received",
  "product_sale_cash",
  "product_sale_due",
  "customer_advance_payment",
  "operating_expense",
  "owner_drawing",
] as const;

export type AccountingTransactionType =
  (typeof ACCOUNTING_TRANSACTION_TYPES)[number];

export type AccountingTransactionTypeMetadata = {
  label: string;
  phase: "balance_sheet_only" | "profit_and_balance";
  sortOrder: number;
};

export const ACCOUNTING_TRANSACTION_TYPE_METADATA: Record<
  AccountingTransactionType,
  AccountingTransactionTypeMetadata
> = {
  opening_stock: {
    label: "Opening Stock",
    phase: "balance_sheet_only",
    sortOrder: 10,
  },
  owner_capital_invested: {
    label: "Owner Capital Invested",
    phase: "balance_sheet_only",
    sortOrder: 20,
  },
  fixed_asset_purchase: {
    label: "Fixed Asset Purchase",
    phase: "balance_sheet_only",
    sortOrder: 30,
  },
  loan_received: {
    label: "Loan Received",
    phase: "balance_sheet_only",
    sortOrder: 40,
  },
  product_purchase_cash: {
    label: "Product Purchase - Cash",
    phase: "balance_sheet_only",
    sortOrder: 50,
  },
  product_purchase_due: {
    label: "Product Purchase - Due",
    phase: "balance_sheet_only",
    sortOrder: 60,
  },
  supplier_advance_payment: {
    label: "Supplier Advance Payment",
    phase: "balance_sheet_only",
    sortOrder: 70,
  },
  purchase_receipt: {
    label: "Purchase Receipt",
    phase: "balance_sheet_only",
    sortOrder: 72,
  },
  supplier_advance_applied: {
    label: "Supplier Advance Applied",
    phase: "balance_sheet_only",
    sortOrder: 74,
  },
  supplier_advance_refunded: {
    label: "Supplier Advance Refunded",
    phase: "balance_sheet_only",
    sortOrder: 75,
  },
  supplier_payment: {
    label: "Supplier Payment",
    phase: "balance_sheet_only",
    sortOrder: 76,
  },
  purchase_return_due: {
    label: "Purchase Return - Due",
    phase: "balance_sheet_only",
    sortOrder: 78,
  },
  purchase_return_paid: {
    label: "Purchase Return - Paid",
    phase: "balance_sheet_only",
    sortOrder: 79,
  },
  supplier_refund_received: {
    label: "Supplier Refund Received",
    phase: "balance_sheet_only",
    sortOrder: 80,
  },
  product_sale_cash: {
    label: "Product Sale - Cash",
    phase: "profit_and_balance",
    sortOrder: 80,
  },
  product_sale_due: {
    label: "Product Sale - Due",
    phase: "profit_and_balance",
    sortOrder: 90,
  },
  customer_advance_payment: {
    label: "Customer Advance Payment",
    phase: "balance_sheet_only",
    sortOrder: 100,
  },
  operating_expense: {
    label: "Operating Expense",
    phase: "profit_and_balance",
    sortOrder: 110,
  },
  owner_drawing: {
    label: "Owner Drawing",
    phase: "balance_sheet_only",
    sortOrder: 120,
  },
};

export const ACCOUNTING_AMOUNT_FIELDS = [
  "amount",
  "sales_amount",
  "cost_amount",
] as const;

export type AccountingAmountField = (typeof ACCOUNTING_AMOUNT_FIELDS)[number];

export type AccountingPostingRuleLine = {
  accountCode: string;
  amountField: AccountingAmountField;
  side: AccountingNormalBalance;
};

export type AccountingPostingRule = {
  description: string;
  lines: AccountingPostingRuleLine[];
  transactionType: AccountingTransactionType;
};

export const ACCOUNTING_POSTING_RULES: Record<
  AccountingTransactionType,
  AccountingPostingRule
> = {
  opening_stock: {
    description: "Opening stock increases inventory and owner capital.",
    lines: [
      { accountCode: "1003-inventory", amountField: "amount", side: "debit" },
      {
        accountCode: "3001-owner-capital",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "opening_stock",
  },
  owner_capital_invested: {
    description: "Owner investment increases cash and owner capital.",
    lines: [
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "3001-owner-capital",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "owner_capital_invested",
  },
  fixed_asset_purchase: {
    description: "Cash paid for a long-term fixed asset.",
    lines: [
      {
        accountCode: "1501-fixed-assets",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "fixed_asset_purchase",
  },
  loan_received: {
    description: "Loan proceeds increase cash and loan payable.",
    lines: [
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "2501-loan-payable",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "loan_received",
  },
  product_purchase_cash: {
    description: "Cash product purchase increases inventory.",
    lines: [
      {
        accountCode: "1003-inventory",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "product_purchase_cash",
  },
  product_purchase_due: {
    description: "Due product purchase increases inventory and supplier payable.",
    lines: [
      {
        accountCode: "1003-inventory",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "2001-accounts-payable",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "product_purchase_due",
  },
  supplier_advance_payment: {
    description: "Supplier advance is an asset until applied to a purchase.",
    lines: [
      {
        accountCode: "1103-supplier-advance",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "supplier_advance_payment",
  },
  purchase_receipt: {
    description: "Received products create inventory and supplier payable.",
    lines: [
      { accountCode: "1003-inventory", amountField: "amount", side: "debit" },
      { accountCode: "2001-accounts-payable", amountField: "amount", side: "credit" },
    ],
    transactionType: "purchase_receipt",
  },
  supplier_advance_applied: {
    description: "Supplier advance is applied against a recognized payable.",
    lines: [
      { accountCode: "2001-accounts-payable", amountField: "amount", side: "debit" },
      { accountCode: "1103-supplier-advance", amountField: "amount", side: "credit" },
    ],
    transactionType: "supplier_advance_applied",
  },
  supplier_advance_refunded: {
    description: "Refunded supplier advance restores cash and clears the advance.",
    lines: [
      { accountCode: "1001-cash-on-hand", amountField: "amount", side: "debit" },
      { accountCode: "1103-supplier-advance", amountField: "amount", side: "credit" },
    ],
    transactionType: "supplier_advance_refunded",
  },
  supplier_payment: {
    description: "Cash or bank payment settles a supplier payable.",
    lines: [
      { accountCode: "2001-accounts-payable", amountField: "amount", side: "debit" },
      { accountCode: "1001-cash-on-hand", amountField: "amount", side: "credit" },
    ],
    transactionType: "supplier_payment",
  },
  purchase_return_due: {
    description: "Returning unpaid stock reduces supplier payable and inventory.",
    lines: [
      { accountCode: "2001-accounts-payable", amountField: "amount", side: "debit" },
      { accountCode: "1003-inventory", amountField: "amount", side: "credit" },
    ],
    transactionType: "purchase_return_due",
  },
  purchase_return_paid: {
    description: "Returning paid stock creates a receivable from the supplier.",
    lines: [
      { accountCode: "1104-supplier-refund-receivable", amountField: "amount", side: "debit" },
      { accountCode: "1003-inventory", amountField: "amount", side: "credit" },
    ],
    transactionType: "purchase_return_paid",
  },
  supplier_refund_received: {
    description: "Supplier refund receipt clears the supplier refund receivable.",
    lines: [
      { accountCode: "1001-cash-on-hand", amountField: "amount", side: "debit" },
      { accountCode: "1104-supplier-refund-receivable", amountField: "amount", side: "credit" },
    ],
    transactionType: "supplier_refund_received",
  },
  product_sale_cash: {
    description: "Cash sale records revenue and releases sold inventory cost.",
    lines: [
      {
        accountCode: "1001-cash-on-hand",
        amountField: "sales_amount",
        side: "debit",
      },
      {
        accountCode: "5001-product-purchase-cost",
        amountField: "cost_amount",
        side: "debit",
      },
      {
        accountCode: "4001-product-sales",
        amountField: "sales_amount",
        side: "credit",
      },
      {
        accountCode: "1003-inventory",
        amountField: "cost_amount",
        side: "credit",
      },
    ],
    transactionType: "product_sale_cash",
  },
  product_sale_due: {
    description:
      "Due sale creates receivable and releases sold inventory cost.",
    lines: [
      {
        accountCode: "1101-accounts-receivable",
        amountField: "sales_amount",
        side: "debit",
      },
      {
        accountCode: "5001-product-purchase-cost",
        amountField: "cost_amount",
        side: "debit",
      },
      {
        accountCode: "4001-product-sales",
        amountField: "sales_amount",
        side: "credit",
      },
      {
        accountCode: "1003-inventory",
        amountField: "cost_amount",
        side: "credit",
      },
    ],
    transactionType: "product_sale_due",
  },
  customer_advance_payment: {
    description: "Customer advance increases cash and current liability.",
    lines: [
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "2101-customer-advance",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "customer_advance_payment",
  },
  operating_expense: {
    description: "Paid expense reduces cash and increases operating expenses.",
    lines: [
      {
        accountCode: "6001-operating-expenses",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "operating_expense",
  },
  owner_drawing: {
    description: "Owner withdrawal reduces cash and owner equity.",
    lines: [
      {
        accountCode: "3003-owner-drawings",
        amountField: "amount",
        side: "debit",
      },
      {
        accountCode: "1001-cash-on-hand",
        amountField: "amount",
        side: "credit",
      },
    ],
    transactionType: "owner_drawing",
  },
};
