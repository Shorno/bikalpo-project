import {
  ACCOUNTING_POSTING_RULES,
  type AccountingAccountType,
  type AccountingNormalBalance,
  type BalanceSheetLine,
  type ProfitAndLossLine,
} from "./accounting";

export type DefaultFinanceCategorySeed = {
  accountType: AccountingAccountType;
  code: string;
  description: string;
  name: string;
  sortOrder: number;
};

export type DefaultFinanceAccountSeed = {
  accountType: AccountingAccountType;
  balanceSheetLine?: BalanceSheetLine;
  categoryCode: string;
  code: string;
  description: string;
  isPaymentAccount: boolean;
  name: string;
  normalBalance: AccountingNormalBalance;
  openingBalance: string;
  profitAndLossLine?: ProfitAndLossLine;
  sortOrder: number;
};

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
    code: "liability-tax-payable",
    description: "VAT, income tax, and advance tax payable balances.",
    name: "Tax Payable",
    sortOrder: 105,
  },
  {
    accountType: "liability",
    code: "liability-salary-payable",
    description: "Accrued salary and staff payment obligations.",
    name: "Salary Payable",
    sortOrder: 106,
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
    name: "Loan",
    sortOrder: 130,
  },
  {
    accountType: "equity",
    code: "equity-owner",
    description: "Owner capital contributions.",
    name: "Capital",
    sortOrder: 200,
  },
  {
    accountType: "equity",
    code: "equity-retained-earnings",
    description: "Retained profit kept inside the business.",
    name: "Retained Earnings",
    sortOrder: 210,
  },
  {
    accountType: "equity",
    code: "equity-drawings",
    description: "Owner withdrawals from the business.",
    name: "Drawings",
    sortOrder: 220,
  },
  {
    accountType: "income",
    code: "income-product",
    description: "Revenue from product sales.",
    name: "Sales Income",
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
    name: "Purchase Cost",
    sortOrder: 400,
  },
  {
    accountType: "cogs",
    code: "cogs-freight",
    description: "Inbound freight and loading cost of sales.",
    name: "Freight",
    sortOrder: 410,
  },
  {
    accountType: "cogs",
    code: "cogs-manufacturing",
    description: "Direct production and manufacturing cost of sales.",
    name: "Manufacturing",
    sortOrder: 420,
  },
  {
    accountType: "expense",
    code: "expense-salary",
    description: "Staff, sales, delivery, and management salaries.",
    name: "Salary",
    sortOrder: 500,
  },
  {
    accountType: "expense",
    code: "expense-transport-delivery",
    description: "Transport, vehicle, courier, and delivery expenses.",
    name: "Transport & Delivery",
    sortOrder: 510,
  },
  {
    accountType: "expense",
    code: "expense-rent",
    description: "Shop, warehouse, and office rent.",
    name: "Rent",
    sortOrder: 520,
  },
  {
    accountType: "expense",
    code: "expense-utility-bills",
    description: "Electricity, gas, water, internet, and mobile bills.",
    name: "Utility Bills",
    sortOrder: 530,
  },
  {
    accountType: "expense",
    code: "expense-bank-charges",
    description: "Bank charges, interest, and SMS banking fees.",
    name: "Bank Charges",
    sortOrder: 540,
  },
  {
    accountType: "expense",
    code: "expense-marketing",
    description: "Advertising, printing, and promotional expenses.",
    name: "Marketing",
    sortOrder: 550,
  },
  {
    accountType: "expense",
    code: "expense-office",
    description: "Office stationery, supplies, internet, and mobile bills.",
    name: "Office Expense",
    sortOrder: 560,
  },
  {
    accountType: "expense",
    code: "expense-maintenance",
    description: "Equipment, computer, vehicle, and building repair costs.",
    name: "Maintenance",
    sortOrder: 570,
  },
  {
    accountType: "expense",
    code: "expense-operating",
    description: "General operating expense.",
    name: "Operating Expenses",
    sortOrder: 580,
  },
];

export const DEFAULT_FINANCE_ACCOUNT_SEEDS: DefaultFinanceAccountSeed[] = [
  {
    accountType: "asset",
    balanceSheetLine: "cash_and_bank",
    categoryCode: "asset-cash-bank",
    code: "1001-cash-on-hand",
    description: "Default cash account for payments and income.",
    isPaymentAccount: true,
    name: "Cash on Hand",
    normalBalance: "debit",
    openingBalance: "0.00",
    sortOrder: 10,
  },
  {
    accountType: "asset",
    balanceSheetLine: "cash_and_bank",
    categoryCode: "asset-cash-bank",
    code: "1002-petty-cash",
    description: "Small cash balance for minor expenses.",
    isPaymentAccount: true,
    name: "Petty Cash",
    normalBalance: "debit",
    openingBalance: "0.00",
    sortOrder: 20,
  },
  ...(
    [
      ["1003-dutch-bangla-bank", "Dutch-Bangla Bank"],
      ["1004-brac-bank", "BRAC Bank"],
      ["1005-islami-bank", "Islami Bank"],
      ["1006-city-bank", "City Bank"],
      ["1007-bkash-merchant", "bKash Merchant"],
      ["1008-nagad-merchant", "Nagad Merchant"],
      ["1009-rocket-merchant", "Rocket Merchant"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "asset" as const,
    balanceSheetLine: "cash_and_bank" as const,
    categoryCode: "asset-cash-bank",
    code,
    description: `${name} cash and bank balance.`,
    isPaymentAccount: true,
    name,
    normalBalance: "debit" as const,
    openingBalance: "0.00",
    sortOrder: 30 + index,
  })),
  {
    accountType: "asset",
    balanceSheetLine: "accounts_receivable",
    categoryCode: "asset-accounts-receivable",
    code: "1101-accounts-receivable",
    description: "Customer balances waiting to be collected.",
    isPaymentAccount: false,
    name: "Customer Receivable",
    normalBalance: "debit",
    openingBalance: "0.00",
    sortOrder: 100,
  },
  {
    accountType: "asset",
    balanceSheetLine: "supplier_advance",
    categoryCode: "asset-accounts-receivable",
    code: "1103-supplier-advance",
    description: "Supplier advances paid before bills are applied.",
    isPaymentAccount: false,
    name: "Supplier Advance",
    normalBalance: "debit",
    openingBalance: "0.00",
    sortOrder: 110,
  },
  {
    accountType: "asset",
    balanceSheetLine: "supplier_refund_receivable",
    categoryCode: "asset-current",
    code: "1104-supplier-refund-receivable",
    description: "Approved purchase returns awaiting a cash or bank refund.",
    isPaymentAccount: false,
    name: "Supplier Refund Receivable",
    normalBalance: "debit",
    openingBalance: "0.00",
    sortOrder: 115,
  },
  ...(
    [
      ["1201-product-inventory", "Product Inventory"],
      ["1202-raw-material-inventory", "Raw Material Inventory"],
      ["1203-packaging-inventory", "Packaging Inventory"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "asset" as const,
    balanceSheetLine: "inventory" as const,
    categoryCode: "asset-inventory",
    code: index === 0 ? "1003-inventory" : code,
    description: `${name} value held by the business.`,
    isPaymentAccount: false,
    name,
    normalBalance: "debit" as const,
    openingBalance: "0.00",
    sortOrder: 120 + index,
  })),
  {
    accountType: "asset",
    balanceSheetLine: "other_current_assets",
    categoryCode: "asset-current",
    code: "1102-other-current-assets",
    description: "Other short-term assets.",
    isPaymentAccount: false,
    name: "Other Current Assets",
    normalBalance: "debit",
    openingBalance: "0.00",
    sortOrder: 130,
  },
  ...(
    [
      ["1501-fixed-assets", "Office Furniture"],
      ["1502-office-equipment", "Office Equipment"],
      ["1503-computer", "Computer"],
      ["1504-laptop", "Laptop"],
      ["1505-printer", "Printer"],
      ["1506-motorcycle", "Motorcycle"],
      ["1507-delivery-van", "Delivery Van"],
      ["1508-warehouse-equipment", "Warehouse Equipment"],
      ["1509-air-conditioner", "Air Conditioner"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "asset" as const,
    balanceSheetLine: "fixed_assets" as const,
    categoryCode: "asset-fixed",
    code,
    description: `${name} fixed asset.`,
    isPaymentAccount: false,
    name,
    normalBalance: "debit" as const,
    openingBalance: "0.00",
    sortOrder: 150 + index,
  })),
  ...(
    [
      ["2501-loan-payable", "Bank Loan"],
      ["2502-vehicle-loan", "Vehicle Loan"],
      ["2503-business-loan", "Business Loan"],
      ["2504-equipment-loan", "Equipment Loan"],
      ["2505-working-capital-loan", "Working Capital Loan"],
      ["2506-personal-loan", "Personal Loan"],
      ["2507-mortgage-loan", "Mortgage Loan"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "liability" as const,
    balanceSheetLine: "loan_payable" as const,
    categoryCode: "liability-loan-payable",
    code,
    description: `${name} payable balance.`,
    isPaymentAccount: false,
    name,
    normalBalance: "credit" as const,
    openingBalance: "0.00",
    sortOrder: 250 + index,
  })),
  {
    accountType: "liability",
    balanceSheetLine: "accounts_payable",
    categoryCode: "liability-accounts-payable",
    code: "2001-accounts-payable",
    description: "Supplier payable balances.",
    isPaymentAccount: false,
    name: "Supplier Payable",
    normalBalance: "credit",
    openingBalance: "0.00",
    sortOrder: 300,
  },
  {
    accountType: "liability",
    balanceSheetLine: "customer_advance",
    categoryCode: "liability-accounts-payable",
    code: "2101-customer-advance",
    description: "Customer advances received before revenue is earned.",
    isPaymentAccount: false,
    name: "Customer Advance",
    normalBalance: "credit",
    openingBalance: "0.00",
    sortOrder: 310,
  },
  {
    accountType: "liability",
    balanceSheetLine: "accounts_payable",
    categoryCode: "liability-accounts-payable",
    code: "2002-manufacturer-payable",
    description: "Manufacturer payable balances.",
    isPaymentAccount: false,
    name: "Manufacturer Payable",
    normalBalance: "credit",
    openingBalance: "0.00",
    sortOrder: 320,
  },
  ...(
    [
      ["2201-vat-payable", "VAT Payable"],
      ["2202-income-tax-payable", "Income Tax Payable"],
      ["2203-advance-tax-payable", "Advance Tax Payable"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "liability" as const,
    balanceSheetLine: "accounts_payable" as const,
    categoryCode: "liability-tax-payable",
    code,
    description: `${name} balance.`,
    isPaymentAccount: false,
    name,
    normalBalance: "credit" as const,
    openingBalance: "0.00",
    sortOrder: 330 + index,
  })),
  ...(
    [
      ["2301-staff-salary-payable", "Staff Salary Payable"],
      ["2302-delivery-salary-payable", "Delivery Salary Payable"],
      ["2303-salesman-salary-payable", "Salesman Salary Payable"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "liability" as const,
    balanceSheetLine: "accounts_payable" as const,
    categoryCode: "liability-salary-payable",
    code,
    description: `${name} accrued balance.`,
    isPaymentAccount: false,
    name,
    normalBalance: "credit" as const,
    openingBalance: "0.00",
    sortOrder: 340 + index,
  })),
  {
    accountType: "equity",
    balanceSheetLine: "owner_capital",
    categoryCode: "equity-owner",
    code: "3001-owner-capital",
    description: "Owner capital contributions.",
    isPaymentAccount: false,
    name: "Owner Capital",
    normalBalance: "credit",
    openingBalance: "0.00",
    sortOrder: 400,
  },
  {
    accountType: "equity",
    balanceSheetLine: "current_year_profit",
    categoryCode: "equity-retained-earnings",
    code: "3002-current-year-profit",
    description: "Retained profit kept inside the business.",
    isPaymentAccount: false,
    name: "Retained Earnings",
    normalBalance: "credit",
    openingBalance: "0.00",
    sortOrder: 410,
  },
  {
    accountType: "equity",
    balanceSheetLine: "owner_drawings",
    categoryCode: "equity-drawings",
    code: "3003-owner-drawings",
    description: "Owner withdrawals from the business.",
    isPaymentAccount: false,
    name: "Owner Drawings",
    normalBalance: "debit",
    openingBalance: "0.00",
    sortOrder: 420,
  },
  ...(
    [
      ["4001-product-sales", "Product Sales"],
      ["4004-wholesale-sales", "Wholesale Sales"],
      ["4005-retail-sales", "Retail Sales"],
      ["4006-online-sales", "Online Sales"],
      ["4007-marketplace-sales", "Marketplace Sales"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "income" as const,
    categoryCode: "income-product",
    code,
    description: `${name} revenue.`,
    isPaymentAccount: false,
    name,
    normalBalance: "credit" as const,
    openingBalance: "0.00",
    profitAndLossLine: "product_sales" as const,
    sortOrder: 500 + index,
  })),
  ...(
    [
      ["4002-delivery-charge-income", "Delivery Charge Income"],
      ["4008-commission-income", "Commission Income"],
      ["4009-service-charge", "Service Charge"],
      ["4010-membership-fee", "Membership Fee"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "income" as const,
    categoryCode: "income-service",
    code,
    description: `${name} revenue.`,
    isPaymentAccount: false,
    name,
    normalBalance: "credit" as const,
    openingBalance: "0.00",
    profitAndLossLine: "service_income" as const,
    sortOrder: 510 + index,
  })),
  ...(
    [
      ["4003-interest-income", "Interest Income"],
      ["4011-discount-received", "Discount Received"],
      ["4012-cashback-income", "Cashback Income"],
      ["4013-rental-income", "Rental Income"],
      ["4014-miscellaneous-income", "Miscellaneous Income"],
    ] as const
  ).map(([code, name], index) => ({
    accountType: "income" as const,
    categoryCode: "income-other",
    code,
    description: `${name} revenue.`,
    isPaymentAccount: false,
    name,
    normalBalance: "credit" as const,
    openingBalance: "0.00",
    profitAndLossLine: "other_income" as const,
    sortOrder: 520 + index,
  })),
  ...(
    [
      ["5001-product-purchase-cost", "Product Purchase Cost", "cogs-product"],
      ["5002-raw-material-purchase", "Raw Material Purchase", "cogs-product"],
      ["5101-freight-in", "Freight In", "cogs-freight"],
      ["5102-loading-unloading", "Loading & Unloading", "cogs-freight"],
      ["5201-production-cost", "Production Cost", "cogs-manufacturing"],
      ["5202-packaging-cost", "Packaging Cost", "cogs-manufacturing"],
      ["5203-direct-labor-cost", "Direct Labor Cost", "cogs-manufacturing"],
    ] as const
  ).map(([code, name, categoryCode], index) => ({
    accountType: "cogs" as const,
    categoryCode,
    code,
    description: `${name} cost of sales.`,
    isPaymentAccount: false,
    name,
    normalBalance: "debit" as const,
    openingBalance: "0.00",
    profitAndLossLine: "product_purchase_cost" as const,
    sortOrder: 600 + index,
  })),
  ...(
    [
      ["6001-operating-expenses", "Staff Salary", "expense-salary"],
      ["6002-salesman-salary", "Salesman Salary", "expense-salary"],
      ["6003-delivery-salary", "Delivery Salary", "expense-salary"],
      ["6004-manager-salary", "Manager Salary", "expense-salary"],
      ["6101-fuel-expense", "Fuel Expense", "expense-transport-delivery"],
      [
        "6102-vehicle-maintenance",
        "Vehicle Maintenance",
        "expense-transport-delivery",
      ],
      ["6103-courier-expense", "Courier Expense", "expense-transport-delivery"],
      [
        "6104-delivery-expense",
        "Delivery Expense",
        "expense-transport-delivery",
      ],
      [
        "6105-driver-allowance",
        "Driver Allowance",
        "expense-transport-delivery",
      ],
      ["6201-shop-rent", "Shop Rent", "expense-rent"],
      ["6202-warehouse-rent", "Warehouse Rent", "expense-rent"],
      ["6203-office-rent", "Office Rent", "expense-rent"],
      ["6301-electricity-bill", "Electricity Bill", "expense-utility-bills"],
      ["6302-gas-bill", "Gas Bill", "expense-utility-bills"],
      ["6303-water-bill", "Water Bill", "expense-utility-bills"],
      ["6401-bank-charge", "Bank Charge", "expense-bank-charges"],
      ["6402-bank-interest", "Bank Interest", "expense-bank-charges"],
      ["6403-sms-banking-charge", "SMS Banking Charge", "expense-bank-charges"],
      ["6501-facebook-ads", "Facebook Ads", "expense-marketing"],
      ["6502-google-ads", "Google Ads", "expense-marketing"],
      ["6503-banner-printing", "Banner Printing", "expense-marketing"],
      ["6504-promotional-expense", "Promotional Expense", "expense-marketing"],
      ["6601-office-stationery", "Office Stationery", "expense-office"],
      ["6602-office-supplies", "Office Supplies", "expense-office"],
      ["6603-internet-bill", "Internet Bill", "expense-office"],
      ["6604-mobile-bill", "Mobile Bill", "expense-office"],
      [
        "6701-equipment-maintenance",
        "Equipment Maintenance",
        "expense-maintenance",
      ],
      ["6702-computer-repair", "Computer Repair", "expense-maintenance"],
      ["6703-vehicle-repair", "Vehicle Repair", "expense-maintenance"],
      ["6704-building-repair", "Building Repair", "expense-maintenance"],
    ] as const
  ).map(([code, name, categoryCode], index) => ({
    accountType: "expense" as const,
    categoryCode,
    code,
    description: `${name} operating expense.`,
    isPaymentAccount: false,
    name,
    normalBalance: "debit" as const,
    openingBalance: "0.00",
    profitAndLossLine: "operating_expenses" as const,
    sortOrder: 700 + index,
  })),
];

function findDuplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return Array.from(duplicates);
}

export function validateDefaultFinanceSeeds() {
  const errors: string[] = [];
  const categoryCodes = DEFAULT_FINANCE_CATEGORY_SEEDS.map(
    (category) => category.code,
  );
  const accountCodes = DEFAULT_FINANCE_ACCOUNT_SEEDS.map(
    (account) => account.code,
  );
  const duplicateCategoryCodes = findDuplicateValues(categoryCodes);
  const duplicateAccountCodes = findDuplicateValues(accountCodes);
  const categoryCodeSet = new Set(categoryCodes);
  const accountCodeSet = new Set(accountCodes);

  for (const duplicate of duplicateCategoryCodes) {
    errors.push(`Duplicate finance category seed code: ${duplicate}`);
  }

  for (const duplicate of duplicateAccountCodes) {
    errors.push(`Duplicate finance account seed code: ${duplicate}`);
  }

  for (const account of DEFAULT_FINANCE_ACCOUNT_SEEDS) {
    if (!categoryCodeSet.has(account.categoryCode)) {
      errors.push(
        `Finance account seed ${account.code} references missing category ${account.categoryCode}`,
      );
    }
  }

  for (const rule of Object.values(ACCOUNTING_POSTING_RULES)) {
    for (const line of rule.lines) {
      if (!accountCodeSet.has(line.accountCode)) {
        errors.push(
          `Posting rule ${rule.transactionType} references missing account ${line.accountCode}`,
        );
      }
    }
  }

  return errors;
}

export function assertDefaultFinanceSeeds() {
  const errors = validateDefaultFinanceSeeds();

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
