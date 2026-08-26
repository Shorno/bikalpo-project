export type StorefrontCylinderSaleMode = "new" | "exchange";

interface StorefrontDetailVariant {
  id: number;
  price: string | number;
  sortOrder?: number | null;
  isActive?: boolean | null;
  cylinderSale?: {
    exchangeEnabled: boolean;
    exchangeCreditAmount: number;
    defaultMode: StorefrontCylinderSaleMode;
    newUnitPrice?: number;
    effectiveExchangeUnitPrice?: number;
  } | null;
}

export function formatProductCode(productId: number) {
  return `PRD-${String(productId).padStart(6, "0")}`;
}

export function supportsEmptyPackReturn(
  variants: readonly StorefrontDetailVariant[],
) {
  return variants.some(
    (variant) =>
      variant.isActive !== false &&
      variant.cylinderSale !== null &&
      variant.cylinderSale !== undefined,
  );
}

export function resolveProductActionsPurchase(
  purchase:
    | { kind: "open_order" }
    | { kind: "direct"; shopId: string }
    | { kind: "warehouse" },
  stockQuantity: number,
) {
  if (purchase.kind === "warehouse") return null;

  return {
    purchaseMode: purchase.kind,
    shopId: purchase.kind === "direct" ? purchase.shopId : undefined,
    inStock: purchase.kind === "open_order" || stockQuantity > 0,
    stockQuantity: purchase.kind === "open_order" ? 999 : stockQuantity,
  };
}

export function resolveStorefrontProductSelection<
  TVariant extends StorefrontDetailVariant,
>({
  variants,
  selectedVariantId,
  requestedSaleMode,
  exchangeAllowed,
}: {
  variants: readonly TVariant[];
  selectedVariantId: number;
  requestedSaleMode: StorefrontCylinderSaleMode;
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
  const effectiveSaleMode: StorefrontCylinderSaleMode = exchangeAvailable
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
