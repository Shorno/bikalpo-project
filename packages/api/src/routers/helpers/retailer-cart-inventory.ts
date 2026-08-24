import { isWarehouseCylinderExchangeAvailable } from "@bikalpo-project/db/fulfillment";
import { isSellableRetailerInventory } from "./retailer-inventory-sellability";

export interface RetailerCartInventorySnapshot {
  shopId: string;
  productId: number;
  variantId: number;
  variantIsActive: boolean | null;
  productStatus: string;
  productVisibility: string;
  referenceProductInStock: boolean;
  availableQty: string;
  retailPrice: string | null;
  orderMin: string | null;
  orderMax: string | null;
  orderIncrement: string | null;
  exchangeEnabled: boolean;
  exchangeCreditAmount: string;
  isReturnablePack: boolean;
  typeFamily: string | null;
  typeName: string | null;
  typeSlug: string | null;
}

export function retailerCylinderExchangeAvailable(
  snapshot:
    | Pick<
        RetailerCartInventorySnapshot,
        | "isReturnablePack"
        | "typeFamily"
        | "typeName"
        | "typeSlug"
        | "exchangeEnabled"
      >
    | null
    | undefined,
) {
  if (!snapshot) return false;
  return isWarehouseCylinderExchangeAvailable({
    isReturnablePack: snapshot.isReturnablePack,
    family: snapshot.typeFamily,
    name: snapshot.typeName,
    slug: snapshot.typeSlug,
    exchangeEnabled: snapshot.exchangeEnabled,
  });
}

export type RetailerCartDecision =
  | {
      ok: true;
      availableQuantity: number;
      totalQuantity: number;
      retailPrice: string;
    }
  | {
      ok: false;
      reason: "not_sellable" | "insufficient_stock" | "invalid_quantity";
      availableQuantity: number;
    };

export type CustomerCartSource =
  | { kind: "empty" }
  | { kind: "reference" }
  | { kind: "retailer"; shopId: string }
  | { kind: "mixed" };

export type CustomerCartLineSnapshot = {
  id: number;
  productId: number;
  variantId: number | null;
  shopId: string | null;
  quantity: number;
  price: string;
  cylinderSaleMode?: "new" | "exchange";
};

export function isSameCustomerCartSnapshot(
  expected: CustomerCartLineSnapshot[],
  current: CustomerCartLineSnapshot[],
) {
  if (expected.length !== current.length) return false;

  const currentById = new Map(current.map((line) => [line.id, line]));
  return expected.every((line) => {
    const match = currentById.get(line.id);
    return (
      match?.productId === line.productId &&
      match.variantId === line.variantId &&
      match.shopId === line.shopId &&
      match.quantity === line.quantity &&
      Number(match.price) === Number(line.price) &&
      (match.cylinderSaleMode ?? "new") === (line.cylinderSaleMode ?? "new")
    );
  });
}

export function resolveCustomerCartSource(
  shopIds: Array<string | null | undefined>,
): CustomerCartSource {
  if (shopIds.length === 0) return { kind: "empty" };

  const sources = new Set(shopIds.map((shopId) => shopId ?? null));
  if (sources.size !== 1) return { kind: "mixed" };

  const [shopId] = sources;
  return shopId ? { kind: "retailer", shopId } : { kind: "reference" };
}

export function canAddToCustomerCart(
  existingShopIds: Array<string | null | undefined>,
  requestedShopId?: string,
):
  | { ok: true }
  | {
      ok: false;
      reason: "different_retailer" | "mixed_source";
      shopId?: string;
    } {
  const currentSource = resolveCustomerCartSource(existingShopIds);
  if (currentSource.kind === "empty") return { ok: true };
  if (currentSource.kind === "mixed") {
    return { ok: false, reason: "mixed_source" };
  }

  if (currentSource.kind === "reference") {
    return requestedShopId
      ? { ok: false, reason: "mixed_source" }
      : { ok: true };
  }

  if (!requestedShopId) return { ok: false, reason: "mixed_source" };
  return currentSource.shopId === requestedShopId
    ? { ok: true }
    : {
        ok: false,
        reason: "different_retailer",
        shopId: currentSource.shopId,
      };
}

export function getCustomerCartStockSource({
  shopId,
  referenceProductInStock,
}: {
  shopId?: string;
  referenceProductInStock: boolean;
}) {
  return shopId
    ? ({ source: "retailer", shopId } as const)
    : ({ source: "reference", inStock: referenceProductInStock } as const);
}

export function getCustomerOrderLineDecision(
  snapshot: RetailerCartInventorySnapshot | null | undefined,
  input: {
    shopId?: string | null;
    productId: number;
    variantId?: number | null;
    quantity: number;
    referenceProductInStock: boolean;
    referenceAvailableQuantity?: number | null;
  },
) {
  const stockSource = getCustomerCartStockSource({
    shopId: input.shopId ?? undefined,
    referenceProductInStock: input.referenceProductInStock,
  });

  if (stockSource.source === "reference") {
    if (!stockSource.inStock) {
      return {
        ok: false,
        source: "reference",
        reason: "not_sellable",
      } as const;
    }
    if (
      input.referenceAvailableQuantity != null &&
      input.referenceAvailableQuantity < input.quantity
    ) {
      return {
        ok: false,
        source: "reference",
        reason: "insufficient_stock",
        availableQuantity: Math.max(0, input.referenceAvailableQuantity),
      } as const;
    }
    return { ok: true, source: "reference" } as const;
  }

  if (!input.variantId) {
    return { ok: false, source: "retailer", reason: "not_sellable" } as const;
  }

  const decision = getRetailerCartDecision(snapshot, {
    shopId: stockSource.shopId,
    productId: input.productId,
    variantId: input.variantId,
    requestedQuantity: input.quantity,
    existingQuantity: 0,
  });
  if (!decision.ok) {
    return {
      ok: false,
      source: "retailer",
      reason: decision.reason,
      availableQuantity: decision.availableQuantity,
    } as const;
  }

  return {
    ok: true,
    source: "retailer",
    availableQuantity: decision.availableQuantity,
    retailPrice: decision.retailPrice,
  } as const;
}

export function getRetailerCartDecision(
  snapshot: RetailerCartInventorySnapshot | null | undefined,
  input: {
    shopId: string;
    productId: number;
    variantId: number;
    requestedQuantity: number;
    existingQuantity: number;
  },
): RetailerCartDecision {
  if (
    !snapshot ||
    !isSellableRetailerInventory(snapshot, input) ||
    snapshot.variantId !== input.variantId ||
    snapshot.productStatus !== "active" ||
    snapshot.productVisibility !== "public"
  ) {
    return { ok: false, reason: "not_sellable", availableQuantity: 0 };
  }

  const availableQuantity = Math.max(0, Number(snapshot.availableQty));
  const totalQuantity = input.existingQuantity + input.requestedQuantity;
  if (totalQuantity > availableQuantity) {
    return {
      ok: false,
      reason: "insufficient_stock",
      availableQuantity,
    };
  }

  const minimum = positiveInteger(snapshot.orderMin, 1);
  const maximum = positiveInteger(snapshot.orderMax, availableQuantity);
  const increment = positiveInteger(snapshot.orderIncrement, 1);
  if (
    totalQuantity < minimum ||
    totalQuantity > maximum ||
    (totalQuantity - minimum) % increment !== 0
  ) {
    return { ok: false, reason: "invalid_quantity", availableQuantity };
  }

  return {
    ok: true,
    availableQuantity,
    totalQuantity,
    retailPrice: snapshot.retailPrice!,
  };
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
