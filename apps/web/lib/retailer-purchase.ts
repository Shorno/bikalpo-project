export interface RetailerPurchaseBounds {
  minimum: number;
  maximum: number;
  increment: number;
  initialQuantity: number;
  canPurchase: boolean;
}

export function getRetailerPurchaseBounds({
  availableQuantity,
  orderMin,
  orderMax,
  orderIncrement,
}: {
  availableQuantity: number;
  orderMin?: number | null;
  orderMax?: number | null;
  orderIncrement?: number | null;
}): RetailerPurchaseBounds {
  const stock = normalizeNonNegativeInteger(availableQuantity);
  const minimum = normalizePositiveInteger(orderMin, 1);
  const configuredMaximum = normalizePositiveInteger(orderMax, stock);
  const maximum = Math.min(stock, configuredMaximum);
  const increment = normalizePositiveInteger(orderIncrement, 1);
  const canPurchase = minimum <= maximum;

  return {
    minimum,
    maximum,
    increment,
    initialQuantity: canPurchase ? minimum : 0,
    canPurchase,
  };
}

export function getNextRetailerQuantity(
  currentQuantity: number,
  direction: "increase" | "decrease",
  bounds: RetailerPurchaseBounds,
) {
  const change =
    direction === "increase" ? bounds.increment : -bounds.increment;
  const nextQuantity = currentQuantity + change;

  if (nextQuantity < bounds.minimum || nextQuantity > bounds.maximum) {
    return currentQuantity;
  }

  return nextQuantity;
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number,
) {
  if (!Number.isFinite(value) || Number(value) <= 0) return fallback;
  return Math.max(1, Math.floor(Number(value)));
}

function normalizeNonNegativeInteger(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}
