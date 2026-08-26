type AddCartItem = (
  productId: number,
  quantity?: number,
  variantId?: number,
  shopId?: string,
  purchaseMode?: "open_order" | "direct",
  cylinderSaleMode?: "new" | "exchange",
) => Promise<void>;

interface ReferenceQuickAddInput {
  productId: number;
  variantId: number;
  cylinderSaleMode: "new" | "exchange";
}

export async function addReferenceProductToCart(
  addItem: AddCartItem,
  { productId, variantId, cylinderSaleMode }: ReferenceQuickAddInput,
) {
  await addItem(
    productId,
    1,
    variantId,
    undefined,
    "open_order",
    cylinderSaleMode,
  );
}
