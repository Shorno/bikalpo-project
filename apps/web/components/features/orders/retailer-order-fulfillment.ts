import {
  FULFILLMENT_MODE_LABELS,
  type FulfillmentMode,
} from "@bikalpo-project/db/fulfillment";

export type RetailerOrderItemFulfillmentLike = {
  quantity?: number | null;
  modifiedQty?: number | null;
  deliveredQty?: number | null;
  supplyMode?: string | null;
  supplyModeLabel?: string | null;
};

type QuantitySelector = (item: RetailerOrderItemFulfillmentLike) => number;

type FulfillmentBreakdown = {
  label: string;
  quantity: number;
  itemCount: number;
};

function toQuantity(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function resolveModeLabel(mode?: string | null) {
  return (
    (mode &&
      mode in FULFILLMENT_MODE_LABELS &&
      FULFILLMENT_MODE_LABELS[mode as FulfillmentMode]) ||
    "Legacy"
  );
}

export function getRetailerOrderItemModeLabel(
  item: RetailerOrderItemFulfillmentLike,
) {
  return item.supplyModeLabel || resolveModeLabel(item.supplyMode);
}

export function getRetailerOrderItemOrderedQty(
  item: RetailerOrderItemFulfillmentLike,
) {
  return toQuantity(item.quantity);
}

export function getRetailerOrderItemEffectiveQty(
  item: RetailerOrderItemFulfillmentLike,
) {
  return toQuantity(item.modifiedQty ?? item.quantity);
}

export function getRetailerOrderItemDeliveredQty(
  item: RetailerOrderItemFulfillmentLike,
) {
  return toQuantity(item.deliveredQty);
}

export function getRetailerOrderItemRemainingQty(
  item: RetailerOrderItemFulfillmentLike,
) {
  return Math.max(
    getRetailerOrderItemEffectiveQty(item) - getRetailerOrderItemDeliveredQty(item),
    0,
  );
}

export function formatRetailerOrderItemQuantity(
  value: number,
  item: RetailerOrderItemFulfillmentLike,
) {
  return `${value} ${getRetailerOrderItemModeLabel(item)}`;
}

export function buildRetailerOrderModeBreakdown(
  items: RetailerOrderItemFulfillmentLike[] | null | undefined,
  selectQuantity: QuantitySelector = getRetailerOrderItemEffectiveQty,
) {
  const modeMap = new Map<string, FulfillmentBreakdown>();

  for (const item of items || []) {
    const label = getRetailerOrderItemModeLabel(item);
    const quantity = selectQuantity(item);
    const existing = modeMap.get(label);

    if (existing) {
      existing.quantity += quantity;
      existing.itemCount += 1;
      continue;
    }

    modeMap.set(label, {
      label,
      quantity,
      itemCount: 1,
    });
  }

  return [...modeMap.values()].sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return left.label.localeCompare(right.label);
  });
}

export function getRetailerOrderFulfillmentSummary(
  items: RetailerOrderItemFulfillmentLike[] | null | undefined,
  selectQuantity: QuantitySelector = getRetailerOrderItemEffectiveQty,
) {
  const breakdown = buildRetailerOrderModeBreakdown(items, selectQuantity);
  const itemCount = (items || []).length;

  if (breakdown.length === 0) {
    return {
      primary: "—",
      secondary: null as string | null,
      badges: [] as string[],
      mixed: false,
      breakdown,
    };
  }

  if (breakdown.length === 1) {
    const [single] = breakdown;

    return {
      primary: `${single.quantity} ${single.label}`,
      secondary: itemCount > 1 ? `${itemCount} line items` : null,
      badges: [single.label],
      mixed: false,
      breakdown,
    };
  }

  return {
    primary: `${itemCount} line items`,
    secondary: breakdown.map((entry) => `${entry.quantity} ${entry.label}`).join(" • "),
    badges: breakdown.map((entry) => entry.label),
    mixed: true,
    breakdown,
  };
}
