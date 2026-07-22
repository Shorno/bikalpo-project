"use client";

import { useEffect, useState } from "react";
import {
  DAYBOOK_EXPENSE_EVENT,
  type DaybookExpenseEntry,
  type DaybookExpenseScope,
  loadDaybookExpenses,
} from "@/components/dashboard/daybook/daybook-expense-ledger";

export function useDaybookExpenses(scope: DaybookExpenseScope) {
  const [expenses, setExpenses] = useState<DaybookExpenseEntry[]>([]);

  useEffect(() => {
    const syncExpenses = () => setExpenses(loadDaybookExpenses(scope));

    syncExpenses();
    window.addEventListener("storage", syncExpenses);
    window.addEventListener(DAYBOOK_EXPENSE_EVENT, syncExpenses);

    return () => {
      window.removeEventListener("storage", syncExpenses);
      window.removeEventListener(DAYBOOK_EXPENSE_EVENT, syncExpenses);
    };
  }, [scope]);

  return expenses;
}
