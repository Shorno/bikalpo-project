"use client";

import { BatchStockPage } from "@/components/features/stock/batch-stock-page";
import { useBatchStock } from "@/hooks/use-shop-owner-api";

/** Retailer Batch page: each size's batches that still hold stock. */
export default function StockBatchPage() {
  return <BatchStockPage query={useBatchStock()} />;
}
