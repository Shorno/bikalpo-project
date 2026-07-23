"use client";

import { useEffect, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  DAYBOOK_PRODUCT_PURCHASE_EVENT,
  type DaybookProductPurchaseEntry,
  loadDaybookProductPurchases,
} from "@/components/dashboard/daybook/daybook-product-purchase-ledger";

export function useDaybookProductPurchases(scope: DaybookExpenseScope) {
  const [purchases, setPurchases] = useState<DaybookProductPurchaseEntry[]>([]);

  useEffect(() => {
    const syncPurchases = () =>
      setPurchases(loadDaybookProductPurchases(scope));

    syncPurchases();
    window.addEventListener("storage", syncPurchases);
    window.addEventListener(DAYBOOK_PRODUCT_PURCHASE_EVENT, syncPurchases);

    return () => {
      window.removeEventListener("storage", syncPurchases);
      window.removeEventListener(DAYBOOK_PRODUCT_PURCHASE_EVENT, syncPurchases);
    };
  }, [scope]);

  return purchases;
}
