import { db } from "@bikalpo-project/db";
import {
  order,
  orderItem,
  ownerInventorySnapshot,
  product,
  warehousePosSale,
  warehousePosSaleItem,
} from "@bikalpo-project/db/schema";
import { and, eq, gte, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { dashboardGrowthPercent } from "./dashboard-period";
import {
  groupOwnerProducts,
  loadOwnerProductRows,
  type OwnerProductVariantRow,
  type ProductListOwner,
} from "./owner-product-list";

/**
 * The two KPI cards above the Products list: Products (count, new this
 * month, inactive) and Inventory Value (stock value, change vs last month,
 * slow-moving stock). Months follow the Bangladesh calendar.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TREND_MONTHS = 6;
/** Stock that has not sold for this many days counts as slow-moving. */
export const SLOW_MOVING_DAYS = 30;

export type KpiMonth = {
  /** "YYYY-MM" */
  key: string;
  /** "Jun 2026" */
  label: string;
  start: Date;
  end: Date;
};

export type KpiTrendPoint = { label: string; value: number | null };

export type OwnerProductKpis = {
  products: {
    total: number;
    newThisMonth: number;
    inactive: number;
    /** Product count at the end of each month (now for the current month). */
    trend: KpiTrendPoint[];
  };
  inventoryValue: {
    current: number;
    /** Null until a snapshot exists for last month. */
    previousMonth: number | null;
    changePercent: number | null;
    slowMoving: number;
    /** Stock value at each month's last snapshot; null where none exists. */
    trend: KpiTrendPoint[];
  };
};

const labelFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

/** The last `count` Bangladesh calendar months, oldest first, ending with the current one. */
export function kpiMonths(now: Date, count = TREND_MONTHS): KpiMonth[] {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return Array.from({ length: count }, (_, index) => {
    const offset = index - (count - 1);
    const localStart = new Date(Date.UTC(year, month + offset, 1));
    const localEnd = new Date(Date.UTC(year, month + offset + 1, 1));
    return {
      key: `${localStart.getUTCFullYear()}-${String(localStart.getUTCMonth() + 1).padStart(2, "0")}`,
      label: labelFormat.format(localStart),
      start: new Date(localStart.getTime() - DHAKA_OFFSET_MS),
      end: new Date(localEnd.getTime() - DHAKA_OFFSET_MS),
    };
  });
}

export type KpiProduct = {
  productId: number;
  createdAt: Date;
  isActive: boolean;
  stockQty: number;
  variantIds: number[];
  value: number;
};

/** One entry per product, with total stock across its active variants. */
export function kpiProducts(rows: OwnerProductVariantRow[]): KpiProduct[] {
  const grouped = new Map(
    groupOwnerProducts(rows).map((item) => [item.productId, item]),
  );
  const products = new Map<number, KpiProduct>();
  for (const row of rows) {
    let entry = products.get(row.productId);
    if (!entry) {
      entry = {
        productId: row.productId,
        createdAt: row.productCreatedAt,
        isActive: grouped.get(row.productId)?.isActive ?? false,
        stockQty: 0,
        variantIds: [],
        value: grouped.get(row.productId)?.value ?? 0,
      };
      products.set(row.productId, entry);
    }
    if (row.variantId !== null) {
      entry.variantIds.push(row.variantId);
      const qty = Number(row.availableQty ?? 0);
      if (Number.isFinite(qty) && qty > 0) entry.stockQty += qty;
    }
  }
  return Array.from(products.values());
}

export function productCountKpis(
  products: Pick<KpiProduct, "createdAt" | "isActive">[],
  months: KpiMonth[],
  now: Date,
): OwnerProductKpis["products"] {
  const currentMonth = months[months.length - 1];
  return {
    total: products.length,
    newThisMonth: currentMonth
      ? products.filter((item) => item.createdAt >= currentMonth.start).length
      : 0,
    inactive: products.filter((item) => !item.isActive).length,
    trend: months.map((month) => {
      const cutoff = month.end < now ? month.end : now;
      return {
        label: month.label,
        value: products.filter((item) => item.createdAt < cutoff).length,
      };
    }),
  };
}

/**
 * Products with stock that sold nothing in the last {@link SLOW_MOVING_DAYS}
 * days. Products added within that window are too new to judge.
 */
export function countSlowMoving(
  products: Pick<KpiProduct, "createdAt" | "stockQty" | "variantIds">[],
  soldVariantIds: ReadonlySet<number>,
  since: Date,
) {
  return products.filter(
    (item) =>
      item.stockQty > 0 &&
      item.createdAt < since &&
      !item.variantIds.some((id) => soldVariantIds.has(id)),
  ).length;
}

export function inventoryValueKpis(
  currentValue: number,
  snapshots: ReadonlyMap<string, number>,
  months: KpiMonth[],
  slowMoving: number,
): OwnerProductKpis["inventoryValue"] {
  const current = Math.round(currentValue * 100) / 100;
  const previousKey = months[months.length - 2]?.key;
  const previousMonth =
    previousKey === undefined ? null : (snapshots.get(previousKey) ?? null);
  return {
    current,
    previousMonth,
    changePercent:
      previousMonth === null
        ? null
        : dashboardGrowthPercent(current, previousMonth),
    slowMoving,
    trend: months.map((month, index) => ({
      label: month.label,
      value:
        index === months.length - 1
          ? current
          : (snapshots.get(month.key) ?? null),
    })),
  };
}

const NOT_SOLD_ORDER_STATUSES = ["cancelled", "returned"] as const;

/** Variants (from the given ones) the owner sold, online or at the counter, since a date. */
async function loadSoldVariantIds(
  owner: ProductListOwner,
  variantIds: number[],
  since: Date,
) {
  if (variantIds.length === 0) return new Set<number>();
  const orderOwner =
    owner.ownerType === "warehouse" ? order.warehouseId : order.shopId;
  const posOwner =
    owner.ownerType === "warehouse"
      ? warehousePosSale.warehouseId
      : warehousePosSale.shopId;

  const [ordered, counter] = await Promise.all([
    db
      .selectDistinct({ variantId: orderItem.variantId })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(
        and(
          eq(orderOwner, owner.ownerId),
          inArray(orderItem.variantId, variantIds),
          notInArray(order.status, [...NOT_SOLD_ORDER_STATUSES]),
          gte(order.createdAt, since),
        ),
      ),
    db
      .selectDistinct({ variantId: warehousePosSaleItem.variantId })
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
      ),
  ]);

  return new Set(
    [...ordered, ...counter]
      .map((row) => row.variantId)
      .filter((id): id is number => id !== null),
  );
}

/** Writes this month's value; the month's last write stands as its month-end value. */
async function saveSnapshot(
  owner: ProductListOwner,
  month: string,
  value: number,
  productCount: number,
) {
  await db
    .insert(ownerInventorySnapshot)
    .values({
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      month,
      inventoryValue: value.toFixed(2),
      productCount,
    })
    .onConflictDoUpdate({
      target: [
        ownerInventorySnapshot.ownerType,
        ownerInventorySnapshot.ownerId,
        ownerInventorySnapshot.month,
      ],
      set: {
        inventoryValue: value.toFixed(2),
        productCount,
        updatedAt: new Date(),
      },
    });
}

function totalValue(products: KpiProduct[]) {
  return Math.round(products.reduce((sum, item) => sum + item.value, 0) * 100) / 100;
}

export async function getOwnerProductKpis(
  owner: ProductListOwner,
  now = new Date(),
): Promise<OwnerProductKpis> {
  const months = kpiMonths(now);
  const currentMonth = months[months.length - 1]!;
  const products = kpiProducts(await loadOwnerProductRows(owner));
  const value = totalValue(products);
  const since = new Date(now.getTime() - SLOW_MOVING_DAYS * DAY_MS);

  const [soldVariantIds, snapshotRows] = await Promise.all([
    loadSoldVariantIds(
      owner,
      products.filter((item) => item.stockQty > 0).flatMap((item) => item.variantIds),
      since,
    ),
    db
      .select({
        month: ownerInventorySnapshot.month,
        value: ownerInventorySnapshot.inventoryValue,
      })
      .from(ownerInventorySnapshot)
      .where(
        and(
          eq(ownerInventorySnapshot.ownerType, owner.ownerType),
          eq(ownerInventorySnapshot.ownerId, owner.ownerId),
          inArray(
            ownerInventorySnapshot.month,
            months.map((month) => month.key),
          ),
        ),
      ),
    saveSnapshot(owner, currentMonth.key, value, products.length),
  ]);

  const snapshots = new Map(
    snapshotRows.map((row) => [row.month, Number(row.value)]),
  );
  return {
    products: productCountKpis(products, months, now),
    inventoryValue: inventoryValueKpis(
      value,
      snapshots,
      months,
      countSlowMoving(products, soldVariantIds, since),
    ),
  };
}

/**
 * Records this month's stock value for every owner that has products, so last
 * month's value exists even for owners who did not open the Products page.
 */
export async function snapshotAllOwnerInventories(now = new Date()) {
  const month = kpiMonths(now, 1)[0]!.key;
  const owners = await db
    .selectDistinct({
      source: product.creatorSource,
      ownerId: sql<
        string | null
      >`CASE WHEN ${product.creatorSource} = 'warehouse' THEN COALESCE(${product.createdByWarehouseId}, ${product.createdById}) ELSE ${product.createdById} END`,
    })
    .from(product)
    .where(inArray(product.creatorSource, ["warehouse", "shop"]));

  let saved = 0;
  for (const { source, ownerId } of owners) {
    if (!ownerId || (source !== "warehouse" && source !== "shop")) continue;
    const owner: ProductListOwner = { ownerType: source, ownerId };
    const products = kpiProducts(await loadOwnerProductRows(owner));
    await saveSnapshot(owner, month, totalValue(products), products.length);
    saved += 1;
  }
  return saved;
}
