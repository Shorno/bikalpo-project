import {
  DELIVERY_COST_METHOD_CODES,
  INVENTORY_UNIT_CODES,
  parseConversionRule,
} from "@bikalpo-project/db/product-client-options";
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
  // Client layout: Delivery Cost Counting, Inventory Unit, Conversion text
  // and the two variant attributes.
  deliveryCostMethod: z
    .enum(DELIVERY_COST_METHOD_CODES)
    .or(z.literal(""))
    .optional()
    .nullable(),
  inventoryUnit: z
    .enum(INVENTORY_UNIT_CODES)
    .or(z.literal(""))
    .optional()
    .nullable(),
  conversionRule: z
    .string()
    .trim()
    .max(60)
    .refine(
      (value) => value === "" || parseConversionRule(value) !== null,
      "Write the conversion like 1 KG = 1000 G",
    )
    .optional()
    .nullable(),
  variantAttr1: z.string().trim().max(50).optional().nullable(),
  variantAttr2: z.string().trim().max(50).optional().nullable(),
};

type ClientDetails = {
  deliveryCostUnit?: string | null;
  defaultDeliveryCost?: string | null;
  deliveryCostMethod?: string | null;
  inventoryUnit?: string | null;
  conversionRule?: string | null;
  variantAttr1?: string | null;
  variantAttr2?: string | null;
};

/** Seller price for one variant: the New price, and Exchange for cylinders. */
export const sellerVariantPriceShape = {
  retailPrice: optionalMoney,
};

/**
 * Product columns for the delivery fields. Fields the client did not send
 * are left out, so an older client never clears a saved delivery cost.
 */
export function deliveryColumns(details: ClientDetails) {
  const columns: ClientDetails = {};
  if (details.deliveryCostUnit !== undefined) {
    columns.deliveryCostUnit = details.deliveryCostUnit || null;
  }
  if (details.defaultDeliveryCost !== undefined) {
    columns.defaultDeliveryCost = details.defaultDeliveryCost || null;
  }
  if (details.deliveryCostMethod !== undefined) {
    columns.deliveryCostMethod = details.deliveryCostMethod || null;
  }
  if (details.inventoryUnit !== undefined) {
    columns.inventoryUnit = details.inventoryUnit || null;
  }
  if (details.conversionRule !== undefined) {
    columns.conversionRule =
      parseConversionRule(details.conversionRule)?.text ?? null;
  }
  if (details.variantAttr1 !== undefined) {
    columns.variantAttr1 = details.variantAttr1 || null;
  }
  if (details.variantAttr2 !== undefined) {
    columns.variantAttr2 = details.variantAttr2 || null;
  }
  return columns;
}

/**
 * Create Product "Publishing": Status and (admin) Featured. Without a
 * brandId it applies to every brand in the save; a field left out keeps
 * the usual behaviour.
 */
export const publishShape = {
  publish: z
    .object({
      brandId: z.number().int().positive().optional(),
      status: z.enum(["active", "draft", "inactive"]).optional(),
      /** Admin only: "Featured product". */
      featured: z.boolean().optional(),
    })
    .optional(),
};

type PublishInput =
  | {
      brandId?: number;
      status?: "active" | "draft" | "inactive";
      featured?: boolean;
    }
  | undefined;

function publishAppliesTo(publish: PublishInput, brandId: number) {
  return Boolean(publish) && (publish?.brandId == null || publish.brandId === brandId);
}

export function publishStatusFor<T>(
  publish: PublishInput,
  brandId: number,
  fallback: T,
): T | "active" | "draft" | "inactive" {
  return publishAppliesTo(publish, brandId) && publish?.status
    ? publish.status
    : fallback;
}

/** Featured for this brand, or undefined when the save leaves it alone. */
export function publishFeaturedFor(publish: PublishInput, brandId: number) {
  return publishAppliesTo(publish, brandId) ? publish?.featured : undefined;
}

/** A positive New price to store, or null when the seller left it empty. */
export function sellerRetailPrice(value?: string | null) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : null;
}
