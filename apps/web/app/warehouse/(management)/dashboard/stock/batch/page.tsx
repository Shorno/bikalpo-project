"use client";

import { BatchStockPage } from "@/components/features/stock/batch-stock-page";
import { useWarehouseBatchStock } from "@/hooks/use-warehouse-realtime-stock";

/** Warehouse Batch page: the same page as the shop's. */
export default function WarehouseStockBatchPage() {
  return <BatchStockPage query={useWarehouseBatchStock()} />;
}
