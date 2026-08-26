import type { FulfillmentMode } from "@bikalpo-project/db/fulfillment";

export type WarehouseStorefrontOrderMode = "retailer" | "w2w";
export type WarehouseStorefrontSaleMode = "new" | "exchange";
export type WarehouseStorefrontViewMode =
  | "login-only"
  | "shop-owner"
  | "warehouse-to-warehouse"
  | "view-only";

export function resolveWarehouseStorefrontBuyerContext(
  role: string | undefined,
  isConnectedSupplier: boolean,
): {
  viewMode: WarehouseStorefrontViewMode;
  orderMode: WarehouseStorefrontOrderMode | null;
} {
  if (role === "shop_owner") {
    return { viewMode: "shop-owner", orderMode: "retailer" };
  }
  if (role === "warehouse") {
    return isConnectedSupplier
      ? { viewMode: "warehouse-to-warehouse", orderMode: "w2w" }
      : { viewMode: "view-only", orderMode: null };
  }
  return { viewMode: "login-only", orderMode: null };
}

export function getWarehouseStorefrontCheckoutTarget(
  mode: WarehouseStorefrontOrderMode,
) {
  return mode === "retailer"
    ? ("shop_owner.placeWarehouseOrder" as const)
    : ("warehouse.placeWarehouseSupplierOrder" as const);
}

export interface WarehouseStorefrontCartItem {
  variantId: number;
  inventoryId: number;
  productName: string;
  image: string;
  sku: string;
  unitLabel: string;
  price: string;
  availableQty: number;
  quantity: number;
  fulfillmentMode?: FulfillmentMode;
  supplyMode?: FulfillmentMode;
  targetVariantId?: number | null;
  canExchange?: boolean;
  cylinderSaleMode?: WarehouseStorefrontSaleMode;
}

export function warehouseCartLineKey(
  variantId: number,
  cylinderSaleMode?: WarehouseStorefrontSaleMode | string | null,
) {
  return `${variantId}:${cylinderSaleMode ?? "new"}`;
}

export function getWarehouseStorefrontCartKey(
  mode: WarehouseStorefrontOrderMode,
  userId: string | null | undefined,
  warehouseSlug: string,
) {
  if (!userId || !warehouseSlug) return null;

  const prefix =
    mode === "retailer" ? "retailer-warehouse-cart" : "warehouse-supplier-cart";
  return `${prefix}:${userId}:${warehouseSlug}`;
}

export function readWarehouseStorefrontCart(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as WarehouseStorefrontCartItem[])
      : [];
  } catch {
    return [];
  }
}

export function writeWarehouseStorefrontCart(
  storageKey: string | null,
  cart: WarehouseStorefrontCartItem[],
) {
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(cart));
}

export function mergeWarehouseStorefrontCart(
  cart: WarehouseStorefrontCartItem[],
  item: Omit<WarehouseStorefrontCartItem, "quantity">,
  quantity: number,
  existingIncrement = 1,
) {
  const availableQty = Math.max(0, Number(item.availableQty) || 0);
  if (availableQty <= 0) return cart;

  const requestedQuantity = Math.max(1, Number(quantity) || 1);
  const lineKey = warehouseCartLineKey(item.variantId, item.cylinderSaleMode);
  const existing = cart.find(
    (entry) =>
      warehouseCartLineKey(entry.variantId, entry.cylinderSaleMode) === lineKey,
  );

  if (existing) {
    const nextQuantity = Math.min(
      availableQty,
      existing.quantity + Math.max(1, existingIncrement),
    );
    return cart.map((entry) =>
      warehouseCartLineKey(entry.variantId, entry.cylinderSaleMode) === lineKey
        ? { ...entry, ...item, quantity: nextQuantity }
        : entry,
    );
  }

  return [
    ...cart,
    {
      ...item,
      availableQty,
      quantity: Math.min(availableQty, requestedQuantity),
    },
  ];
}

export function updateWarehouseStorefrontCartQuantity(
  cart: WarehouseStorefrontCartItem[],
  variantId: number,
  delta: number,
  cylinderSaleMode: WarehouseStorefrontSaleMode = "new",
) {
  const lineKey = warehouseCartLineKey(variantId, cylinderSaleMode);

  return cart
    .map((entry) => {
      if (
        warehouseCartLineKey(entry.variantId, entry.cylinderSaleMode) !==
        lineKey
      ) {
        return entry;
      }

      const availableQty = Math.max(0, Number(entry.availableQty) || 0);
      const quantity = Math.max(
        0,
        Math.min(availableQty, entry.quantity + delta),
      );
      return { ...entry, quantity };
    })
    .filter((entry) => entry.quantity > 0);
}

export function removeWarehouseStorefrontCartItem(
  cart: WarehouseStorefrontCartItem[],
  variantId: number,
  cylinderSaleMode: WarehouseStorefrontSaleMode = "new",
) {
  const lineKey = warehouseCartLineKey(variantId, cylinderSaleMode);
  return cart.filter(
    (entry) =>
      warehouseCartLineKey(entry.variantId, entry.cylinderSaleMode) !== lineKey,
  );
}
