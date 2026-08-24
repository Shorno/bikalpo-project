type AddCartItem = (
  productId: number,
  quantity?: number,
  variantId?: number,
  shopId?: string,
  purchaseMode?: "open_order" | "direct",
  cylinderSaleMode?: "new" | "exchange",
) => Promise<void>;

interface RetailerQuickAddInput {
  productId: number;
  variantId: number;
  shopId: string;
  cylinderSaleMode?: "new" | "exchange";
}

export async function addRetailerProductToCart(
  addItem: AddCartItem,
  { productId, variantId, shopId, cylinderSaleMode }: RetailerQuickAddInput,
) {
  await addItem(productId, 1, variantId, shopId, "direct", cylinderSaleMode);
}
