import { DELIVERY_COST_UNIT_CODES } from "@bikalpo-project/db/product-delivery";
import { z } from "zod";

/** decimal(10, 2), or empty when the cost is not set yet. */
const optionalMoney = z
  .string()
  .trim()
  .regex(/^(\d{1,8}(\.\d{1,2})?)?$/, "Enter an amount with at most two decimals")
  .optional()
  .nullable();

/** Create Product "Delivery Configuration" fields, shared by every panel. */
export const deliveryDetailsShape = {
  deliveryCostUnit: z
    .enum(DELIVERY_COST_UNIT_CODES)
    .or(z.literal(""))
    .optional()
    .nullable(),
  defaultDeliveryCost: optionalMoney,
};

/** Seller price for one variant: the New price, and Exchange for cylinders. */
export const sellerVariantPriceShape = {
  retailPrice: optionalMoney,
};

/**
 * Product columns for the delivery fields. Fields the client did not send
 * are left out, so an older client never clears a saved delivery cost.
 */
export function deliveryColumns(details: {
  deliveryCostUnit?: string | null;
  defaultDeliveryCost?: string | null;
}) {
  const columns: {
    deliveryCostUnit?: string | null;
    defaultDeliveryCost?: string | null;
  } = {};
  if (details.deliveryCostUnit !== undefined) {
    columns.deliveryCostUnit = details.deliveryCostUnit || null;
  }
  if (details.defaultDeliveryCost !== undefined) {
    columns.defaultDeliveryCost = details.defaultDeliveryCost || null;
  }
  return columns;
}

/** A positive New price to store, or null when the seller left it empty. */
export function sellerRetailPrice(value?: string | null) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : null;
}
