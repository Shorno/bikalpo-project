"use client";

import { useEffect, useState } from "react";
import {
  DAYBOOK_CUSTOMER_ADVANCE_EVENT,
  type DaybookCustomerAdvanceEntry,
  loadDaybookCustomerAdvances,
} from "@/components/dashboard/daybook/daybook-customer-advance-ledger";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";

export function useDaybookCustomerAdvances(scope: DaybookExpenseScope) {
  const [advances, setAdvances] = useState<DaybookCustomerAdvanceEntry[]>([]);

  useEffect(() => {
    const syncAdvances = () => setAdvances(loadDaybookCustomerAdvances(scope));

    syncAdvances();
    window.addEventListener("storage", syncAdvances);
    window.addEventListener(DAYBOOK_CUSTOMER_ADVANCE_EVENT, syncAdvances);

    return () => {
      window.removeEventListener("storage", syncAdvances);
      window.removeEventListener(DAYBOOK_CUSTOMER_ADVANCE_EVENT, syncAdvances);
    };
  }, [scope]);

  return advances;
}
