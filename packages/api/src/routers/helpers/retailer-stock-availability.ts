export interface RetailerBrand {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
}

export interface RetailerStockRow {
  availableQty: string | number | null;
  retailPrice: string | number | null;
  variant: {
    isActive: boolean | null;
    product: {
      status: string;
      visibility: string;
      creatorSource: string;
      createdById: string | null;
      scheduledAt: Date | null;
      brand?: RetailerBrand | null;
    } | null;
  } | null;
}

/** Keep catalog products and brand navigation on the same availability rules. */
export function isAvailableRetailerStock(
  row: RetailerStockRow,
  shopId: string,
  now: Date,
) {
  const product = row.variant?.product;
  return Boolean(
    product &&
      row.variant?.isActive &&
      product.status === "active" &&
      product.visibility === "public" &&
      product.creatorSource === "shop" &&
      product.createdById === shopId &&
      (product.scheduledAt === null || product.scheduledAt <= now) &&
      Number(row.availableQty ?? 0) > 0 &&
      Number(row.retailPrice ?? 0) > 0,
  );
}

export function collectAvailableRetailerBrands(
  rows: RetailerStockRow[],
  shopId: string,
  now: Date,
): RetailerBrand[] {
  const brands = new Map<number, RetailerBrand>();
  for (const row of rows) {
    const brand = row.variant?.product?.brand;
    if (brand && isAvailableRetailerStock(row, shopId, now)) {
      brands.set(brand.id, {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo,
      });
    }
  }
  return [...brands.values()].sort(
    (a, b) => a.name.localeCompare(b.name, "en") || a.id - b.id,
  );
}
