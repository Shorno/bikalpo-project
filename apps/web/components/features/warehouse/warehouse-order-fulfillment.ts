import {
  FULFILLMENT_MODE_LABELS,
  FULFILLMENT_UNITS,
  type FulfillmentMode,
  isContainerFulfillmentMode,
  PRODUCT_TYPE_FAMILY_LABELS,
  type ProductTypeFulfillmentProfile,
  supportsFulfillmentMode,
} from "@bikalpo-project/db/fulfillment";
import { getStockMeasureInfo } from "../../../lib/stock-measure";

export type WarehouseCatalogCartonOption = {
  weightKg: number;
  count: number;
  totalKg: number;
  packsPerCarton: number;
  cartonPrice?: string | null;
  deliveryCost?: string | null;
};

export type WarehouseCatalogVariantLike = {
  availableQty: string;
  variant: {
    unitLabel: string;
    weightKg: string;
    packType: string | null;
    piecesPerUnit?: number | null;
    orderUnit?: string | null;
    totalCartonCount?: number;
    cartonOptions?: WarehouseCatalogCartonOption[];
  };
};

export type WarehouseOrderModeOption = {
  mode: FulfillmentMode;
  label: string;
  description: string;
  quantityUnitLabel: string;
  stockUnitLabel: string;
  usesContainerStock: boolean;
  requiresTargetVariant: boolean;
};

const CONTAINER_MODE_PRIORITY: readonly FulfillmentMode[] = [
  "carton",
  "box",
  "bundle",
  "drum",
  "pack",
] as const;

const DIRECT_MODE_PRIORITY: readonly FulfillmentMode[] = [
  "loose",
  "cylinder",
  "unit",
  "pair",
] as const;

function normalizePackType(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizeVariantMode(
  value?: string | null,
): FulfillmentMode | null {
  const normalized = normalizePackType(value);
  switch (normalized) {
    case "loose":
    case "pack":
    case "carton":
    case "box":
    case "pair":
    case "unit":
    case "cylinder":
    case "drum":
    case "bundle":
      return normalized;
    case "packet":
      return "pack";
    default:
      return null;
  }
}

export function getWarehouseVariantMeasure(
  profile: ProductTypeFulfillmentProfile,
  variant: WarehouseCatalogVariantLike["variant"],
) {
  return getStockMeasureInfo({
    packType: variant.packType,
    orderUnit: variant.orderUnit,
    unitLabel: variant.unitLabel,
    weightKg: variant.weightKg,
    piecesPerUnit: variant.piecesPerUnit,
    family: profile.family,
  });
}

export function getWarehouseVariantMode(
  profile: ProductTypeFulfillmentProfile,
  variant: WarehouseCatalogVariantLike["variant"],
): FulfillmentMode | null {
  if (profile.family === "lpg") {
    return "cylinder";
  }

  const packMode = normalizeVariantMode(variant.packType);
  if (packMode) {
    return packMode;
  }

  const measure = getWarehouseVariantMeasure(profile, variant);
  const normalizedMeasureUnit = measure.quantityUnit.toLowerCase();

  if (normalizedMeasureUnit === "pair") {
    return "pair";
  }

  if (normalizedMeasureUnit === "unit") {
    return "unit";
  }

  return null;
}

function isPackStyleLabel(label?: string | null) {
  const normalized = normalizePackType(label);
  if (!normalized) {
    return false;
  }

  return /(^|\b)(kg|g|gm|gram|liter|litre|ml|pc|pcs|piece|pack|packet|box|bundle|carton|pair|unit|set|dozen|drum|cylinder)(\b|$)/.test(
    normalized,
  );
}

function isFashionAttributeVariant(
  profile: ProductTypeFulfillmentProfile,
  variant: WarehouseCatalogVariantLike["variant"],
) {
  return (
    profile.family === "fashion" &&
    Number(variant.weightKg || 0) <= 0 &&
    !isPackStyleLabel(variant.unitLabel) &&
    normalizePackType(variant.packType) !== "loose"
  );
}

export function getWarehouseModeDisplayLabel(
  profile: ProductTypeFulfillmentProfile,
  mode: FulfillmentMode,
) {
  if (profile.family === "fashion" && mode === "carton") {
    return "Bundle";
  }

  return FULFILLMENT_MODE_LABELS[mode];
}

function getVariantDisplayUnit(
  profile: ProductTypeFulfillmentProfile,
  variant: WarehouseCatalogVariantLike["variant"],
) {
  if (profile.family === "lpg") {
    return FULFILLMENT_UNITS.cylinder.shortLabel;
  }

  if (isFashionAttributeVariant(profile, variant)) {
    return FULFILLMENT_UNITS.piece.shortLabel;
  }

  const weightKg = Number(variant.weightKg || 0);
  if (weightKg > 0 && normalizePackType(variant.packType) === "loose") {
    return `${weightKg} KG`;
  }

  if (profile.family === "fashion") {
    return FULFILLMENT_UNITS[profile.displayUnit].shortLabel;
  }

  if (profile.family === "lpg") {
    return FULFILLMENT_UNITS.cylinder.label;
  }

  return (
    variant.unitLabel ||
    FULFILLMENT_UNITS[profile.displayUnit].shortLabel ||
    "Unit"
  );
}

function getDirectModeUnitLabel(
  profile: ProductTypeFulfillmentProfile,
  variant: WarehouseCatalogVariantLike["variant"],
  mode: FulfillmentMode,
) {
  const measure = getWarehouseVariantMeasure(profile, variant);

  if (mode === "pair") {
    return FULFILLMENT_UNITS.pair.label;
  }

  if (mode === "cylinder") {
    return FULFILLMENT_UNITS.cylinder.label;
  }

  if (mode === "drum") {
    return FULFILLMENT_UNITS.drum.label;
  }

  if (mode === "unit") {
    if (profile.family === "electronics" || measure.quantityUnit === "UNIT") {
      return FULFILLMENT_UNITS.unit.label;
    }

    if (measure.quantityUnit === "PCS") {
      return FULFILLMENT_UNITS.piece.shortLabel;
    }
  }

  return getVariantDisplayUnit(profile, variant);
}

export function getFulfillmentFamilyLabel(
  profile: ProductTypeFulfillmentProfile,
) {
  return PRODUCT_TYPE_FAMILY_LABELS[profile.family];
}

export function getPreferredContainerMode(
  profile: ProductTypeFulfillmentProfile,
  variant?: WarehouseCatalogVariantLike["variant"],
): FulfillmentMode {
  if (variant) {
    const variantMode = getWarehouseVariantMode(profile, variant);
    if (
      variantMode &&
      ["box", "bundle", "drum", "carton"].includes(variantMode) &&
      supportsFulfillmentMode(profile, variantMode)
    ) {
      return variantMode;
    }
  }

  return (
    CONTAINER_MODE_PRIORITY.find((mode) =>
      supportsFulfillmentMode(profile, mode),
    ) ?? profile.defaultMode
  );
}

export function getPreferredDirectMode(
  profile: ProductTypeFulfillmentProfile,
  variant?: WarehouseCatalogVariantLike["variant"],
): FulfillmentMode {
  if (variant) {
    const variantMode = getWarehouseVariantMode(profile, variant);
    if (
      variantMode &&
      ["loose", "cylinder", "unit", "pair", "drum"].includes(variantMode) &&
      supportsFulfillmentMode(profile, variantMode)
    ) {
      return variantMode;
    }

    const measure = getWarehouseVariantMeasure(profile, variant);
    if (
      profile.family === "footwear" &&
      measure.quantityUnit === "PAIR" &&
      supportsFulfillmentMode(profile, "pair")
    ) {
      return "pair";
    }
  }

  return (
    DIRECT_MODE_PRIORITY.find((mode) =>
      supportsFulfillmentMode(profile, mode),
    ) ?? profile.defaultMode
  );
}

export function getWarehouseOrderModeOptions(
  profile: ProductTypeFulfillmentProfile,
  variantRow: WarehouseCatalogVariantLike,
): WarehouseOrderModeOption[] {
  const isFashionAttributeDirect = isFashionAttributeVariant(
    profile,
    variantRow.variant,
  );
  const hasCartons =
    Number(variantRow.variant.totalCartonCount || 0) > 0 ||
    (variantRow.variant.cartonOptions?.length || 0) > 0;
  const isLooseVariant =
    normalizePackType(variantRow.variant.packType) === "loose";
  const preferredContainerMode = getPreferredContainerMode(
    profile,
    variantRow.variant,
  );
  const preferredDirectMode = getPreferredDirectMode(
    profile,
    variantRow.variant,
  );
  const modes = new Set<FulfillmentMode>();

  if (hasCartons) {
    modes.add(preferredContainerMode);
  }

  if (isLooseVariant && supportsFulfillmentMode(profile, "loose")) {
    modes.add("loose");
  }

  if (!hasCartons || profile.inventoryBehaviour !== "auto_break") {
    modes.add(preferredDirectMode);
  }

  if (supportsFulfillmentMode(profile, profile.defaultMode)) {
    modes.add(profile.defaultMode);
  }

  return [...modes]
    .filter((mode) => !(isFashionAttributeDirect && mode === "pack"))
    .filter((mode) => !(profile.family === "lpg" && mode === "unit"))
    .filter((mode) => supportsFulfillmentMode(profile, mode))
    .map((mode) => {
      const usesContainerStock = isContainerFulfillmentMode(mode) && hasCartons;
      const modeLabel = getWarehouseModeDisplayLabel(profile, mode);
      const quantityUnitLabel = usesContainerStock
        ? modeLabel
        : getDirectModeUnitLabel(profile, variantRow.variant, mode);
      const stockUnitLabel = usesContainerStock
        ? modeLabel
        : mode === "pair"
          ? FULFILLMENT_UNITS.pair.label
        : mode === "cylinder"
          ? FULFILLMENT_UNITS.cylinder.label
        : mode === "drum"
          ? FULFILLMENT_UNITS.drum.label
        : profile.family === "electronics" && mode === "unit"
          ? FULFILLMENT_UNITS.unit.label
        : isFashionAttributeDirect
          ? FULFILLMENT_UNITS.piece.shortLabel
        : FULFILLMENT_UNITS[profile.displayUnit].shortLabel;

      return {
        mode,
        label: modeLabel,
        description: usesContainerStock
          ? `Order using ${modeLabel.toLowerCase()} stock.`
          : `Order as ${modeLabel.toLowerCase()} quantity.`,
        quantityUnitLabel,
        stockUnitLabel,
        usesContainerStock,
        requiresTargetVariant:
          usesContainerStock && profile.inventoryBehaviour === "auto_break",
      };
    });
}

export function getDefaultWarehouseOrderMode(
  profile: ProductTypeFulfillmentProfile,
  variantRow: WarehouseCatalogVariantLike,
): FulfillmentMode {
  return (
    getWarehouseOrderModeOptions(profile, variantRow)[0]?.mode ??
    profile.defaultMode
  );
}
