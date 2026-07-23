"use client";

import { useEffect, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  DAYBOOK_LOAN_EVENT,
  type DaybookLoanReceivedEntry,
  loadDaybookLoans,
} from "@/components/dashboard/daybook/daybook-loan-ledger";

export function useDaybookLoans(scope: DaybookExpenseScope) {
  const [loans, setLoans] = useState<DaybookLoanReceivedEntry[]>([]);

  useEffect(() => {
    const syncLoans = () => setLoans(loadDaybookLoans(scope));

    syncLoans();
    window.addEventListener("storage", syncLoans);
    window.addEventListener(DAYBOOK_LOAN_EVENT, syncLoans);

    return () => {
      window.removeEventListener("storage", syncLoans);
      window.removeEventListener(DAYBOOK_LOAN_EVENT, syncLoans);
    };
  }, [scope]);

  return loans;
}
