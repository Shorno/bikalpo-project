import { db } from "@bikalpo-project/db";
import {
  damageEntry,
  damageEntryItem,
  emptyPackStock,
  inventory,
  order,
  orderItem,
  productVariant,
  warehousePosSale,
  warehousePosSaleItem,
} from "@bikalpo-project/db/schema";
import { resolveVariantStockSemantics } from "@bikalpo-project/db/variant-definition";
import { and, eq, gte, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { kpiMonths } from "./owner-product-kpis";
import type { ProductListOwner } from "./owner-product-list";

/**
 * Real-time Stock (client spec, 2026-11-24): one row per product with its
 * stock breakdown ("120 Cylinder (30 Empty)", "120 Pack + 900 KG Loose"),
 * a status, and per-size stock with what sold this month for View.
 */

/** Used while a product has no low-stock limit of its own. */
export const DEFAULT_LOW_STOCK_LEVEL = 5;
/** An "expired" damage entry this recent marks the product as expired. */
export const EXPIRED_WARNING_DAYS = 30;

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "expired";

export type StockQuantity = { unit: string; quantity: number };

export type StockBreakdown = {
  /** Packs, cylinders, pieces... grouped by unit. */
  counted: StockQuantity[];
  /** Loose stock grouped by unit (KG, L). */
  loose: StockQuantity[];
  /** Empty containers waiting to be exchanged or returned. */
  empty: number;
};

export type StockVariantInput = {
  entryType: "pack" | "loose";
  /** "Cylinder", "Pack"... for counted stock; "KG", "L" for loose. */
  unit: string;
  availableQty: number;
  emptyQty: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function unitName(unit: string) {
  const trimmed = unit.trim();
  if (!trimmed) return "Unit";
  if (/^(kg|l|g|ml)$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function addTo(list: StockQuantity[], unit: string, quantity: number) {
  const existing = list.find((item) => item.unit === unit);
  if (existing) existing.quantity = round(existing.quantity + quantity);
  else list.push({ unit, quantity: round(quantity) });
}

export function stockBreakdown(variants: StockVariantInput[]): StockBreakdown {
  const breakdown: StockBreakdown = { counted: [], loose: [], empty: 0 };
  for (const variant of variants) {
    const quantity = Math.max(0, variant.availableQty);
    addTo(
      variant.entryType === "loose" ? breakdown.loose : breakdown.counted,
      unitName(variant.unit),
      quantity,
    );
    breakdown.empty += Math.max(0, variant.emptyQty);
  }
  return breakdown;
}

/** Counted stock when the product has any; otherwise its loose stock. */
export function totalStock(breakdown: StockBreakdown) {
  const counted = breakdown.counted.reduce((sum, item) => sum + item.quantity, 0);
  if (breakdown.counted.length > 0) return round(counted);
  return round(breakdown.loose.reduce((sum, item) => sum + item.quantity, 0));
}

/**
 * Out of stock when nothing is left; expired when an expired entry was
 * recorded recently; low at or below the product's limit; otherwise fine.
 */
export function stockStatus(input: {
  breakdown: StockBreakdown;
  lowStockLevel: number;
  expired: boolean;
}): StockStatus {
  const hasStock = [...input.breakdown.counted, ...input.breakdown.loose].some(
    (item) => item.quantity > 0,
  );
  if (!hasStock) return "out_of_stock";
  if (input.expired) return "expired";
  if (totalStock(input.breakdown) <= input.lowStockLevel) return "low_stock";
  return "in_stock";
}

export type RealtimeStockVariant = {
  variantId: number;
  label: string;
  brandName: string | null;
  entryType: "pack" | "loose";
  unit: string;
  availableQty: number;
  emptyQty: number;
  soldThisMonth: number;
};

export type RealtimeStockProduct = {
  productId: number;
  /** 8-digit Product ID; the product's own code when it has no core identity. */
  productCode: string | null;
  name: string;
  image: string | null;
  typeId: number | null;
  typeName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  /** The product's own limit; 0 means the default is used. */
  lowStockLevel: number;
  effectiveLowStockLevel: number;
  breakdown: StockBreakdown;
  totalStock: number;
  soldThisMonth: number;
  expired: boolean;
  status: StockStatus;
  variants: RealtimeStockVariant[];
};

const NOT_SOLD_ORDER_STATUSES = ["cancelled", "returned"] as const;

/** Quantity of each variant the owner sold (online and at the counter) since a date. */
async function loadSoldQuantities(
  owner: ProductListOwner,
  variantIds: number[],
  since: Date,
) {
  const sold = new Map<number, number>();
  if (variantIds.length === 0) return sold;
  const orderOwner =
    owner.ownerType === "warehouse" ? order.warehouseId : order.shopId;
  const posOwner =
    owner.ownerType === "warehouse"
      ? warehousePosSale.warehouseId
      : warehousePosSale.shopId;
  const [ordered, counter] = await Promise.all([
    db
      .select({
        variantId: orderItem.variantId,
        quantity: sql<string>`sum(${orderItem.quantity})`,
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(
        and(
          eq(orderOwner, owner.ownerId),
          inArray(orderItem.variantId, variantIds),
          notInArray(order.status, [...NOT_SOLD_ORDER_STATUSES]),
          gte(order.createdAt, since),
        ),
      )
      .groupBy(orderItem.variantId),
    db
      .select({
        variantId: warehousePosSaleItem.variantId,
        quantity: sql<string>`sum(${warehousePosSaleItem.quantity})`,
      })
      .from(warehousePosSaleItem)
      .innerJoin(
        warehousePosSale,
        eq(warehousePosSaleItem.saleId, warehousePosSale.id),
      )
      .where(
        and(
          eq(posOwner, owner.ownerId),
          isNotNull(warehousePosSaleItem.variantId),
          inArray(warehousePosSaleItem.variantId, variantIds),
          eq(warehousePosSale.status, "completed"),
          gte(warehousePosSale.createdAt, since),
        ),
      )
      .groupBy(warehousePosSaleItem.variantId),
  ]);
  for (const row of [...ordered, ...counter]) {
    if (row.variantId == null) continue;
    sold.set(
      row.variantId,
      round((sold.get(row.variantId) ?? 0) + Number(row.quantity ?? 0)),
    );
  }
  return sold;
}

/** Variants with a recent "expired" damage entry (shops record these today). */
async function loadExpiredVariantIds(
  owner: ProductListOwner,
  variantIds: number[],
  since: Date,
) {
  if (owner.ownerType !== "shop" || variantIds.length === 0) {
    return new Set<number>();
  }
  const sinceDate = since.toISOString().slice(0, 10);
  const rows = await db
    .selectDistinct({ variantId: damageEntryItem.variantId })
    .from(damageEntryItem)
    .innerJoin(damageEntry, eq(damageEntryItem.damageEntryId, damageEntry.id))
    .where(
      and(
        eq(damageEntry.shopId, owner.ownerId),
        eq(damageEntry.damageType, "expired"),
        eq(damageEntry.status, "active"),
        gte(damageEntry.entryDate, sinceDate),
        inArray(damageEntryItem.variantId, variantIds),
      ),
    );
  return new Set(rows.map((row) => row.variantId));
}

/** The owner's stock, one row per product. Pass a product id for one product. */
export async function loadRealtimeStock(
  owner: ProductListOwner,
  options: { productId?: number; now?: Date } = {},
): Promise<RealtimeStockProduct[]> {
  const now = options.now ?? new Date();
  const ownerType = owner.ownerType === "warehouse" ? "warehouse" : "shop";
  const rows = await db.query.inventory.findMany({
    where: and(
      eq(inventory.ownerType, ownerType),
      eq(inventory.ownerId, owner.ownerId),
      options.productId
        ? inArray(
            inventory.variantId,
            db
              .select({ id: productVariant.id })
              .from(productVariant)
              .where(eq(productVariant.productId, options.productId)),
          )
        : undefined,
    ),
    with: {
      variant: {
        with: {
          brand: { columns: { name: true } },
          sourceVariantOption: true,
          product: {
            with: {
              coreProduct: { columns: { catalogCode: true } },
              category: { with: { type: { columns: { id: true, name: true } } } },
              subCategory: { columns: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const variantIds = rows.map((row) => row.variantId);
  const monthStart = kpiMonths(now, 1)[0]!.start;
  const expiredSince = new Date(
    now.getTime() - EXPIRED_WARNING_DAYS * 24 * 60 * 60 * 1000,
  );
  const [emptyRows, sold, expiredVariantIds] = await Promise.all([
    variantIds.length > 0
      ? db
          .select({
            variantId: emptyPackStock.variantId,
            availableQty: emptyPackStock.availableQty,
          })
          .from(emptyPackStock)
          .where(
            and(
              eq(emptyPackStock.ownerType, ownerType),
              eq(emptyPackStock.ownerId, owner.ownerId),
              inArray(emptyPackStock.variantId, variantIds),
            ),
          )
      : Promise.resolve([]),
    loadSoldQuantities(owner, variantIds, monthStart),
    loadExpiredVariantIds(owner, variantIds, expiredSince),
  ]);
  const emptyByVariant = new Map(
    emptyRows.map((row) => [row.variantId, row.availableQty]),
  );

  const products = new Map<
    number,
    Omit<
      RealtimeStockProduct,
      | "breakdown"
      | "totalStock"
      | "soldThisMonth"
      | "status"
      | "effectiveLowStockLevel"
    >
  >();
  for (const row of rows) {
    const variant = row.variant;
    const item = variant?.product;
    if (!variant || !item || !variant.sourceVariantOption) continue;
    let semantics: ReturnType<typeof resolveVariantStockSemantics>;
    try {
      semantics = resolveVariantStockSemantics(variant.sourceVariantOption);
    } catch {
      continue;
    }
    const entry = products.get(item.id) ?? {
      productId: item.id,
      productCode:
        item.coreProduct?.catalogCode ?? item.catalogCode ?? item.sku ?? null,
      name: item.name,
      image: item.image ?? null,
      typeId: item.category?.type?.id ?? null,
      typeName: item.category?.type?.name ?? null,
      categoryId: item.category?.id ?? null,
      categoryName: item.category?.name ?? null,
      subCategoryId: item.subCategory?.id ?? null,
      subCategoryName: item.subCategory?.name ?? null,
      lowStockLevel: item.reorderLevel ?? 0,
      expired: false,
      variants: [],
    };
    entry.expired ||= expiredVariantIds.has(variant.id);
    entry.variants.push({
      variantId: variant.id,
      label: semantics.displayLabel,
      brandName: variant.brand?.name ?? null,
      entryType: semantics.entryType,
      unit:
        semantics.entryType === "loose"
          ? (semantics.measurementUnit ?? semantics.operationalUnit)
          : semantics.operationalUnit,
      availableQty: round(Number(row.availableQty ?? 0)),
      emptyQty: emptyByVariant.get(variant.id) ?? 0,
      soldThisMonth: sold.get(variant.id) ?? 0,
    });
    products.set(item.id, entry);
  }

  return [...products.values()]
    .map((entry) => {
      const breakdown = stockBreakdown(entry.variants);
      const effectiveLowStockLevel =
        entry.lowStockLevel > 0 ? entry.lowStockLevel : DEFAULT_LOW_STOCK_LEVEL;
      return {
        ...entry,
        variants: [...entry.variants].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        ),
        breakdown,
        totalStock: totalStock(breakdown),
        soldThisMonth: round(
          entry.variants.reduce((sum, item) => sum + item.soldThisMonth, 0),
        ),
        effectiveLowStockLevel,
        status: stockStatus({
          breakdown,
          lowStockLevel: effectiveLowStockLevel,
          expired: entry.expired,
        }),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
