import {
  buildProductTypeFulfillmentProfile,
  isContainerFulfillmentMode,
  supportsFulfillmentMode,
  type FulfillmentMode,
  type InventoryBehaviour,
  type ProductTypeFulfillmentProfile,
  type ProductTypeFamily,
} from "@bikalpo-project/db/fulfillment";

export type WarehouseOrderProductTypeContext = {
  family?: ProductTypeFamily | null;
  typeName?: string | null;
  typeSlug?: string | null;
  inventoryBehaviour?: InventoryBehaviour | null;
  trackingType?: "none" | "batch" | "serial" | null;
  isReturnablePack?: boolean | null;
};

export type WarehouseOrderModeRequest = {
  requestedMode?: FulfillmentMode | null;
  fallbackMode?: FulfillmentMode | null;
  activeCartonCount?: number | null;
  productType: WarehouseOrderProductTypeContext;
};

export type WarehouseOrderStockStrategy =
  | "container_count"
  | "direct_quantity";

export type ResolvedWarehouseOrderMode = {
  profile: ProductTypeFulfillmentProfile;
  mode: FulfillmentMode;
  stockStrategy: WarehouseOrderStockStrategy;
  requiresTargetVariant: boolean;
  supportsRequestedMode: boolean;
};

export function buildWarehouseOrderProfile(
  context: WarehouseOrderProductTypeContext,
): ProductTypeFulfillmentProfile {
  return buildProductTypeFulfillmentProfile({
    family: context.family,
    name: context.typeName,
    slug: context.typeSlug,
    inventoryBehaviour: context.inventoryBehaviour,
    trackingType: context.trackingType,
    isReturnablePack: context.isReturnablePack,
  });
}

export function resolveWarehouseOrderMode(
  input: WarehouseOrderModeRequest,
): ResolvedWarehouseOrderMode {
  const profile = buildWarehouseOrderProfile(input.productType);
  const requestedMode =
    input.requestedMode ?? input.fallbackMode ?? profile.defaultMode;
  const supportsRequestedMode = supportsFulfillmentMode(profile, requestedMode);
  const mode = supportsRequestedMode ? requestedMode : profile.defaultMode;
  const hasCartons = Number(input.activeCartonCount || 0) > 0;
  const stockStrategy: WarehouseOrderStockStrategy =
    isContainerFulfillmentMode(mode) && hasCartons
      ? "container_count"
      : "direct_quantity";

  const requiresTargetVariant =
    stockStrategy === "container_count"
    && profile.inventoryBehaviour === "auto_break";

  return {
    profile,
    mode,
    stockStrategy,
    requiresTargetVariant,
    supportsRequestedMode,
  };
}
