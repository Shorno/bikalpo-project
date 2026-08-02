"use client";

import { useEffect, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  DAYBOOK_FIXED_ASSET_EVENT,
  type DaybookFixedAssetPurchase,
  loadDaybookFixedAssetPurchases,
} from "@/components/dashboard/daybook/daybook-fixed-asset-ledger";

export function useDaybookFixedAssetPurchases(scope: DaybookExpenseScope) {
  const [purchases, setPurchases] = useState<DaybookFixedAssetPurchase[]>([]);

  useEffect(() => {
    const syncPurchases = () =>
      setPurchases(loadDaybookFixedAssetPurchases(scope));

    syncPurchases();
    window.addEventListener("storage", syncPurchases);
    window.addEventListener(DAYBOOK_FIXED_ASSET_EVENT, syncPurchases);

    return () => {
      window.removeEventListener("storage", syncPurchases);
      window.removeEventListener(DAYBOOK_FIXED_ASSET_EVENT, syncPurchases);
    };
  }, [scope]);

  return purchases;
}
