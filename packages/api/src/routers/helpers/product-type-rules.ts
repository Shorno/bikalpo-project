import {
  buildProductTypeFulfillmentProfile,
  FULFILLMENT_UNIT_CODES,
  type INVENTORY_BEHAVIOURS,
} from "@bikalpo-project/db";
import type { productTypeRuleSetting } from "@bikalpo-project/db/schema";

export const TRACKING_TYPES = ["none", "batch", "serial"] as const;
const ALL_UNIT_CODES = [...FULFILLMENT_UNIT_CODES];

type RuleSettingsInput = typeof productTypeRuleSetting.$inferInsert;

type RuleSettingsType = {
  id: number;
  name: string;
  slug: string;
  inventoryBehaviour: (typeof INVENTORY_BEHAVIOURS)[number];
};

export function buildDefaultRuleSettings<
  T extends {
    id: number;
    name: string;
    slug: string;
    inventoryBehaviour: (typeof INVENTORY_BEHAVIOURS)[number];
  },
>(type: T): RuleSettingsInput {
  const profile = buildProductTypeFulfillmentProfile(type);
  const isFoodLike =
    profile.family === "grocery" || profile.family === "bulk_liquid";
  const hasConversion =
    profile.inventoryBehaviour === "auto_break" ||
    profile.inventoryBehaviour === "loose_convert";
  const hasLoose =
    profile.inventoryBehaviour === "loose_convert" ||
    profile.supportedModes.includes("loose");
  const trackingTypes = profile.supportsTrackedAssets
    ? [...TRACKING_TYPES]
    : (["none", "batch"] as const);

  return {
    productTypeId: type.id,
    trackingTypes: [...trackingTypes],
    trackingAvailable: true,
    defaultTrackingType:
      profile.supportsTrackedAssets || isFoodLike ? "batch" : "none",
    returnPolicyAvailable: true,
    returnPolicyDefault: true,
    expiryAvailable: true,
    expiryDefault: isFoodLike,
    damageAvailable: true,
    damageDefault: true,
    stockTrackingAvailable: true,
    stockTrackingDefault: true,
    minimumOrderAvailable: true,
    minimumOrderDefault: true,
    minimumOrderQtyDefault: "1",
    conversionAvailable: true,
    conversionDefault: hasConversion,
    inventoryLooseUnitAvailable: hasLoose,
    inventoryLooseUnitDefault: hasLoose,
    inventoryLooseUnitOptions: ALL_UNIT_CODES,
    defaultInventoryLooseUnit:
      hasLoose && profile.conversionUnit ? profile.conversionUnit : "kg",
    returnablePackAvailable: true,
    returnablePackDefault: profile.supportsEmptyReturn,
    defaultPackDepositAmount: "0",
  };
}

export function normalizeRuleSettings(
  settings: typeof productTypeRuleSetting.$inferSelect | RuleSettingsInput,
) {
  return {
    ...settings,
    minimumOrderQtyDefault: String(settings.minimumOrderQtyDefault ?? "1"),
    defaultPackDepositAmount: String(settings.defaultPackDepositAmount ?? "0"),
    trackingAvailable: settings.trackingAvailable ?? true,
    trackingTypes: settings.trackingTypes?.length
      ? settings.trackingTypes
      : ["none"],
    inventoryLooseUnitOptions: settings.inventoryLooseUnitOptions?.length
      ? settings.inventoryLooseUnitOptions
      : ["kg"],
  };
}

/** A product type's rules: its saved settings, or the defaults for its kind. */
export function resolveTypeRuleSettings(
  type: RuleSettingsType & {
    ruleSettings?: typeof productTypeRuleSetting.$inferSelect | null;
  },
) {
  return normalizeRuleSettings(
    type.ruleSettings ?? buildDefaultRuleSettings(type),
  );
}

/**
 * Puts the resolved rule settings on `core.category.type` so Create Product
 * can show which rules the type uses.
 */
export function withCoreTypeRuleSettings<
  C extends {
    category?: {
      type?:
        | (RuleSettingsType & {
            ruleSettings?: typeof productTypeRuleSetting.$inferSelect | null;
          })
        | null;
    } | null;
  },
>(core: C) {
  const type = core.category?.type;
  if (!type) return core;
  return {
    ...core,
    category: {
      ...core.category,
      type: { ...type, ruleSettings: resolveTypeRuleSettings(type) },
    },
  };
}
