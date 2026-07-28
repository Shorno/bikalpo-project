export interface RetailerInventorySellabilitySnapshot {
  shopId: string;
  productId: number;
  variantIsActive: boolean | null;
  retailPrice: string | null;
}

export function isSellableRetailerInventory(
  snapshot: RetailerInventorySellabilitySnapshot | null | undefined,
  input: { shopId: string; productId: number },
) {
  return (
    !!snapshot &&
    snapshot.shopId === input.shopId &&
    snapshot.productId === input.productId &&
    snapshot.variantIsActive === true &&
    Number(snapshot.retailPrice) > 0
  );
}
