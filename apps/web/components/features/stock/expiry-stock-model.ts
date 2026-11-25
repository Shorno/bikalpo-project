/**
 * Expired Products by batch (Phase 5, client review 2026-11-24): rows as
 * the API sends them, and the text the page shows. Shared by the retailer
 * page now and the warehouse page later.
 */
import { formatQuantity, type StockQuantity } from "./realtime-stock-model";

export type ExpiryStatus = "expired" | "expiring" | "ok";

export type ExpiryBatch = {
  key: string;
  batchNo: string | null;
  supplierName: string | null;
  invoiceNo: string | null;
  receivedAt: string;
  variants: string[];
  parts: { variantId: number; leftQty: number }[];
  /** Warehouse stock entries in this batch (empty for a shop). */
  stockEntryIds: number[];
  unit: string;
  receivedQty: number;
  soldQty: number;
  leftQty: number;
  manufactureDate: string | null;
  expiryDate: string;
  daysLeft: number;
  status: ExpiryStatus;
};

export type ExpiryProduct = {
  productId: number;
  productCode: string | null;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  alertDays: number;
  status: "expired" | "expiring";
  flaggedQty: StockQuantity[];
  lastExpiry: string;
  batches: ExpiryBatch[];
};

export const EXPIRY_STATUS_LABELS: Record<ExpiryStatus, string> = {
  expired: "Expired",
  expiring: "Expiring soon",
  ok: "OK",
};

export function expiryProductId(product: ExpiryProduct) {
  return product.productCode || `#${product.productId}`;
}

/** "20 Cylinder", "120 Pack + 900 KG". */
export function formatQuantities(list: StockQuantity[]) {
  if (list.length === 0) return "0";
  return list
    .map((item) => `${formatQuantity(item.quantity)} ${item.unit}`)
    .join(" + ");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "02 Apr" this year, "02 Apr 2027" otherwise. Takes YYYY-MM-DD. */
export function formatExpiryDate(date: string, thisYear: number, withYear = false) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const text = `${String(day).padStart(2, "0")} ${MONTHS[month - 1]}`;
  return withYear || year !== thisYear ? `${text} ${year}` : text;
}

/** "Expired 3 days ago", "Expires today", "In 5 days". */
export function daysLeftText(daysLeft: number) {
  if (daysLeft < -1) return `Expired ${-daysLeft} days ago`;
  if (daysLeft === -1) return "Expired yesterday";
  if (daysLeft === 0) return "Expires today";
  if (daysLeft === 1) return "In 1 day";
  return `In ${daysLeft} days`;
}

/** Search by name, Product ID (or a scanned 13-digit code), batch or supplier. */
export function matchesExpirySearch(product: ExpiryProduct, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  const digits = text.replace(/[\s-]/g, "");
  if (/^\d{13}$/.test(digits)) {
    return product.productCode?.startsWith(digits.slice(0, 8)) ?? false;
  }
  return [
    product.name,
    expiryProductId(product),
    product.categoryName,
    product.subCategoryName,
    ...product.batches.flatMap((batch) => [
      batch.batchNo,
      batch.supplierName,
      batch.invoiceNo,
    ]),
  ].some((field) =>
    (field ?? "").toLowerCase().includes(/^\d[\d\s-]*$/.test(text) ? digits : text),
  );
}

/**
 * Create Damage link for the product's expired batches: the damage form
 * reads the type, the product to find and each variant's quantity.
 */
export function expiredDamageQuery(product: ExpiryProduct) {
  const qtyByVariant = new Map<number, number>();
  const batches = product.batches.filter((batch) => batch.status === "expired");
  for (const batch of batches) {
    for (const part of batch.parts) {
      qtyByVariant.set(
        part.variantId,
        (qtyByVariant.get(part.variantId) ?? 0) + part.leftQty,
      );
    }
  }
  if (qtyByVariant.size === 0) return null;
  const params = new URLSearchParams({
    type: "expired",
    q: product.name,
    items: [...qtyByVariant].map(([id, qty]) => `${id}:${qty}`).join(","),
    note: expiredBatchNote(batches),
  });
  return params.toString();
}

function expiredBatchNote(batches: ExpiryBatch[]) {
  return `Expired batch ${batches
    .map((batch) => batch.batchNo)
    .filter(Boolean)
    .join(", ")}`.trim();
}

/**
 * Warehouse Create Damage link: its damage form loads the expired stock
 * entries themselves.
 */
export function warehouseExpiredDamageQuery(product: ExpiryProduct) {
  const ids = product.batches
    .filter((batch) => batch.status === "expired")
    .flatMap((batch) => batch.stockEntryIds);
  if (ids.length === 0) return null;
  return new URLSearchParams({
    type: "expired",
    stockEntryIds: ids.join(","),
  }).toString();
}
