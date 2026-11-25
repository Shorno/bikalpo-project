"use client";

import { RealtimeStockPage } from "@/components/features/stock/realtime-stock-page";
import {
  useSetWarehouseLowStockLevel,
  useWarehouseRealtimeStock,
} from "@/hooks/use-warehouse-realtime-stock";

const WH = "/warehouse/dashboard";

/** Warehouse Real-time Stock: the same page and row view as the shop's. */
export default function WarehouseStockLivePage() {
  const query = useWarehouseRealtimeStock();
  const saveLowStockLevel = useSetWarehouseLowStockLevel();
  return (
    <RealtimeStockPage
      query={query}
      onSaveLowStockLevel={saveLowStockLevel.mutateAsync}
      addStockHref={`${WH}/stock/add`}
      purchaseHref={`${WH}/purchases`}
    />
  );
}
