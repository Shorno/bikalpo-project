"use client";

import { warehouseExpiredDamageQuery } from "@/components/features/stock/expiry-stock-model";
import { ExpiryStockPage } from "@/components/features/stock/expiry-stock-page";
import {
  useSetWarehouseExpiryAlertDays,
  useWarehouseExpiryStock,
} from "@/hooks/use-warehouse-realtime-stock";

/** Warehouse Expired Products: the same page and row view as the shop's. */
export default function WarehouseStockExpiredPage() {
  const query = useWarehouseExpiryStock();
  const saveAlertDays = useSetWarehouseExpiryAlertDays();
  return (
    <ExpiryStockPage
      query={query}
      onSaveAlertDays={saveAlertDays.mutateAsync}
      damageHref={(product) => {
        const params = warehouseExpiredDamageQuery(product);
        return params ? `/warehouse/dashboard/damage/create?${params}` : null;
      }}
    />
  );
}
