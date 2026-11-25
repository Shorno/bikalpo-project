"use client";

import { expiredDamageQuery } from "@/components/features/stock/expiry-stock-model";
import { ExpiryStockPage } from "@/components/features/stock/expiry-stock-page";
import {
  useExpiryStock,
  useSetProductExpiryAlertDays,
} from "@/hooks/use-shop-owner-api";

export default function StockExpiredPage() {
  const query = useExpiryStock();
  const saveAlertDays = useSetProductExpiryAlertDays();
  return (
    <ExpiryStockPage
      query={query}
      onSaveAlertDays={saveAlertDays.mutateAsync}
      damageHref={(product) => {
        const params = expiredDamageQuery(product);
        return params ? `/dashboard/damage/create?${params}` : null;
      }}
    />
  );
}
