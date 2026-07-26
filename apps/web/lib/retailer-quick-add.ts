type AddCartItem = (
  productId: number,
  quantity?: number,
  variantId?: number,
  shopId?: string,
  purchaseMode?: "open_order" | "direct",
) => Promise<void>;

interface RetailerQuickAddInput {
  productId: number;
  variantId: number;
  shopId: string;
}

export async function addRetailerProductToCart(
  addItem: AddCartItem,
  { productId, variantId, shopId }: RetailerQuickAddInput,
) {
  await addItem(productId, 1, variantId, shopId, "direct");
}
