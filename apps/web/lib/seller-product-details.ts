export type SellerCylinderSaleMode = "new" | "exchange";

interface SellerDetailVariant {
  id: number;
  price: string | number;
  sortOrder?: number | null;
  isActive?: boolean | null;
  cylinderSale?: {
    exchangeEnabled: boolean;
    exchangeCreditAmount: number;
    defaultMode: SellerCylinderSaleMode;
    newUnitPrice?: number;
    effectiveExchangeUnitPrice?: number;
  } | null;
}

export function formatProductCode(productId: number) {
  return `PRD-${String(productId).padStart(6, "0")}`;
}

export function resolveSellerProductSelection<
  TVariant extends SellerDetailVariant,
>({
  variants,
  selectedVariantId,
  requestedSaleMode,
  exchangeAllowed,
}: {
  variants: readonly TVariant[];
  selectedVariantId: number;
  requestedSaleMode: SellerCylinderSaleMode;
  exchangeAllowed: boolean;
}) {
  const sortedVariants = variants
    .filter((variant) => variant.isActive !== false)
    .toSorted(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id - right.id,
    );
  const selectedVariant =
    sortedVariants.find((variant) => variant.id === selectedVariantId) ??
    sortedVariants[0];
  const exchangeAvailable = Boolean(
    exchangeAllowed && selectedVariant?.cylinderSale?.exchangeEnabled,
  );
  const effectiveSaleMode: SellerCylinderSaleMode = exchangeAvailable
    ? requestedSaleMode
    : "new";
  const newPrice = Number(
    selectedVariant?.cylinderSale?.newUnitPrice ?? selectedVariant?.price ?? 0,
  );
  const exchangePrice = Math.max(
    0,
    Number(
      selectedVariant?.cylinderSale?.effectiveExchangeUnitPrice ??
        newPrice -
          Number(selectedVariant?.cylinderSale?.exchangeCreditAmount ?? 0),
    ),
  );

  return {
    sortedVariants,
    selectedVariant,
    exchangeAvailable,
    effectiveSaleMode,
    newPrice,
    exchangePrice,
    selectedPrice: effectiveSaleMode === "exchange" ? exchangePrice : newPrice,
  };
}
