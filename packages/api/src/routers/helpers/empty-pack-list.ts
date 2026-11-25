/**
 * Empty Pack page (client, 2026-11-25): the pure part, testable without a
 * database.
 *
 * In Market: empty cylinders a customer still owes. On an Exchange sale
 * the customer hands back one empty per cylinder; at delivery the driver
 * records how many came back, and the shortfall is saved on the order line
 * as `convertedToNewQty` (10 exchanged, 5 returned → 5 in market). New
 * sales owe no empty.
 *
 * Total: every cylinder of the size the seller holds or is owed — full in
 * stock, empties in hand, and in market.
 */

export type EmptyPackSize = {
  variantId: number;
  productId: number;
  productCode: string | null;
  productName: string;
  label: string;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  fullQty: number;
  emptyQty: number;
};

/** A delivered order line for one of the sizes. */
export type EmptyPackSale = {
  variantId: number | null;
  orderNumber: string;
  saleMode: string | null;
  missingEmptyQty: number | null;
};

export type InMarketOrder = { orderNumber: string; quantity: number };

export type EmptyPackVariant = {
  variantId: number;
  label: string;
  totalQty: number;
  inMarketQty: number;
  inMarketOrders: InMarketOrder[];
};

export type EmptyPackProduct = {
  productId: number;
  productCode: string | null;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  totalQty: number;
  inMarketQty: number;
  inMarketOrders: InMarketOrder[];
  variants: EmptyPackVariant[];
};

function addOrder(list: InMarketOrder[], orderNumber: string, quantity: number) {
  const existing = list.find((entry) => entry.orderNumber === orderNumber);
  if (existing) existing.quantity += quantity;
  else list.push({ orderNumber, quantity });
}

/** One row per product, its sizes underneath, products by name. */
export function buildEmptyPackList(
  sizes: EmptyPackSize[],
  sales: EmptyPackSale[],
): EmptyPackProduct[] {
  const variants = new Map<number, EmptyPackVariant & { size: EmptyPackSize }>();
  for (const size of sizes) {
    variants.set(size.variantId, {
      size,
      variantId: size.variantId,
      label: size.label,
      totalQty: 0,
      inMarketQty: 0,
      inMarketOrders: [],
    });
  }

  for (const sale of sales) {
    if (sale.variantId == null || sale.saleMode !== "exchange") continue;
    const variant = variants.get(sale.variantId);
    const missing = Math.max(0, Math.trunc(sale.missingEmptyQty ?? 0));
    if (!variant || missing === 0) continue;
    variant.inMarketQty += missing;
    addOrder(variant.inMarketOrders, sale.orderNumber, missing);
  }

  const products = new Map<number, EmptyPackProduct>();
  for (const { size, ...variant } of variants.values()) {
    variant.totalQty = size.fullQty + size.emptyQty + variant.inMarketQty;
    const product = products.get(size.productId) ?? {
      productId: size.productId,
      productCode: size.productCode,
      name: size.productName,
      categoryId: size.categoryId,
      categoryName: size.categoryName,
      subCategoryId: size.subCategoryId,
      subCategoryName: size.subCategoryName,
      totalQty: 0,
      inMarketQty: 0,
      inMarketOrders: [],
      variants: [],
    };
    product.totalQty += variant.totalQty;
    product.inMarketQty += variant.inMarketQty;
    for (const entry of variant.inMarketOrders) {
      addOrder(product.inMarketOrders, entry.orderNumber, entry.quantity);
    }
    product.variants.push(variant);
    products.set(size.productId, product);
  }

  for (const product of products.values()) {
    product.variants.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
  }
  return [...products.values()].sort((a, b) => a.name.localeCompare(b.name));
}
