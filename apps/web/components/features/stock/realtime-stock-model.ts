/**
 * Real-time Stock rows as the API sends them, and the text the pages show.
 * Shared by the retailer and wholesaler stock pages.
 */

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "expired";

export type StockQuantity = { unit: string; quantity: number };

export type StockBreakdown = {
  counted: StockQuantity[];
  loose: StockQuantity[];
  empty: number;
};

export type RealtimeStockVariant = {
  variantId: number;
  label: string;
  brandName: string | null;
  entryType: "pack" | "loose";
  unit: string;
  availableQty: number;
  emptyQty: number;
  soldThisMonth: number;
  /** Sold over the same days last month. */
  soldLastMonth: number;
  /** Stock added this month (purchases and manual changes). */
  receivedThisMonth: number;
};

export type RealtimeStockProduct = {
  productId: number;
  productCode: string | null;
  name: string;
  typeId: number | null;
  typeName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  lowStockLevel: number;
  effectiveLowStockLevel: number;
  breakdown: StockBreakdown;
  totalStock: number;
  soldThisMonth: number;
  expired: boolean;
  status: StockStatus;
  variants: RealtimeStockVariant[];
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  expired: "Expired",
};

export function formatQuantity(value: number) {
  return value.toLocaleString("en-BD", { maximumFractionDigits: 2 });
}

/** "120 Cylinder (30 Empty)", "120 Pack + 900 KG Loose", "0 Pack". */
export function formatBreakdown(breakdown: StockBreakdown) {
  const parts = [
    ...breakdown.counted.map(
      (item) => `${formatQuantity(item.quantity)} ${item.unit}`,
    ),
    ...breakdown.loose.map(
      (item) => `${formatQuantity(item.quantity)} ${item.unit} Loose`,
    ),
  ];
  const text = parts.join(" + ") || "0";
  return breakdown.empty > 0
    ? `${text} (${formatQuantity(breakdown.empty)} Empty)`
    : text;
}

/** One size's stock: "25 Cylinder", "40 KG Loose". */
export function formatVariantStock(variant: RealtimeStockVariant) {
  const unit =
    variant.entryType === "loose"
      ? `${variant.unit.toUpperCase()} Loose`
      : variant.unit.charAt(0).toUpperCase() + variant.unit.slice(1);
  return `${formatQuantity(variant.availableQty)} ${unit}`;
}

/** Product ID for display: the 8-digit code, else the stock row id. */
export function productIdLabel(product: RealtimeStockProduct) {
  return product.productCode || `#${product.productId}`;
}

/**
 * Search by name, Product ID or a typed/scanned 13-digit product code
 * (its first 8 digits are the Product ID; brands share it for now).
 */
export function matchesStockSearch(
  product: RealtimeStockProduct,
  query: string,
) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  const digits = text.replace(/[\s-]/g, "");
  if (/^\d{13}$/.test(digits)) {
    return product.productCode?.startsWith(digits.slice(0, 8)) ?? false;
  }
  return [
    product.name,
    productIdLabel(product),
    product.typeName,
    product.categoryName,
    product.subCategoryName,
    ...product.variants.map((variant) => variant.brandName),
  ].some((field) =>
    (field ?? "").toLowerCase().includes(/^\d[\d\s-]*$/.test(text) ? digits : text),
  );
}

export type StockTrend = "up" | "down" | "flat";

/**
 * The Stock arrow: down when more of the size sold this month than came
 * in, up when more came in, flat when they match (or nothing moved).
 */
export function stockTrend(variant: RealtimeStockVariant): StockTrend {
  const net = variant.receivedThisMonth - variant.soldThisMonth;
  return net > 0 ? "up" : net < 0 ? "down" : "flat";
}

/** The Sold arrow: this month so far against the same days last month. */
export function soldTrend(variant: RealtimeStockVariant): StockTrend {
  const change = variant.soldThisMonth - variant.soldLastMonth;
  return change > 0 ? "up" : change < 0 ? "down" : "flat";
}

/** "Cylinder" for 12 KG Cylinder stock; "KG" for loose stock. */
export function variantUnit(variant: RealtimeStockVariant) {
  return variant.entryType === "loose"
    ? variant.unit.toUpperCase()
    : variant.unit.charAt(0).toUpperCase() + variant.unit.slice(1);
}

/**
 * The size alone, for the Size column: "12 KG cylinder" -> "12 KG"
 * (the unit already shows in the Stock column).
 */
export function variantSizeLabel(variant: RealtimeStockVariant) {
  const unit = variant.unit.trim().toLowerCase();
  const words = variant.label.trim().split(/\s+/);
  const last = words.at(-1)?.toLowerCase();
  if (unit && words.length > 1 && (last === unit || last === `${unit}s`)) {
    return words.slice(0, -1).join(" ");
  }
  return variant.label;
}

/** The level the variant table is counted at: "Cylinder", "Pack"... */
export function stockLevelName(product: RealtimeStockProduct) {
  const units = new Set(product.variants.map(variantUnit));
  return units.size === 1 ? [...units][0]! : "Size";
}

/** Total stock as one figure with its unit: "1,200 Cylinder". */
export function formatTotalStock(product: RealtimeStockProduct) {
  return formatBreakdown({ ...product.breakdown, empty: 0 });
}
