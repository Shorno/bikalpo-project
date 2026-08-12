import {
  FULFILLMENT_MODE_LABELS,
  FULFILLMENT_UNITS,
  type FulfillmentMode,
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
    variantOperations: {
      operationalUnit: string;
      receivingMode: "direct" | "pack" | "loose";
      quantityKind: "count" | "mass" | "volume";
      allowsDecimal: boolean;
      referenceMeasurement?: {
        unit: "kg" | "liter";
        perInventoryUnit: string;
      };
    };
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

function normalizeVariantMode(value?: string | null): FulfillmentMode | null {
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
  _profile: ProductTypeFulfillmentProfile,
  variant: WarehouseCatalogVariantLike["variant"],
): FulfillmentMode | null {
  const operations = variant.variantOperations;
  if (operations.receivingMode === "loose") return "loose";
  if (operations.receivingMode === "pack") {
    return normalizeVariantMode(operations.operationalUnit) ?? "pack";
  }
  return operations.operationalUnit === "pair"
    ? "pair"
    : operations.operationalUnit === "cylinder"
      ? "cylinder"
      : "unit";
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
  const unit = variant.variantOperations.operationalUnit;
  if (unit === "piece") return FULFILLMENT_UNITS.piece.shortLabel;
  const knownUnit = FULFILLMENT_UNITS[unit as keyof typeof FULFILLMENT_UNITS];
  return knownUnit?.shortLabel || variant.unitLabel || unit;
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
    if (
      variant.variantOperations.operationalUnit === "unit" ||
      measure.quantityUnit === "UNIT"
    ) {
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
  const hasCartons =
    Number(variantRow.variant.totalCartonCount || 0) > 0 ||
    (variantRow.variant.cartonOptions?.length || 0) > 0;
  const operationalMode = getWarehouseVariantMode(profile, variantRow.variant);
  const modes = new Set<FulfillmentMode>();

  if (hasCartons) {
    modes.add("carton");
  }

  if (operationalMode) {
    modes.add(operationalMode);
  }

  if (profile.inventoryBehaviour === "loose_convert") {
    modes.add("loose");
  }

  return [...modes].map((mode) => {
    const usesContainerStock = mode === "carton" && hasCartons;
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
            : getVariantDisplayUnit(profile, variantRow.variant);

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
    getWarehouseVariantMode(profile, variantRow.variant) ??
    profile.defaultMode
  );
}
