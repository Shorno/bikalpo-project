"use client";

import { useEffect, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  DAYBOOK_PRODUCT_SALE_EVENT,
  type DaybookProductSaleEntry,
  loadDaybookProductSales,
} from "@/components/dashboard/daybook/daybook-product-sale-ledger";

export function useDaybookProductSales(scope: DaybookExpenseScope) {
  const [sales, setSales] = useState<DaybookProductSaleEntry[]>([]);

  useEffect(() => {
    const syncSales = () => setSales(loadDaybookProductSales(scope));

    syncSales();
    window.addEventListener("storage", syncSales);
    window.addEventListener(DAYBOOK_PRODUCT_SALE_EVENT, syncSales);

    return () => {
      window.removeEventListener("storage", syncSales);
      window.removeEventListener(DAYBOOK_PRODUCT_SALE_EVENT, syncSales);
    };
  }, [scope]);

  return sales;
}
