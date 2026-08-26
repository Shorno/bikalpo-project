export type ProductCardCylinderSaleMode = "new" | "exchange";

interface ProductCardCartItem {
  id: number;
  productId: number;
  variantId?: number | null;
  shopId?: string | null;
  quantity: number;
  cylinderSale?: { mode: ProductCardCylinderSaleMode } | null;
}

export interface ProductCardSelection {
  productId: number;
  variantId: number;
  shopId: string | null;
  cylinderSaleMode: ProductCardCylinderSaleMode;
}

export function getProductCardSelectionKey(
  selection: ProductCardSelection,
): string {
  return [
    selection.productId,
    selection.variantId,
    selection.shopId ?? "reference",
    selection.cylinderSaleMode,
  ].join(":");
}

export function findProductCardCartItem<T extends ProductCardCartItem>(
  cartItems: readonly T[],
  selection: ProductCardSelection,
): T | undefined {
  return cartItems.find(
    (item) =>
      item.productId === selection.productId &&
      item.variantId === selection.variantId &&
      (item.shopId ?? null) === selection.shopId &&
      (item.cylinderSale?.mode ?? "new") === selection.cylinderSaleMode,
  );
}
