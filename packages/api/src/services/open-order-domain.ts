export type OfferDiscountType = "fixed" | "percentage";

export const OPEN_ORDER_RADIUS_KM = 10;

export interface OfferLineInput {
  quantity: number;
  unitPrice: number;
}

export interface CalculateOfferTotalsInput {
  lines: OfferLineInput[];
  discountType: OfferDiscountType;
  discountValue: number;
  deliveryCharge: number;
}

export interface OfferTotals {
  itemSubtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  finalTotal: number;
}

export type OpenOrderStage =
  | "collecting_offers"
  | "selecting_offer"
  | "confirmed"
  | "cancelled"
  | "no_offers"
  | "expired";

export interface OpenOrderStageInput {
  status: string;
  offerDeadline: Date;
  selectionDeadline: Date;
  offerCount: number;
  now?: Date;
}

export interface CatalogQuantity {
  catalogVariantId: number;
  quantity: number;
}

export interface CatalogInventoryQuantity {
  catalogVariantId: number;
  availableQty: number;
}

export interface EligibleRetailerInput {
  requestedItems: CatalogQuantity[];
  inventory: CatalogInventoryQuantity[];
  distanceKm: number;
  retailerAreaIds: number[];
  consumerAreaId: number;
}

export interface RetailerInventorySource {
  inventoryOwnerId: string;
  inventoryOwnerType: string;
  productCreatorSource: string | null;
  productOwnerId: string | null;
  productStatus: string;
  retailerId: string;
  variantActive: boolean;
  variantType?: string | null;
}

export interface ComparableOffer {
  finalTotal: number;
  deliveryCharge: number;
  distanceKm: number;
}

export interface RetailerOfferLinePriceInput {
  currentStorePrice: number;
  offerUnitPrice: number | null;
  offerDeadline: Date;
  priceFrozenAt: Date | null;
  now?: Date;
}

export type StockHoldAction = "reserve" | "release" | "consume";
export type CartPurchaseMode = "open_order" | "direct";

export interface StockHoldTransition {
  availableDelta: number;
  reservedDelta: number;
  held: boolean;
}

const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateOfferTotals(
  input: CalculateOfferTotalsInput,
): OfferTotals {
  if (
    input.lines.length === 0 ||
    input.lines.some(
      (line) =>
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.unitPrice) ||
        line.unitPrice <= 0,
    )
  ) {
    throw new Error(
      "Every offer line requires a full quantity and positive retailer price.",
    );
  }
  if (!Number.isFinite(input.discountValue) || input.discountValue < 0) {
    throw new Error("Discount value cannot be negative.");
  }
  if (input.discountType === "percentage" && input.discountValue > 100) {
    throw new Error("Percentage discount must be between 0 and 100.");
  }
  if (!Number.isFinite(input.deliveryCharge) || input.deliveryCharge < 0) {
    throw new Error("Delivery charge cannot be negative.");
  }

  const itemSubtotal = money(
    input.lines.reduce(
      (total, line) => total + line.quantity * line.unitPrice,
      0,
    ),
  );
  if (input.discountType === "fixed" && input.discountValue > itemSubtotal) {
    throw new Error("Fixed discount cannot exceed the item subtotal.");
  }
  const requestedDiscount =
    input.discountType === "percentage"
      ? itemSubtotal * (input.discountValue / 100)
      : input.discountValue;
  const discountAmount = money(
    Math.min(itemSubtotal, Math.max(0, requestedDiscount)),
  );
  const deliveryCharge = money(input.deliveryCharge);

  return {
    itemSubtotal,
    discountAmount,
    deliveryCharge,
    finalTotal: money(itemSubtotal - discountAmount + deliveryCharge),
  };
}

export function getOpenOrderStage(input: OpenOrderStageInput): OpenOrderStage {
  if (isOpenOrderFulfillmentStatus(input.status)) return "confirmed";
  if (input.status === "cancelled") return "cancelled";

  const now = input.now ?? new Date();
  if (now >= input.selectionDeadline) return "expired";
  if (now >= input.offerDeadline) {
    return input.offerCount > 0 ? "selecting_offer" : "no_offers";
  }
  return "collecting_offers";
}

export function isOpenOrderFulfillmentStatus(status: string): boolean {
  return [
    "confirmed",
    "ready_for_dispatch",
    "partially_invoiced",
    "invoiced",
    "processing",
    "delivered",
    "returned",
  ].includes(status);
}

export function isEligibleRetailer(input: EligibleRetailerInput): boolean {
  if (
    !Number.isFinite(input.distanceKm) ||
    input.distanceKm > OPEN_ORDER_RADIUS_KM ||
    !input.retailerAreaIds.includes(input.consumerAreaId)
  ) {
    return false;
  }

  const requested = new Map<number, number>();
  for (const item of input.requestedItems) {
    requested.set(
      item.catalogVariantId,
      (requested.get(item.catalogVariantId) ?? 0) + item.quantity,
    );
  }
  return [...requested].every(
    ([catalogVariantId, quantity]) =>
      quantity > 0 &&
      input.inventory.some(
        (stock) =>
          stock.catalogVariantId === catalogVariantId &&
          stock.availableQty >= quantity,
      ),
  );
}

export function isRetailerInventorySource(
  input: RetailerInventorySource,
): boolean {
  return (
    input.inventoryOwnerType === "shop" &&
    input.inventoryOwnerId === input.retailerId &&
    input.productCreatorSource === "shop" &&
    input.productOwnerId === input.retailerId &&
    input.productStatus === "active" &&
    input.variantActive
  );
}

export function sortComparableOffers<T extends ComparableOffer>(
  offers: T[],
): T[] {
  return [...offers].sort(
    (left, right) =>
      left.finalTotal - right.finalTotal ||
      left.deliveryCharge - right.deliveryCharge ||
      left.distanceKm - right.distanceKm,
  );
}

export function resolveRetailerOfferLinePrice(
  input: RetailerOfferLinePriceInput,
): { displayPrice: number; source: "current_store" | "frozen_offer" } {
  const frozen =
    input.priceFrozenAt !== null ||
    (input.now ?? new Date()) >= input.offerDeadline;
  if (frozen && input.offerUnitPrice !== null) {
    return { displayPrice: input.offerUnitPrice, source: "frozen_offer" };
  }
  return { displayPrice: input.currentStorePrice, source: "current_store" };
}

export function planStockHoldTransition(input: {
  held: boolean;
  action: StockHoldAction;
  quantity: number;
}): StockHoldTransition {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Stock hold quantity must be a positive integer.");
  }
  if (input.action === "reserve") {
    return input.held
      ? { availableDelta: 0, reservedDelta: 0, held: true }
      : {
          availableDelta: -input.quantity,
          reservedDelta: input.quantity,
          held: true,
        };
  }
  if (!input.held) {
    return { availableDelta: 0, reservedDelta: 0, held: false };
  }
  return input.action === "release"
    ? {
        availableDelta: input.quantity,
        reservedDelta: -input.quantity,
        held: false,
      }
    : { availableDelta: 0, reservedDelta: -input.quantity, held: false };
}

export function resolveCartTransition(input: {
  hasItems: boolean;
  currentMode: CartPurchaseMode | null;
  currentDirectShopId: string | null;
  requestedMode: CartPurchaseMode;
  requestedDirectShopId: string | null;
  replaceCart: boolean;
}): { replaceExistingItems: boolean } {
  if (!input.hasItems) return { replaceExistingItems: false };
  const compatible =
    input.currentMode === input.requestedMode &&
    (input.requestedMode === "open_order" ||
      input.currentDirectShopId === input.requestedDirectShopId);
  if (compatible) return { replaceExistingItems: false };
  if (!input.replaceCart) {
    throw new Error(
      "Replace the current cart to switch purchase mode or retailer.",
    );
  }
  return { replaceExistingItems: true };
}
