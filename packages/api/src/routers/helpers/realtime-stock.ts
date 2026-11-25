import { db } from "@bikalpo-project/db";
import {
  emptyPackStock,
  inventory,
  inventoryMovement,
  order,
  orderItem,
  product,
  productVariant,
  stockEntry,
  warehousePosSale,
  warehousePosSaleItem,
} from "@bikalpo-project/db/schema";
import { resolveVariantStockSemantics } from "@bikalpo-project/db/variant-definition";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  notInArray,
  sql,
} from "drizzle-orm";
import { allocateCurrentStockLots } from "../../services/warehouse-stock-lots";
import { allocateBatches, dhakaDate } from "./expiry-batches";
import { kpiMonths } from "./owner-product-kpis";
import type { ProductListOwner } from "./owner-product-list";

/**
 * Real-time Stock (client spec, 2026-11-24): one row per product with its
 * stock breakdown ("120 Cylinder (30 Empty)", "120 Pack + 900 KG Loose"),
 * a status, and per-size stock with what sold this month for View.
 */

/** Used while a product has no low-stock limit of its own. */
export const DEFAULT_LOW_STOCK_LEVEL = 5;

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

export function unitName(unit: string) {
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
  /** Sold over the same days last month, for the Sold trend arrow. */
  soldLastMonth: number;
  /**
   * Stock added this month (purchases received, manual changes; returns to
   * the supplier subtract). Against soldThisMonth it gives the Stock arrow.
   */
  receivedThisMonth: number;
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

/**
 * Quantity of each variant the owner sold (online and at the counter) from
 * `since`, up to `until` when given.
 */
async function loadSoldQuantities(
  owner: ProductListOwner,
  variantIds: number[],
  since: Date,
  until?: Date,
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
          until ? lt(order.createdAt, until) : undefined,
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
          until ? lt(warehousePosSale.createdAt, until) : undefined,
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

/**
 * Stock each variant gained since a date from purchases and manual changes
 * (inventory movements other than sales, which are counted as sold).
 */
async function loadReceivedQuantities(
  owner: ProductListOwner,
  variantIds: number[],
  since: Date,
) {
  const received = new Map<number, number>();
  if (variantIds.length === 0) return received;
  const ownerType = owner.ownerType === "warehouse" ? "warehouse" : "shop";
  const rows = await db
    .select({
      variantId: inventoryMovement.variantId,
      quantity: sql<string>`sum(case when ${inventoryMovement.direction} = 'in' then ${inventoryMovement.quantity} else -${inventoryMovement.quantity} end)`,
    })
    .from(inventoryMovement)
    .where(
      and(
        eq(inventoryMovement.ownerType, ownerType),
        eq(inventoryMovement.ownerId, owner.ownerId),
        inArray(inventoryMovement.variantId, variantIds),
        notInArray(inventoryMovement.reason, ["sale_fulfillment", "sale_return"]),
        gte(inventoryMovement.occurredAt, since),
      ),
    )
    .groupBy(inventoryMovement.variantId);
  for (const row of rows) {
    received.set(row.variantId, round(Number(row.quantity ?? 0)));
  }
  return received;
}

/**
 * Warehouse variants still holding stock from a batch past its expiry date,
 * worked out the way the warehouse Expired page does (oldest batches are
 * used up first).
 */
async function loadWarehouseExpiredVariantIds(
  warehouseId: string,
  variantIds: number[],
) {
  const rows = await db
    .select({
      id: stockEntry.id,
      variantId: stockEntry.variantId,
      inventoryDelta: stockEntry.inventoryDelta,
      totalCost: stockEntry.totalCost,
      purchasePrice: stockEntry.purchasePrice,
      expiryDate: stockEntry.expiryDate,
      expiryEnabled: product.expiryEnabled,
    })
    .from(stockEntry)
    .innerJoin(productVariant, eq(stockEntry.variantId, productVariant.id))
    .innerJoin(product, eq(productVariant.productId, product.id))
    .where(
      and(
        eq(stockEntry.warehouseId, warehouseId),
        inArray(stockEntry.variantId, variantIds),
      ),
    )
    .orderBy(desc(stockEntry.createdAt), desc(stockEntry.id));
  const today = dhakaDate(new Date());
  const expiredRows = rows.filter(
    (row) => row.expiryEnabled && row.expiryDate && row.expiryDate < today,
  );
  if (expiredRows.length === 0) return new Set<number>();

  const available = await db
    .select({ variantId: inventory.variantId, qty: inventory.availableQty })
    .from(inventory)
    .where(
      and(
        eq(inventory.ownerType, "warehouse"),
        eq(inventory.ownerId, warehouseId),
        inArray(inventory.variantId, variantIds),
      ),
    );
  const { availableByStockEntry } = allocateCurrentStockLots(
    rows.map((row) => ({ ...row, inventoryDelta: row.inventoryDelta ?? 0 })),
    new Map(available.map((row) => [row.variantId, Number(row.qty)])),
  );
  return new Set(
    expiredRows
      .filter((row) => (availableByStockEntry.get(row.id) ?? 0) > 0)
      .map((row) => row.variantId),
  );
}

/**
 * Shop variants still holding stock from a batch past its expiry date
 * (Phase 5): the batch and expiry typed when the stock came in, with the
 * oldest batches counted as sold first, as on Expired Products.
 */
async function loadShopExpiredVariantIds(shopId: string, variantIds: number[]) {
  const rows = await db
    .select({
      id: inventoryMovement.id,
      variantId: inventoryMovement.variantId,
      quantity: inventoryMovement.quantity,
      unitCost: inventoryMovement.unitCost,
      expiryDate: inventoryMovement.expiryDate,
      expiryEnabled: product.expiryEnabled,
    })
    .from(inventoryMovement)
    .innerJoin(productVariant, eq(inventoryMovement.variantId, productVariant.id))
    .innerJoin(product, eq(productVariant.productId, product.id))
    .where(
      and(
        eq(inventoryMovement.ownerType, "shop"),
        eq(inventoryMovement.ownerId, shopId),
        eq(inventoryMovement.direction, "in"),
        eq(inventoryMovement.reason, "purchase_receipt"),
        inArray(inventoryMovement.variantId, variantIds),
      ),
    )
    .orderBy(desc(inventoryMovement.occurredAt), desc(inventoryMovement.id));
  const today = dhakaDate(new Date());
  const expiredRows = rows.filter(
    (row) => row.expiryEnabled && row.expiryDate && row.expiryDate < today,
  );
  if (expiredRows.length === 0) return new Set<number>();

  const available = await db
    .select({ variantId: inventory.variantId, qty: inventory.availableQty })
    .from(inventory)
    .where(
      and(
        eq(inventory.ownerType, "shop"),
        eq(inventory.ownerId, shopId),
        inArray(inventory.variantId, variantIds),
      ),
    );
  const left = allocateBatches(
    rows.map((row) => ({
      id: row.id,
      variantId: row.variantId,
      quantity: Number(row.quantity),
      unitCost: Number(row.unitCost ?? 0),
      expiryDate: row.expiryDate,
    })),
    new Map(available.map((row) => [row.variantId, Number(row.qty)])),
  );
  return new Set(
    expiredRows
      .filter((row) => (left.get(row.id) ?? 0) > 0)
      .map((row) => row.variantId),
  );
}

/** Variants holding stock from a batch past its expiry date. */
async function loadExpiredVariantIds(
  owner: ProductListOwner,
  variantIds: number[],
) {
  if (variantIds.length === 0) return new Set<number>();
  if (owner.ownerType === "warehouse") {
    return loadWarehouseExpiredVariantIds(owner.ownerId, variantIds);
  }
  if (owner.ownerType !== "shop") return new Set<number>();
  return loadShopExpiredVariantIds(owner.ownerId, variantIds);
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
  const [lastMonth, thisMonth] = kpiMonths(now, 2);
  const monthStart = thisMonth!.start;
  // The same number of days into last month, so the Sold arrow compares
  // like with like.
  const lastMonthUntil = new Date(
    Math.min(
      lastMonth!.start.getTime() + (now.getTime() - monthStart.getTime()),
      monthStart.getTime(),
    ),
  );
  const [emptyRows, sold, expiredVariantIds, soldBefore, received] =
    await Promise.all([
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
    loadExpiredVariantIds(owner, variantIds),
    loadSoldQuantities(owner, variantIds, lastMonth!.start, lastMonthUntil),
    loadReceivedQuantities(owner, variantIds, monthStart),
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
      soldLastMonth: soldBefore.get(variant.id) ?? 0,
      receivedThisMonth: received.get(variant.id) ?? 0,
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
