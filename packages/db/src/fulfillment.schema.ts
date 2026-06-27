import { z } from "zod";
import {
  FULFILLMENT_MODES,
  FULFILLMENT_MODE_LABELS,
  FULFILLMENT_UNIT_CODES,
  INVENTORY_BEHAVIOURS,
  INVENTORY_BEHAVIOUR_LABELS,
  PRODUCT_TYPE_FAMILIES,
  PRODUCT_TYPE_FAMILY_LABELS,
  VARIANT_DIMENSION_KEYS,
  VARIANT_DIMENSION_LABELS,
} from "./fulfillment";

export const inventoryBehaviourSchema = z.enum(INVENTORY_BEHAVIOURS);
export const fulfillmentModeSchema = z.enum(FULFILLMENT_MODES);
export const fulfillmentUnitCodeSchema = z.enum(FULFILLMENT_UNIT_CODES);
export const productTypeFamilySchema = z.enum(PRODUCT_TYPE_FAMILIES);
export const variantDimensionKeySchema = z.enum(VARIANT_DIMENSION_KEYS);

export const productTypeFulfillmentInputSchema = z.object({
  slug: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  inventoryBehaviour: inventoryBehaviourSchema.optional().nullable(),
  trackingType: z.enum(["none", "batch", "serial"]).optional().nullable(),
  isReturnablePack: z.boolean().optional().nullable(),
});

export const productTypeFulfillmentProfileSchema = z.object({
  family: productTypeFamilySchema,
  inventoryBehaviour: inventoryBehaviourSchema,
  defaultMode: fulfillmentModeSchema,
  supportedModes: z.array(fulfillmentModeSchema),
  orderUnit: fulfillmentUnitCodeSchema,
  stockUnit: fulfillmentUnitCodeSchema,
  conversionUnit: fulfillmentUnitCodeSchema,
  displayUnit: fulfillmentUnitCodeSchema,
  variantDimensions: z.array(variantDimensionKeySchema),
  supportsModeSwitching: z.boolean(),
  supportsTrackedAssets: z.boolean(),
  supportsEmptyReturn: z.boolean(),
  notes: z.string(),
});

export function getInventoryBehaviourOptions() {
  return INVENTORY_BEHAVIOURS.map((value) => ({
    value,
    label: INVENTORY_BEHAVIOUR_LABELS[value],
  }));
}

export function getFulfillmentModeOptions() {
  return FULFILLMENT_MODES.map((value) => ({
    value,
    label: FULFILLMENT_MODE_LABELS[value],
  }));
}

export function getProductTypeFamilyOptions() {
  return PRODUCT_TYPE_FAMILIES.map((value) => ({
    value,
    label: PRODUCT_TYPE_FAMILY_LABELS[value],
  }));
}

export function getVariantDimensionOptions() {
  return VARIANT_DIMENSION_KEYS.map((value) => ({
    value,
    label: VARIANT_DIMENSION_LABELS[value],
  }));
}
