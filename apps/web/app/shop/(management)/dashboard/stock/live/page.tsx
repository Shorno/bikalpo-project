"use client";

import { RealtimeStockPage } from "@/components/features/stock/realtime-stock-page";
import {
  useRealtimeStock,
  useSetProductLowStockLevel,
} from "@/hooks/use-shop-owner-api";

export default function StockLivePage() {
  const query = useRealtimeStock();
  const saveLowStockLevel = useSetProductLowStockLevel();
  return (
    <RealtimeStockPage
      query={query}
      onSaveLowStockLevel={saveLowStockLevel.mutateAsync}
      addStockHref="/dashboard/stock/add"
      purchaseHref="/dashboard/orders"
    />
  );
}
