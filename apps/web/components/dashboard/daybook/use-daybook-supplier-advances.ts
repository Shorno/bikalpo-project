"use client";

import { useEffect, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  DAYBOOK_SUPPLIER_ADVANCE_EVENT,
  type DaybookSupplierAdvanceEntry,
  loadDaybookSupplierAdvances,
} from "@/components/dashboard/daybook/daybook-supplier-advance-ledger";

export function useDaybookSupplierAdvances(scope: DaybookExpenseScope) {
  const [advances, setAdvances] = useState<DaybookSupplierAdvanceEntry[]>([]);

  useEffect(() => {
    const syncAdvances = () => setAdvances(loadDaybookSupplierAdvances(scope));

    syncAdvances();
    window.addEventListener("storage", syncAdvances);
    window.addEventListener(DAYBOOK_SUPPLIER_ADVANCE_EVENT, syncAdvances);

    return () => {
      window.removeEventListener("storage", syncAdvances);
      window.removeEventListener(DAYBOOK_SUPPLIER_ADVANCE_EVENT, syncAdvances);
    };
  }, [scope]);

  return advances;
}
