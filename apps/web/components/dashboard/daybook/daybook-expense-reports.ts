import type {
  DaybookExpenseEntry,
  DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

type ExpenseRange = {
  endDate: string;
  startDate: string;
};

export type DaybookExpenseCategorySummary = {
  amount: number;
  category: string;
};

export type DaybookExpenseAccountSummary = Record<
  DaybookPaymentAccountType,
  number
>;

export function isDaybookExpenseInRange(
  expense: DaybookExpenseEntry,
  range: ExpenseRange,
) {
  return expense.paymentDate >= range.startDate && expense.paymentDate <= range.endDate;
}

export function getDaybookExpensesInRange(
  expenses: DaybookExpenseEntry[],
  range: ExpenseRange,
) {
  return expenses.filter((expense) => isDaybookExpenseInRange(expense, range));
}

export function getDaybookExpenseTotal(expenses: DaybookExpenseEntry[]) {
  return expenses.reduce((total, expense) => total + expense.total, 0);
}

export function summarizeDaybookExpensesByCategory(
  expenses: DaybookExpenseEntry[],
) {
  const categoryTotals = new Map<string, number>();

  for (const expense of expenses) {
    for (const line of expense.lines) {
      categoryTotals.set(
        line.category,
        (categoryTotals.get(line.category) ?? 0) + line.amount,
      );
    }
  }

  return Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ amount, category }))
    .sort((first, second) => first.category.localeCompare(second.category));
}

export function summarizeDaybookExpensesByPaymentAccount(
  expenses: DaybookExpenseEntry[],
) {
  return expenses.reduce<DaybookExpenseAccountSummary>(
    (summary, expense) => ({
      ...summary,
      [expense.paymentAccountType]:
        summary[expense.paymentAccountType] + expense.total,
    }),
    { bank: 0, cash: 0 },
  );
}
