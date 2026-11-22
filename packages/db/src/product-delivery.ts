import {
  getVariantDefinition,
  VARIANT_CONTAINERS,
  type VariantContainerCode,
  type VariantOptionLike,
} from "./variant-definition";

/**
 * Units a product's delivery cost can be charged per: every variant Type
 * (cylinder, sack, box...) plus weight and volume for loose products.
 */
export const DELIVERY_COST_UNITS = {
  ...VARIANT_CONTAINERS,
  kg: "KG",
  liter: "Litre",
} as const satisfies Record<string, string>;

export type DeliveryCostUnit = keyof typeof DELIVERY_COST_UNITS;

export const DELIVERY_COST_UNIT_CODES = Object.keys(
  DELIVERY_COST_UNITS,
) as [DeliveryCostUnit, ...DeliveryCostUnit[]];

export function isDeliveryCostUnit(value: unknown): value is DeliveryCostUnit {
  return typeof value === "string" && value in DELIVERY_COST_UNITS;
}

export function deliveryCostUnitLabel(value?: string | null) {
  return isDeliveryCostUnit(value) ? DELIVERY_COST_UNITS[value] : null;
}

const LOOSE_UNIT_TO_DELIVERY: Record<string, DeliveryCostUnit> = {
  kg: "kg",
  gram: "kg",
  g: "kg",
  l: "liter",
  liter: "liter",
  litre: "liter",
  ml: "liter",
};

/**
 * The unit delivery is charged per, taken from the first selected variant's
 * Type: a 12 KG cylinder is delivered per cylinder, loose rice per KG.
 */
export function suggestDeliveryCostUnit(
  options: Array<VariantOptionLike | null | undefined>,
): DeliveryCostUnit | null {
  for (const option of options) {
    const definition = getVariantDefinition(option);
    if (!definition) continue;
    if (definition.kind === "measurement") {
      if (definition.container in VARIANT_CONTAINERS) {
        return definition.container as VariantContainerCode;
      }
      continue;
    }
    if (definition.kind === "loose") {
      const unit =
        LOOSE_UNIT_TO_DELIVERY[definition.measurementUnit.trim().toLowerCase()];
      if (unit) return unit;
      continue;
    }
    return "unit";
  }
  return null;
}
