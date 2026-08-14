type StockLot = {
  id: number;
  variantId: number;
  inventoryDelta: string | number;
  totalCost: string | number;
  purchasePrice: string | number;
};

function numeric(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function unitCostFromStockEntry(entry?: StockLot | null) {
  if (!entry) return 0;
  const inventoryDelta = numeric(entry.inventoryDelta);
  const totalCost = numeric(entry.totalCost);
  return inventoryDelta > 0 && totalCost >= 0
    ? totalCost / inventoryDelta
    : numeric(entry.purchasePrice);
}

/**
 * Estimate today's lot balances under FIFO consumption.
 *
 * Callers must supply receipt rows newest-first. The live inventory balance is
 * allocated back across the newest receipts, which is equivalent to consuming
 * the oldest receipts first. This accounts for aggregate outflows even where
 * legacy movements did not record a stock-entry foreign key.
 */
export function allocateCurrentStockLots(
  rows: StockLot[],
  availableByVariant: Map<number, number>,
) {
  const remainingByVariant = new Map(availableByVariant);
  const availableByStockEntry = new Map<number, number>();
  const costsByVariant = new Map<
    number,
    { quantity: number; totalCost: number; weightedUnitCost: number }
  >();

  for (const row of rows) {
    const received = Math.max(0, numeric(row.inventoryDelta));
    const remaining = Math.max(0, remainingByVariant.get(row.variantId) ?? 0);
    const allocated = Math.min(received, remaining);
    availableByStockEntry.set(row.id, allocated);
    if (allocated <= 0) continue;

    const current = costsByVariant.get(row.variantId) ?? {
      quantity: 0,
      totalCost: 0,
      weightedUnitCost: 0,
    };
    current.quantity += allocated;
    current.totalCost += allocated * unitCostFromStockEntry(row);
    current.weightedUnitCost = current.totalCost / current.quantity;
    costsByVariant.set(row.variantId, current);
    remainingByVariant.set(row.variantId, remaining - allocated);
  }

  return { availableByStockEntry, costsByVariant };
}
