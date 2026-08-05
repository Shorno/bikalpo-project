export const PRODUCT_TYPE_SELLER_ROLES = [
  "retailer",
  "wholesaler",
  "distributor",
  "manufacturer",
  "importer",
] as const;

export type ProductTypeSellerRole = (typeof PRODUCT_TYPE_SELLER_ROLES)[number];

export type ProductTypeSellerRankingRow = {
  userId: string;
  displayName: string;
  deliveredOrderCount: number;
  averageRating: number;
};

export function classifyProductTypeSellerRole(
  businessNature: string | null | undefined,
  warehouseFallback: boolean,
): ProductTypeSellerRole {
  const value = businessNature?.toLowerCase().replaceAll(/[^a-z]/g, "") ?? "";
  if (value.includes("import")) return "importer";
  if (value.includes("manufactur")) return "manufacturer";
  if (value.includes("distribut")) return "distributor";
  if (value.includes("wholesale")) return "wholesaler";
  if (value.includes("retail") || value.includes("shop")) return "retailer";
  return warehouseFallback ? "wholesaler" : "retailer";
}

export function compareProductTypeSellers(
  left: ProductTypeSellerRankingRow,
  right: ProductTypeSellerRankingRow,
) {
  return (
    right.deliveredOrderCount - left.deliveredOrderCount ||
    right.averageRating - left.averageRating ||
    left.userId.localeCompare(right.userId)
  );
}

export function resolveProductTypePagination(
  total: number,
  requestedPage: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);

  return {
    page,
    pageSize,
    total,
    totalPages,
    offset: (page - 1) * pageSize,
  };
}
