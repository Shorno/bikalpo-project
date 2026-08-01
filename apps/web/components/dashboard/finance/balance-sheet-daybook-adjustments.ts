import type { DaybookExpenseEntry } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  getDaybookExpensesInRange,
  getDaybookExpenseTotal,
  summarizeDaybookExpensesByPaymentAccount,
} from "@/components/dashboard/daybook/daybook-expense-reports";
import type { DaybookProductSaleEntry } from "@/components/dashboard/daybook/daybook-product-sale-ledger";
import {
  getUnsyncedDaybookProductSalesInRange,
  summarizeDaybookProductSales,
} from "@/components/dashboard/daybook/daybook-product-sale-reports";

type AccountRow = {
  amount: string;
  label: string;
  muted?: boolean;
};

type AccountGroup = {
  rows: AccountRow[];
  title: string;
  total: string;
  totalLabel: string;
};

type AccountSection = {
  groups: AccountGroup[];
  title: string;
  total: string;
  totalLabel: string;
};

type BalanceSheetSummary = {
  cashAndBank: string;
  customerAdvance: string;
  inventory: string;
  netAssets: string;
  payable: string;
  receivable: string;
  retainedEarnings: string;
  supplierAdvance: string;
  totalAssets: string;
  totalEquity: string;
  totalLiabilities: string;
};

type DaybookBalanceSheetReport = {
  sections: AccountSection[];
  summary: BalanceSheetSummary;
};

type BalanceSheetExpenseRange = {
  endDate: string;
  startDate: string;
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function adjustAmount(value: string, delta: number) {
  return String(toNumber(value) + delta);
}

function isCashRow(label: string) {
  return label.toLowerCase() === "cash on hand";
}

function isBankRow(label: string) {
  const normalizedLabel = label.toLowerCase();
  return (
    normalizedLabel === "bank account" || normalizedLabel === "cash at bank"
  );
}

function adjustCashAndBankGroup(
  group: AccountGroup,
  deductions: { bank: number; cash: number },
  totalDeduction: number,
) {
  let foundBankRow = false;
  let foundCashRow = false;
  const rows = group.rows.map((row) => {
    if (isCashRow(row.label)) {
      foundCashRow = true;
      return { ...row, amount: adjustAmount(row.amount, -deductions.cash) };
    }

    if (isBankRow(row.label)) {
      foundBankRow = true;
      return { ...row, amount: adjustAmount(row.amount, -deductions.bank) };
    }

    return row;
  });

  if (deductions.cash > 0 && !foundCashRow) {
    rows.push({ amount: String(-deductions.cash), label: "Cash on Hand" });
  }

  if (deductions.bank > 0 && !foundBankRow) {
    rows.push({ amount: String(-deductions.bank), label: "Bank Account" });
  }

  return {
    ...group,
    rows,
    total: adjustAmount(group.total, -totalDeduction),
  };
}

function adjustCashAndBankGroupForSales(
  group: AccountGroup,
  additions: { bank: number; cash: number },
) {
  const totalAddition = additions.cash + additions.bank;

  if (totalAddition <= 0) {
    return group;
  }

  let foundCashRow = false;
  let foundBankRow = false;
  const rows = group.rows.map((row) => {
    if (isCashRow(row.label)) {
      foundCashRow = true;
      return { ...row, amount: adjustAmount(row.amount, additions.cash) };
    }

    if (isBankRow(row.label)) {
      foundBankRow = true;
      return { ...row, amount: adjustAmount(row.amount, additions.bank) };
    }

    return row;
  });

  if (additions.cash > 0 && !foundCashRow) {
    rows.push({ amount: String(additions.cash), label: "Cash on Hand" });
  }

  if (additions.bank > 0 && !foundBankRow) {
    rows.push({ amount: String(additions.bank), label: "Bank Account" });
  }

  return {
    ...group,
    rows,
    total: adjustAmount(group.total, totalAddition),
  };
}

function adjustReceivableGroup(group: AccountGroup, totalAddition: number) {
  if (totalAddition <= 0) {
    return group;
  }

  let foundReceivableRow = false;
  const rows = group.rows.map((row) => {
    if (row.label.toLowerCase() === "accounts receivable") {
      foundReceivableRow = true;
      return { ...row, amount: adjustAmount(row.amount, totalAddition) };
    }

    return row;
  });

  if (!foundReceivableRow) {
    rows.push({ amount: String(totalAddition), label: "Accounts Receivable" });
  }

  return {
    ...group,
    rows,
    total: adjustAmount(group.total, totalAddition),
  };
}

function adjustInventoryGroup(group: AccountGroup, totalDeduction: number) {
  if (totalDeduction <= 0) {
    return group;
  }

  let foundInventoryRow = false;
  const rows = group.rows.map((row) => {
    if (row.label.toLowerCase() === "inventory") {
      foundInventoryRow = true;
      return { ...row, amount: adjustAmount(row.amount, -totalDeduction) };
    }

    return row;
  });

  if (!foundInventoryRow) {
    rows.push({ amount: String(-totalDeduction), label: "Inventory" });
  }

  return {
    ...group,
    rows,
    total: adjustAmount(group.total, -totalDeduction),
  };
}

function adjustRetainedEarningsGroup(
  group: AccountGroup,
  totalDeduction: number,
) {
  let adjustedProfitRow = false;
  const rows = group.rows.map((row, index) => {
    const shouldAdjust =
      row.label.toLowerCase().startsWith("profit between") ||
      (index === 0 && group.rows.length === 1);

    if (!shouldAdjust || adjustedProfitRow) {
      return row;
    }

    adjustedProfitRow = true;
    return { ...row, amount: adjustAmount(row.amount, -totalDeduction) };
  });

  if (!adjustedProfitRow) {
    rows.push({
      amount: String(-totalDeduction),
      label: "Daybook expense adjustment",
    });
  }

  return {
    ...group,
    rows,
    total: adjustAmount(group.total, -totalDeduction),
  };
}

function adjustRetainedEarningsGroupForSales(
  group: AccountGroup,
  totalAddition: number,
) {
  let adjustedProfitRow = false;
  const rows = group.rows.map((row, index) => {
    const shouldAdjust =
      row.label.toLowerCase().startsWith("profit between") ||
      (index === 0 && group.rows.length === 1);

    if (!shouldAdjust || adjustedProfitRow) {
      return row;
    }

    adjustedProfitRow = true;
    return { ...row, amount: adjustAmount(row.amount, totalAddition) };
  });

  if (!adjustedProfitRow) {
    rows.push({
      amount: String(totalAddition),
      label: "Daybook product sale adjustment",
    });
  }

  return {
    ...group,
    rows,
    total: adjustAmount(group.total, totalAddition),
  };
}

export function applyDaybookExpensesToBalanceSheet<
  TReport extends DaybookBalanceSheetReport,
>(
  report: TReport,
  daybookExpenses: DaybookExpenseEntry[],
  range: BalanceSheetExpenseRange,
) {
  const reportExpenses = getDaybookExpensesInRange(daybookExpenses, range);
  const totalDeduction = getDaybookExpenseTotal(reportExpenses);

  if (totalDeduction <= 0) {
    return report;
  }

  const deductions = summarizeDaybookExpensesByPaymentAccount(reportExpenses);
  const sections = report.sections.map((section) => {
    if (section.title === "Assets") {
      return {
        ...section,
        groups: section.groups.map((group) =>
          group.title === "Cash and Bank"
            ? adjustCashAndBankGroup(group, deductions, totalDeduction)
            : group,
        ),
        total: adjustAmount(section.total, -totalDeduction),
      };
    }

    if (section.title === "Equity") {
      return {
        ...section,
        groups: section.groups.map((group) =>
          group.title === "Retained Earnings"
            ? adjustRetainedEarningsGroup(group, totalDeduction)
            : group,
        ),
        total: adjustAmount(section.total, -totalDeduction),
      };
    }

    return section;
  });

  return {
    ...report,
    sections,
    summary: {
      ...report.summary,
      cashAndBank: adjustAmount(report.summary.cashAndBank, -totalDeduction),
      netAssets: adjustAmount(report.summary.netAssets, -totalDeduction),
      retainedEarnings: adjustAmount(
        report.summary.retainedEarnings,
        -totalDeduction,
      ),
      totalAssets: adjustAmount(report.summary.totalAssets, -totalDeduction),
      totalEquity: adjustAmount(report.summary.totalEquity, -totalDeduction),
    },
  };
}

export function applyUnsyncedDaybookProductSalesToBalanceSheet<
  TReport extends DaybookBalanceSheetReport,
>(
  report: TReport,
  daybookProductSales: DaybookProductSaleEntry[],
  range: BalanceSheetExpenseRange,
) {
  const reportSales = getUnsyncedDaybookProductSalesInRange(
    daybookProductSales,
    range,
  );
  const totals = summarizeDaybookProductSales(reportSales);
  const netAssetChange = totals.totalSales - totals.totalCost;

  if (
    netAssetChange === 0 &&
    totals.totalSales === 0 &&
    totals.totalCost === 0
  ) {
    return report;
  }

  const sections = report.sections.map((section) => {
    if (section.title === "Assets") {
      return {
        ...section,
        groups: section.groups.map((group) => {
          if (group.title === "Cash and Bank") {
            return adjustCashAndBankGroupForSales(group, {
              bank: totals.bankSales,
              cash: totals.cashSales,
            });
          }

          if (group.title === "Other Current Assets") {
            return adjustReceivableGroup(group, totals.dueSales);
          }

          if (group.title === "Inventory") {
            return adjustInventoryGroup(group, totals.totalCost);
          }

          return group;
        }),
        total: adjustAmount(section.total, netAssetChange),
      };
    }

    if (section.title === "Equity") {
      return {
        ...section,
        groups: section.groups.map((group) =>
          group.title === "Retained Earnings"
            ? adjustRetainedEarningsGroupForSales(group, netAssetChange)
            : group,
        ),
        total: adjustAmount(section.total, netAssetChange),
      };
    }

    return section;
  });

  return {
    ...report,
    sections,
    summary: {
      ...report.summary,
      cashAndBank: adjustAmount(report.summary.cashAndBank, totals.cashSales),
      inventory: adjustAmount(report.summary.inventory, -totals.totalCost),
      netAssets: adjustAmount(report.summary.netAssets, netAssetChange),
      receivable: adjustAmount(report.summary.receivable, totals.dueSales),
      retainedEarnings: adjustAmount(
        report.summary.retainedEarnings,
        netAssetChange,
      ),
      totalAssets: adjustAmount(report.summary.totalAssets, netAssetChange),
      totalEquity: adjustAmount(report.summary.totalEquity, netAssetChange),
    },
  };
}
