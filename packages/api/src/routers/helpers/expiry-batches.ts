/**
 * Expired Products by batch (Phase 5, client review 2026-11-24): the pure
 * part, so it can be tested without a database.
 *
 * A batch is a stock-in with an expiry date. What is left in each batch is
 * worked out the way the warehouse Expired page does: today's stock is
 * matched to the newest stock-ins first, so the oldest batches count as
 * sold first. Sold = received − left.
 */
import { allocateCurrentStockLots } from "../../services/warehouse-stock-lots";

export type ExpiryStatus = "expired" | "expiring" | "ok";

/** The alert choices on the page; the product's default is 10 days. */
export const EXPIRY_ALERT_DAY_OPTIONS = [5, 7, 10, 15, 20, 30] as const;
export const DEFAULT_EXPIRY_ALERT_DAYS = 10;

/** Today's date in Bangladesh (UTC+6, no daylight saving) as YYYY-MM-DD. */
export function dhakaDate(now: Date) {
  return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative when past. */
export function daysBetween(today: string, date: string) {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Expired once the date has passed; Expiring within the alert days. */
export function expiryStatus(
  expiryDate: string,
  today: string,
  alertDays: number,
): ExpiryStatus {
  const days = daysBetween(today, expiryDate);
  if (days < 0) return "expired";
  if (days <= alertDays) return "expiring";
  return "ok";
}

/** One stock-in, newest first in the list passed to `allocateBatches`. */
export type StockIn = {
  id: number;
  variantId: number;
  quantity: number;
  unitCost: number;
  expiryDate: string | null;
};

/** How much of each stock-in is still on hand, by stock-in id. */
export function allocateBatches(
  stockIns: StockIn[],
  availableByVariant: Map<number, number>,
) {
  const { availableByStockEntry } = allocateCurrentStockLots(
    stockIns.map((row) => ({
      id: row.id,
      variantId: row.variantId,
      inventoryDelta: row.quantity,
      totalCost: row.quantity * row.unitCost,
      purchasePrice: row.unitCost,
    })),
    availableByVariant,
  );
  return availableByStockEntry;
}
