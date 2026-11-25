/**
 * Batch page (client, 2026-11-25): rows as the API sends them and the text
 * the page shows. Shared by the retailer and warehouse pages.
 */
import { formatQuantity } from "./realtime-stock-model";

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

export type BatchSize = {
  variantId: number;
  productId: number;
  productName: string;
  sizeLabel: string;
  unit: string;
  brandName: string | null;
  color: string | null;
  batches: BatchRow[];
};

export const EMPTY = "—";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "01 Jan 25" in the table, "01 Jan 2026" in Batch Details. */
export function formatBatchDate(date: string | null, fullYear = false) {
  if (!date) return EMPTY;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const yearText = fullYear ? String(year) : String(year).slice(-2);
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${yearText}`;
}

/** "25 Pack". */
export function formatBatchQty(quantity: number, unit: string) {
  return `${formatQuantity(quantity)} ${unit}`;
}

/** "ACI/Red", "ACI", or "—". */
export function brandColor(size: BatchSize) {
  return [size.brandName, size.color].filter(Boolean).join("/") || EMPTY;
}

/** Search by product, size, batch, Manufactured code, supplier or invoice. */
export function matchesBatchSearch(size: BatchSize, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return [
    size.productName,
    size.sizeLabel,
    size.brandName,
    ...size.batches.flatMap((batch) => [
      batch.batchNo,
      batch.manufacturedCode,
      batch.supplierName,
      batch.invoiceNo,
    ]),
  ].some((field) => (field ?? "").toLowerCase().includes(text));
}
