export const INVENTORY_BEHAVIOURS = [
  "auto_break",
  "loose_convert",
  "fixed_pack",
] as const;

export type InventoryBehaviour = (typeof INVENTORY_BEHAVIOURS)[number];

export const FULFILLMENT_MODES = [
  "loose",
  "pack",
  "carton",
  "unit",
  "box",
  "pair",
  "cylinder",
  "drum",
  "bundle",
] as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

export const FULFILLMENT_UNIT_CODES = [
  "kg",
  "liter",
  "piece",
  "pack",
  "carton",
  "box",
  "pair",
  "unit",
  "cylinder",
  "drum",
  "bundle",
] as const;

export type FulfillmentUnitCode = (typeof FULFILLMENT_UNIT_CODES)[number];

export const PRODUCT_TYPE_FAMILIES = [
  "grocery",
  "fashion",
  "footwear",
  "electronics",
  "lpg",
  "bulk_liquid",
  "generic",
] as const;

export type ProductTypeFamily = (typeof PRODUCT_TYPE_FAMILIES)[number];

export const VARIANT_DIMENSION_KEYS = [
  "brand",
  "color",
  "size",
  "capacity",
  "model",
  "material",
  "pack_size",
  "supply_mode",
] as const;

export type VariantDimensionKey = (typeof VARIANT_DIMENSION_KEYS)[number];

type QuantityKind = "weight" | "volume" | "count";

export type FulfillmentUnitDescriptor = {
  code: FulfillmentUnitCode;
  label: string;
  shortLabel: string;
  quantityKind: QuantityKind;
};

export type ProductTypeFulfillmentInput = {
  slug?: string | null;
  name?: string | null;
  inventoryBehaviour?: InventoryBehaviour | null;
  trackingType?: "none" | "batch" | "serial" | null;
  isReturnablePack?: boolean | null;
};

export type ProductTypeFulfillmentProfile = {
  family: ProductTypeFamily;
  inventoryBehaviour: InventoryBehaviour;
  defaultMode: FulfillmentMode;
  supportedModes: readonly FulfillmentMode[];
  orderUnit: FulfillmentUnitCode;
  stockUnit: FulfillmentUnitCode;
  conversionUnit: FulfillmentUnitCode;
  displayUnit: FulfillmentUnitCode;
  variantDimensions: readonly VariantDimensionKey[];
  supportsModeSwitching: boolean;
  supportsTrackedAssets: boolean;
  supportsEmptyReturn: boolean;
  notes: string;
};

type FamilyConfig = {
  family: ProductTypeFamily;
  keywords: readonly string[];
  defaultModes: readonly FulfillmentMode[];
  defaultUnits: {
    orderUnit: FulfillmentUnitCode;
    stockUnit: FulfillmentUnitCode;
    conversionUnit: FulfillmentUnitCode;
    displayUnit: FulfillmentUnitCode;
  };
  variantDimensions: readonly VariantDimensionKey[];
  supportsTrackedAssets: boolean;
  defaultEmptyReturn: boolean;
  notes: string;
};

type BehaviourOverride = Partial<
  Pick<
    ProductTypeFulfillmentProfile,
    | "defaultMode"
    | "supportedModes"
    | "orderUnit"
    | "stockUnit"
    | "conversionUnit"
    | "displayUnit"
    | "supportsModeSwitching"
  >
>;

export const INVENTORY_BEHAVIOUR_LABELS: Record<InventoryBehaviour, string> = {
  auto_break: "Auto Break",
  loose_convert: "Loose Convert",
  fixed_pack: "Fixed Pack",
};

export const FULFILLMENT_MODE_LABELS: Record<FulfillmentMode, string> = {
  loose: "Loose",
  pack: "Pack",
  carton: "Carton",
  unit: "Unit",
  box: "Box",
  pair: "Pair",
  cylinder: "Cylinder",
  drum: "Drum",
  bundle: "Bundle",
};

export const PRODUCT_TYPE_FAMILY_LABELS: Record<ProductTypeFamily, string> = {
  grocery: "Grocery",
  fashion: "Fashion",
  footwear: "Footwear",
  electronics: "Electronics",
  lpg: "LPG",
  bulk_liquid: "Bulk Liquid",
  generic: "Generic",
};

export const VARIANT_DIMENSION_LABELS: Record<VariantDimensionKey, string> = {
  brand: "Brand",
  color: "Color",
  size: "Size",
  capacity: "Capacity",
  model: "Model",
  material: "Material",
  pack_size: "Pack Size",
  supply_mode: "Supply Mode",
};

export const FULFILLMENT_UNITS: Record<
  FulfillmentUnitCode,
  FulfillmentUnitDescriptor
> = {
  kg: { code: "kg", label: "Kilogram", shortLabel: "KG", quantityKind: "weight" },
  liter: {
    code: "liter",
    label: "Liter",
    shortLabel: "L",
    quantityKind: "volume",
  },
  piece: {
    code: "piece",
    label: "Piece",
    shortLabel: "pcs",
    quantityKind: "count",
  },
  pack: {
    code: "pack",
    label: "Pack",
    shortLabel: "pack",
    quantityKind: "count",
  },
  carton: {
    code: "carton",
    label: "Carton",
    shortLabel: "carton",
    quantityKind: "count",
  },
  box: { code: "box", label: "Box", shortLabel: "box", quantityKind: "count" },
  pair: {
    code: "pair",
    label: "Pair",
    shortLabel: "pair",
    quantityKind: "count",
  },
  unit: {
    code: "unit",
    label: "Unit",
    shortLabel: "unit",
    quantityKind: "count",
  },
  cylinder: {
    code: "cylinder",
    label: "Cylinder",
    shortLabel: "cylinder",
    quantityKind: "count",
  },
  drum: {
    code: "drum",
    label: "Drum",
    shortLabel: "drum",
    quantityKind: "count",
  },
  bundle: {
    code: "bundle",
    label: "Bundle",
    shortLabel: "bundle",
    quantityKind: "count",
  },
};

const FAMILY_CONFIGS: readonly FamilyConfig[] = [
  {
    family: "grocery",
    keywords: ["grocery", "rice", "oil", "flour", "food"],
    defaultModes: ["carton", "pack", "loose"],
    defaultUnits: {
      orderUnit: "carton",
      stockUnit: "carton",
      conversionUnit: "pack",
      displayUnit: "pack",
    },
    variantDimensions: ["brand", "pack_size", "supply_mode"],
    supportsTrackedAssets: false,
    defaultEmptyReturn: false,
    notes:
      "Designed for products that may move from carton to inner packs or loose quantity in retailer flow.",
  },
  {
    family: "fashion",
    keywords: ["fashion", "apparel", "cloth", "clothing", "garment"],
    defaultModes: ["carton", "bundle", "unit"],
    defaultUnits: {
      orderUnit: "carton",
      stockUnit: "carton",
      conversionUnit: "piece",
      displayUnit: "piece",
    },
    variantDimensions: ["color", "size", "material", "pack_size"],
    supportsTrackedAssets: false,
    defaultEmptyReturn: false,
    notes:
      "Optimized for color and size combinations where warehouse packs are ultimately sold as individual pieces.",
  },
  {
    family: "footwear",
    keywords: ["footwear", "shoe", "sandal", "sneaker", "slipper"],
    defaultModes: ["carton", "bundle", "pair"],
    defaultUnits: {
      orderUnit: "carton",
      stockUnit: "carton",
      conversionUnit: "pair",
      displayUnit: "pair",
    },
    variantDimensions: ["size", "color", "material", "pack_size"],
    supportsTrackedAssets: false,
    defaultEmptyReturn: false,
    notes:
      "Supports size-driven purchasing where retailer conversion often ends at pair level rather than single pieces.",
  },
  {
    family: "electronics",
    keywords: ["electronics", "mobile", "device", "phone", "computer"],
    defaultModes: ["box", "unit", "carton"],
    defaultUnits: {
      orderUnit: "box",
      stockUnit: "box",
      conversionUnit: "unit",
      displayUnit: "unit",
    },
    variantDimensions: ["model", "color", "capacity", "pack_size"],
    supportsTrackedAssets: true,
    defaultEmptyReturn: false,
    notes:
      "Supports box or unit-based selling with room for serial-driven workflows in later phases.",
  },
  {
    family: "lpg",
    keywords: ["lpg", "gas", "cylinder"],
    defaultModes: ["cylinder", "unit"],
    defaultUnits: {
      orderUnit: "cylinder",
      stockUnit: "cylinder",
      conversionUnit: "cylinder",
      displayUnit: "cylinder",
    },
    variantDimensions: ["capacity", "supply_mode"],
    supportsTrackedAssets: true,
    defaultEmptyReturn: true,
    notes:
      "Supports returnable or exchange-based cylinder workflows with capacity-specific ordering.",
  },
  {
    family: "bulk_liquid",
    keywords: ["liquid", "drum", "lubricant", "chemical", "solvent"],
    defaultModes: ["drum", "loose", "pack"],
    defaultUnits: {
      orderUnit: "drum",
      stockUnit: "drum",
      conversionUnit: "liter",
      displayUnit: "liter",
    },
    variantDimensions: ["brand", "capacity", "supply_mode"],
    supportsTrackedAssets: true,
    defaultEmptyReturn: true,
    notes:
      "Supports drum-based purchasing with conversion into liquid pools or downstream pack variants.",
  },
  {
    family: "generic",
    keywords: [],
    defaultModes: ["unit", "pack"],
    defaultUnits: {
      orderUnit: "unit",
      stockUnit: "unit",
      conversionUnit: "unit",
      displayUnit: "unit",
    },
    variantDimensions: ["brand"],
    supportsTrackedAssets: false,
    defaultEmptyReturn: false,
    notes:
      "Fallback profile when a product type does not match a specialized family yet.",
  },
] as const;

const BEHAVIOUR_OVERRIDES: Record<InventoryBehaviour, BehaviourOverride> = {
  auto_break: {
    defaultMode: "carton",
    supportedModes: ["carton", "pack"],
    orderUnit: "carton",
    stockUnit: "carton",
    conversionUnit: "pack",
    displayUnit: "pack",
    supportsModeSwitching: true,
  },
  loose_convert: {
    defaultMode: "loose",
    supportedModes: ["loose", "drum", "carton"],
    orderUnit: "kg",
    stockUnit: "kg",
    conversionUnit: "kg",
    displayUnit: "kg",
    supportsModeSwitching: true,
  },
  fixed_pack: {
    defaultMode: "pack",
    supportedModes: ["pack", "unit"],
    orderUnit: "pack",
    stockUnit: "pack",
    conversionUnit: "pack",
    displayUnit: "pack",
    supportsModeSwitching: false,
  },
};

function normalizeToken(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function dedupeModes(
  modes: readonly FulfillmentMode[],
): readonly FulfillmentMode[] {
  return [...new Set(modes)];
}

function mergeModes(
  familyModes: readonly FulfillmentMode[],
  overrideModes?: readonly FulfillmentMode[],
): readonly FulfillmentMode[] {
  if (!overrideModes || overrideModes.length === 0) {
    return familyModes;
  }

  return dedupeModes([...overrideModes, ...familyModes]);
}

export function inferProductTypeFamily(
  input: Pick<ProductTypeFulfillmentInput, "slug" | "name" | "inventoryBehaviour">,
): ProductTypeFamily {
  const token = `${normalizeToken(input.slug)} ${normalizeToken(input.name)}`.trim();

  if (token.includes("lpg") || token.includes("cylinder") || token.includes("gas")) {
    return "lpg";
  }

  const looksLikeBulkLiquid =
    token.includes("bulk oil") ||
    token.includes("drum oil") ||
    token.includes("industrial oil") ||
    ((token.includes("oil") || token.includes("liquid")) &&
      (token.includes("bulk") || token.includes("drum")));

  if (looksLikeBulkLiquid) {
    return "bulk_liquid";
  }

  if (
    input.inventoryBehaviour === "loose_convert" &&
    /(oil|liquid|chemical|lubricant|solvent|drum)/.test(token)
  ) {
    return "bulk_liquid";
  }

  for (const config of FAMILY_CONFIGS) {
    if (config.family === "generic") {
      continue;
    }

    if (config.keywords.some((keyword) => token.includes(keyword))) {
      return config.family;
    }
  }

  if (input.inventoryBehaviour === "loose_convert") {
    return "grocery";
  }

  return "generic";
}

export function getFamilyConfig(family: ProductTypeFamily): FamilyConfig {
  return (
    FAMILY_CONFIGS.find((config) => config.family === family) ??
    FAMILY_CONFIGS[FAMILY_CONFIGS.length - 1]!
  );
}

export function buildProductTypeFulfillmentProfile(
  input: ProductTypeFulfillmentInput,
): ProductTypeFulfillmentProfile {
  const inventoryBehaviour = input.inventoryBehaviour ?? "fixed_pack";
  const family = inferProductTypeFamily(input);
  const familyConfig = getFamilyConfig(family);
  const behaviour = BEHAVIOUR_OVERRIDES[inventoryBehaviour];

  const supportedModes = mergeModes(
    familyConfig.defaultModes,
    behaviour.supportedModes,
  );

  const profile: ProductTypeFulfillmentProfile = {
    family,
    inventoryBehaviour,
    defaultMode:
      behaviour.defaultMode && supportedModes.includes(behaviour.defaultMode)
        ? behaviour.defaultMode
        : supportedModes[0]!,
    supportedModes,
    orderUnit: behaviour.orderUnit ?? familyConfig.defaultUnits.orderUnit,
    stockUnit: behaviour.stockUnit ?? familyConfig.defaultUnits.stockUnit,
    conversionUnit:
      behaviour.conversionUnit ?? familyConfig.defaultUnits.conversionUnit,
    displayUnit: behaviour.displayUnit ?? familyConfig.defaultUnits.displayUnit,
    variantDimensions: familyConfig.variantDimensions,
    supportsModeSwitching:
      behaviour.supportsModeSwitching ?? inventoryBehaviour !== "fixed_pack",
    supportsTrackedAssets:
      input.trackingType === "serial" ||
      familyConfig.supportsTrackedAssets,
    supportsEmptyReturn:
      Boolean(input.isReturnablePack) || familyConfig.defaultEmptyReturn,
    notes: familyConfig.notes,
  };

  if (family === "lpg") {
    return {
      ...profile,
      supportedModes: dedupeModes(["cylinder", "unit", ...profile.supportedModes]),
      defaultMode: "cylinder",
      orderUnit: "cylinder",
      stockUnit: "cylinder",
      conversionUnit: "cylinder",
      displayUnit: "cylinder",
    };
  }

  if (family === "bulk_liquid" && inventoryBehaviour === "loose_convert") {
    return {
      ...profile,
      defaultMode: "loose",
      orderUnit: "drum",
      stockUnit: "drum",
      conversionUnit: "liter",
      displayUnit: "liter",
    };
  }

  if (family === "electronics" && input.trackingType === "serial") {
    return {
      ...profile,
      supportedModes: dedupeModes(["unit", "box", ...profile.supportedModes]),
      defaultMode: "unit",
    };
  }

  return profile;
}

export function describeFulfillmentProfile(
  profile: ProductTypeFulfillmentProfile,
): string {
  const family = PRODUCT_TYPE_FAMILY_LABELS[profile.family];
  const behaviour = INVENTORY_BEHAVIOUR_LABELS[profile.inventoryBehaviour];
  const modes = profile.supportedModes
    .map((mode) => FULFILLMENT_MODE_LABELS[mode])
    .join(", ");

  return `${family} • ${behaviour} • ${modes}`;
}
