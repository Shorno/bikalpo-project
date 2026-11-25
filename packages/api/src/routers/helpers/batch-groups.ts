/**
 * Batch page (client, 2026-11-25): the pure part, testable without a
 * database. One group per product size; one row per batch that still has
 * stock, worked out like Expired Products (the oldest stock-ins count as
 * sold first; Sold = Received − Stock).
 */

export type BatchSize = {
  variantId: number;
  productId: number;
  productName: string;
  sizeLabel: string;
  unit: string;
  brandName: string | null;
  color: string | null;
};

/** A stock-in with its batch details and where it came from. */
export type BatchStockIn = {
  id: number;
  variantId: number;
  quantity: number;
  batchNo: string | null;
  manufacturedCode: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  receivedAt: Date;
  source: string;
  supplierName: string | null;
  invoiceNo: string | null;
};

export type BatchRow = {
  key: string;
  batchNo: string;
  manufactureDate: string | null;
  expiryDate: string | null;
  manufacturedCode: string | null;
  supplierName: string | null;
  invoiceNo: string | null;
  receivedQty: number;
  soldQty: number;
  stockQty: number;
};

export type BatchGroup = {
  variantId: number;
  productId: number;
  productName: string;
  sizeLabel: string;
  unit: string;
  brandName: string | null;
  color: string | null;
  batches: BatchRow[];
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Groups stock-ins with a batch number into batch rows per size, keeping
 * only batches with stock left. `left` is each stock-in's stock on hand.
 */
export function buildBatchGroups(
  stockIns: BatchStockIn[],
  left: Map<number, number>,
  sizes: Map<number, BatchSize>,
): BatchGroup[] {
  const groups = new Map<number, BatchGroup>();
  const rowsByKey = new Map<string, BatchRow>();

  for (const row of stockIns) {
    const size = sizes.get(row.variantId);
    const batchNo = row.batchNo?.trim();
    const stockQty = left.get(row.id) ?? 0;
    if (!size || !batchNo || row.quantity <= 0) continue;

    const key = [
      row.variantId,
      row.source,
      batchNo,
      row.expiryDate ?? "",
      row.manufacturedCode ?? "",
    ].join("|");
    let batch = rowsByKey.get(key);
    if (!batch) {
      batch = {
        key,
        batchNo,
        manufactureDate: row.manufactureDate,
        expiryDate: row.expiryDate,
        manufacturedCode: row.manufacturedCode,
        supplierName: row.supplierName,
        invoiceNo: row.invoiceNo,
        receivedQty: 0,
        soldQty: 0,
        stockQty: 0,
      };
      rowsByKey.set(key, batch);
      const group = groups.get(row.variantId) ?? { ...size, batches: [] };
      group.batches.push(batch);
      groups.set(row.variantId, group);
    }
    batch.manufactureDate ??= row.manufactureDate;
    batch.receivedQty = round(batch.receivedQty + row.quantity);
    batch.stockQty = round(batch.stockQty + stockQty);
    batch.soldQty = round(batch.receivedQty - batch.stockQty);
  }

  const byDate = (a: string | null, b: string | null) =>
    (a ?? "9999-12-31").localeCompare(b ?? "9999-12-31");
  for (const [variantId, group] of groups) {
    group.batches = group.batches.filter((batch) => batch.stockQty > 0);
    if (group.batches.length === 0) groups.delete(variantId);
    group.batches.sort(
      (a, b) =>
        byDate(a.expiryDate, b.expiryDate) ||
        byDate(a.manufactureDate, b.manufactureDate) ||
        a.batchNo.localeCompare(b.batchNo, undefined, { numeric: true }),
    );
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.productName.localeCompare(b.productName) ||
      a.sizeLabel.localeCompare(b.sizeLabel, undefined, { numeric: true }),
  );
}
