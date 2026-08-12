import {
  type FulfillmentMode,
  type InventoryBehaviour,
} from "@bikalpo-project/db/fulfillment";
import type { VariantOperations } from "@bikalpo-project/db/variant-definition";

export type WarehouseOrderProductTypeContext = {
  inventoryBehaviour?: InventoryBehaviour | null;
};

export type WarehouseOrderModeRequest = {
  requestedMode?: FulfillmentMode | null;
  fallbackMode?: FulfillmentMode | null;
  activeCartonCount?: number | null;
  productType: WarehouseOrderProductTypeContext;
  variantOperations: VariantOperations;
};

export type WarehouseOrderStockStrategy =
  | "container_count"
  | "direct_quantity";

export type ResolvedWarehouseOrderMode = {
  inventoryBehaviour: InventoryBehaviour;
  mode: FulfillmentMode;
  stockStrategy: WarehouseOrderStockStrategy;
  requiresTargetVariant: boolean;
  supportsRequestedMode: boolean;
  availableModes: FulfillmentMode[];
};

export function resolveWarehouseOrderMode(
  input: WarehouseOrderModeRequest,
): ResolvedWarehouseOrderMode {
  const inventoryBehaviour = input.productType.inventoryBehaviour ?? "fixed_pack";
  const hasCartons = Number(input.activeCartonCount || 0) > 0;
  const operationalMode = operationalFulfillmentMode(input.variantOperations);
  const requestedMode = input.requestedMode ?? input.fallbackMode ?? operationalMode;
  const allowedModes = new Set<FulfillmentMode>([operationalMode]);
  if (hasCartons) allowedModes.add("carton");
  if (inventoryBehaviour === "loose_convert") allowedModes.add("loose");
  const supportsRequestedMode = allowedModes.has(requestedMode);
  const mode = supportsRequestedMode ? requestedMode : operationalMode;
  const stockStrategy: WarehouseOrderStockStrategy =
    mode === "carton" && hasCartons
      ? "container_count"
      : "direct_quantity";

  const requiresTargetVariant =
    stockStrategy === "container_count"
    && inventoryBehaviour === "auto_break";

  return {
    inventoryBehaviour,
    mode,
    stockStrategy,
    requiresTargetVariant,
    supportsRequestedMode,
    availableModes: [...allowedModes],
  };
}

export function operationalFulfillmentMode(
  operations: VariantOperations,
): FulfillmentMode {
  if (operations.receivingMode === "loose") return "loose";
  if (operations.receivingMode === "pack") {
    switch (operations.operationalUnit) {
      case "box":
      case "bundle":
      case "drum":
        return operations.operationalUnit;
      default:
        return "pack";
    }
  }
  switch (operations.operationalUnit) {
    case "pair":
    case "cylinder":
      return operations.operationalUnit;
    default:
      return "unit";
  }
}
