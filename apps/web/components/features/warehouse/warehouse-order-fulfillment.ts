import {
  FULFILLMENT_MODE_LABELS,
  FULFILLMENT_UNITS,
  PRODUCT_TYPE_FAMILY_LABELS,
  isContainerFulfillmentMode,
  supportsFulfillmentMode,
  type FulfillmentMode,
  type ProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";

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
  "unit",
  "pair",
  "cylinder",
] as const;

function normalizePackType(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getVariantDisplayUnit(variant: WarehouseCatalogVariantLike["variant"]) {
  const weightKg = Number(variant.weightKg || 0);
  if (weightKg > 0 && normalizePackType(variant.packType) === "loose") {
    return `${weightKg} KG`;
  }

  return variant.unitLabel || "Unit";
}

export function getFulfillmentFamilyLabel(profile: ProductTypeFulfillmentProfile) {
  return PRODUCT_TYPE_FAMILY_LABELS[profile.family];
}

export function getPreferredContainerMode(
  profile: ProductTypeFulfillmentProfile,
): FulfillmentMode {
  return (
    CONTAINER_MODE_PRIORITY.find((mode) =>
      supportsFulfillmentMode(profile, mode),
    ) ?? profile.defaultMode
  );
}

export function getPreferredDirectMode(
  profile: ProductTypeFulfillmentProfile,
): FulfillmentMode {
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
    Number(variantRow.variant.totalCartonCount || 0) > 0
    || (variantRow.variant.cartonOptions?.length || 0) > 0;
  const isLooseVariant = normalizePackType(variantRow.variant.packType) === "loose";
  const preferredContainerMode = getPreferredContainerMode(profile);
  const preferredDirectMode = getPreferredDirectMode(profile);
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
    .filter((mode) => supportsFulfillmentMode(profile, mode))
    .map((mode) => {
      const usesContainerStock = isContainerFulfillmentMode(mode) && hasCartons;
      const quantityUnitLabel = usesContainerStock
        ? FULFILLMENT_MODE_LABELS[mode]
        : getVariantDisplayUnit(variantRow.variant);
      const stockUnitLabel = usesContainerStock
        ? FULFILLMENT_MODE_LABELS[mode]
        : FULFILLMENT_UNITS[profile.displayUnit].shortLabel;

      return {
        mode,
        label: FULFILLMENT_MODE_LABELS[mode],
        description: usesContainerStock
          ? `Order using ${FULFILLMENT_MODE_LABELS[mode].toLowerCase()} stock.`
          : `Order as ${FULFILLMENT_MODE_LABELS[mode].toLowerCase()} quantity.`,
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
    getWarehouseOrderModeOptions(profile, variantRow)[0]?.mode
    ?? profile.defaultMode
  );
}
