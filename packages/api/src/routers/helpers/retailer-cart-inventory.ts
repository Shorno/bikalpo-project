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
