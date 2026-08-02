"use client";

import { useEffect, useState } from "react";
import {
  DAYBOOK_BILL_EVENT,
  type DaybookBillEntry,
  loadDaybookBills,
} from "@/components/dashboard/daybook/daybook-bill-ledger";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";

export function useDaybookBills(scope: DaybookExpenseScope) {
  const [bills, setBills] = useState<DaybookBillEntry[]>([]);

  useEffect(() => {
    const syncBills = () => setBills(loadDaybookBills(scope));

    syncBills();
    window.addEventListener("storage", syncBills);
    window.addEventListener(DAYBOOK_BILL_EVENT, syncBills);

    return () => {
      window.removeEventListener("storage", syncBills);
      window.removeEventListener(DAYBOOK_BILL_EVENT, syncBills);
    };
  }, [scope]);

  return bills;
}
