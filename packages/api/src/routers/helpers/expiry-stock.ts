import { db } from "@bikalpo-project/db";
import {
  inventory,
  inventoryMovement,
  order,
  purchase,
  supplier,
  user,
} from "@bikalpo-project/db/schema";
import { resolveVariantStockSemantics } from "@bikalpo-project/db/variant-definition";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  allocateBatches,
  DEFAULT_EXPIRY_ALERT_DAYS,
  daysBetween,
  dhakaDate,
  type ExpiryStatus,
  expiryStatus,
  type StockIn,
} from "./expiry-batches";
import type { ProductListOwner } from "./owner-product-list";
import { type StockQuantity, unitName } from "./realtime-stock";

/**
 * Expired Products (Phase 5, client review 2026-11-24): products with
 * expiry tracking that hold stock from a batch past, or close to, its
 * expiry date. Each batch row is one stock-in (or several with the same
 * source, batch number, expiry date and unit, variants comma separated).
 */

export type ExpiryBatch = {
  key: string;
  batchNo: string | null;
  supplierName: string | null;
  invoiceNo: string | null;
  receivedAt: string;
  variants: string[];
  /** Each variant's stock left in this batch, for Create Damage. */
  parts: { variantId: number; leftQty: number }[];
  unit: string;
  receivedQty: number;
  soldQty: number;
  leftQty: number;
  manufactureDate: string | null;
  expiryDate: string;
  daysLeft: number;
  status: ExpiryStatus;
};

export type ExpiryProduct = {
  productId: number;
  productCode: string | null;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  subCategoryId: number | null;
  subCategoryName: string | null;
  alertDays: number;
  /** Expired when any batch with stock has expired, else Expiring. */
  status: "expired" | "expiring";
  /** What is left in the expired batches (expiring ones if none expired). */
  flaggedQty: StockQuantity[];
  /** The most urgent expiry date among those batches. */
  lastExpiry: string;
  /** Every batch that still has stock, soonest expiry first. */
  batches: ExpiryBatch[];
};

const round = (value: number) => Math.round(value * 100) / 100;

type VariantInfo = {
  productId: number;
  label: string;
  unit: string;
};

export async function loadExpiryStock(
  owner: ProductListOwner,
  options: { now?: Date } = {},
): Promise<ExpiryProduct[]> {
  const today = dhakaDate(options.now ?? new Date());
  const ownerType = owner.ownerType === "warehouse" ? "warehouse" : "shop";
  const rows = await db.query.inventory.findMany({
    where: and(
      eq(inventory.ownerType, ownerType),
      eq(inventory.ownerId, owner.ownerId),
    ),
    with: {
      variant: {
        with: {
          sourceVariantOption: true,
          product: {
            with: {
              coreProduct: { columns: { catalogCode: true } },
              category: { columns: { id: true, name: true } },
              subCategory: { columns: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const products = new Map<number, (typeof rows)[number]["variant"]["product"]>();
  const variants = new Map<number, VariantInfo>();
  const available = new Map<number, number>();
  for (const row of rows) {
    const item = row.variant?.product;
    if (!item?.expiryEnabled || !row.variant.sourceVariantOption) continue;
    let semantics: ReturnType<typeof resolveVariantStockSemantics>;
    try {
      semantics = resolveVariantStockSemantics(row.variant.sourceVariantOption);
    } catch {
      continue;
    }
    products.set(item.id, item);
    variants.set(row.variantId, {
      productId: item.id,
      label: semantics.displayLabel,
      unit: unitName(
        semantics.entryType === "loose"
          ? (semantics.measurementUnit ?? semantics.operationalUnit)
          : semantics.operationalUnit,
      ),
    });
    available.set(row.variantId, Number(row.availableQty ?? 0));
  }
  if (variants.size === 0) return [];

  const stockIns = await db
    .select({
      id: inventoryMovement.id,
      variantId: inventoryMovement.variantId,
      quantity: inventoryMovement.quantity,
      unitCost: inventoryMovement.unitCost,
      batchNo: inventoryMovement.batchNo,
      manufactureDate: inventoryMovement.manufactureDate,
      expiryDate: inventoryMovement.expiryDate,
      occurredAt: inventoryMovement.occurredAt,
      purchaseId: inventoryMovement.purchaseId,
      orderId: inventoryMovement.orderId,
    })
    .from(inventoryMovement)
    .where(
      and(
        eq(inventoryMovement.ownerType, ownerType),
        eq(inventoryMovement.ownerId, owner.ownerId),
        eq(inventoryMovement.direction, "in"),
        eq(inventoryMovement.reason, "purchase_receipt"),
        inArray(inventoryMovement.variantId, [...variants.keys()]),
      ),
    )
    .orderBy(desc(inventoryMovement.occurredAt), desc(inventoryMovement.id));

  const left = allocateBatches(
    stockIns.map(
      (row): StockIn => ({
        id: row.id,
        variantId: row.variantId,
        quantity: Number(row.quantity),
        unitCost: Number(row.unitCost ?? 0),
        expiryDate: row.expiryDate,
      }),
    ),
    available,
  );

  // Where each batch came from: the supplier and bill of a purchase, or
  // the seller and order number of a warehouse order.
  const dated = stockIns.filter((row) => row.expiryDate);
  const purchaseIds = [
    ...new Set(dated.map((row) => row.purchaseId).filter((id) => id != null)),
  ] as number[];
  const orderIds = [
    ...new Set(dated.map((row) => row.orderId).filter((id) => id != null)),
  ] as number[];
  const [purchaseRows, orderRows] = await Promise.all([
    purchaseIds.length
      ? db
          .select({
            id: purchase.id,
            invoiceNo: purchase.supplierInvoiceNo,
            purchaseNumber: purchase.purchaseNumber,
            supplierName: supplier.name,
            supplierCompany: supplier.company,
          })
          .from(purchase)
          .leftJoin(supplier, eq(purchase.supplierId, supplier.id))
          .where(inArray(purchase.id, purchaseIds))
      : Promise.resolve([]),
    orderIds.length
      ? db
          .select({
            id: order.id,
            orderNumber: order.orderNumber,
            sellerShop: user.shopName,
            sellerName: user.name,
          })
          .from(order)
          .leftJoin(user, eq(order.warehouseId, user.id))
          .where(inArray(order.id, orderIds))
      : Promise.resolve([]),
  ]);
  const purchaseById = new Map(purchaseRows.map((row) => [row.id, row]));
  const orderById = new Map(orderRows.map((row) => [row.id, row]));

  const batchesByProduct = new Map<number, Map<string, ExpiryBatch>>();
  for (const row of dated) {
    const info = variants.get(row.variantId);
    const leftQty = left.get(row.id) ?? 0;
    if (!info || leftQty <= 0 || !row.expiryDate) continue;
    const alertDays =
      products.get(info.productId)?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
    const source = row.purchaseId
      ? `p${row.purchaseId}`
      : row.orderId
        ? `o${row.orderId}`
        : `m${row.id}`;
    const key = [source, row.batchNo ?? "", row.expiryDate, info.unit].join("|");
    const byKey = batchesByProduct.get(info.productId) ?? new Map();
    const bought = row.purchaseId ? purchaseById.get(row.purchaseId) : null;
    const ordered = row.orderId ? orderById.get(row.orderId) : null;
    const batch: ExpiryBatch = byKey.get(key) ?? {
      key,
      batchNo: row.batchNo,
      supplierName: bought
        ? [...new Set([bought.supplierName, bought.supplierCompany].filter(Boolean))].join(
            " - ",
          ) || null
        : (ordered?.sellerShop ?? ordered?.sellerName ?? null),
      invoiceNo: bought
        ? (bought.invoiceNo ?? bought.purchaseNumber ?? null)
        : (ordered?.orderNumber ?? null),
      receivedAt: row.occurredAt.toISOString(),
      variants: [],
      parts: [],
      unit: info.unit,
      receivedQty: 0,
      soldQty: 0,
      leftQty: 0,
      manufactureDate: row.manufactureDate,
      expiryDate: row.expiryDate,
      daysLeft: daysBetween(today, row.expiryDate),
      status: expiryStatus(row.expiryDate, today, alertDays),
    };
    if (!batch.variants.includes(info.label)) batch.variants.push(info.label);
    const part = batch.parts.find((entry) => entry.variantId === row.variantId);
    if (part) part.leftQty = round(part.leftQty + leftQty);
    else batch.parts.push({ variantId: row.variantId, leftQty: round(leftQty) });
    batch.receivedQty = round(batch.receivedQty + Number(row.quantity));
    batch.leftQty = round(batch.leftQty + leftQty);
    batch.soldQty = round(batch.receivedQty - batch.leftQty);
    byKey.set(key, batch);
    batchesByProduct.set(info.productId, byKey);
  }

  const result: ExpiryProduct[] = [];
  for (const [productId, byKey] of batchesByProduct) {
    const item = products.get(productId);
    if (!item) continue;
    const batches = [...byKey.values()].sort(
      (a, b) =>
        a.expiryDate.localeCompare(b.expiryDate) ||
        (a.batchNo ?? "").localeCompare(b.batchNo ?? "", undefined, {
          numeric: true,
        }),
    );
    for (const batch of batches) {
      batch.variants.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
    }
    const flagged = batches.filter((batch) => batch.status !== "ok");
    if (flagged.length === 0) continue;
    const status = flagged.some((batch) => batch.status === "expired")
      ? "expired"
      : "expiring";
    // Expired Qty: what is left in the expired batches, or in the expiring
    // ones while nothing has expired yet.
    const flaggedQty: StockQuantity[] = [];
    for (const batch of flagged.filter((entry) => entry.status === status)) {
      const existing = flaggedQty.find((entry) => entry.unit === batch.unit);
      if (existing) existing.quantity = round(existing.quantity + batch.leftQty);
      else flaggedQty.push({ unit: batch.unit, quantity: batch.leftQty });
    }
    result.push({
      productId,
      productCode:
        item.coreProduct?.catalogCode ?? item.catalogCode ?? item.sku ?? null,
      name: item.name,
      categoryId: item.category?.id ?? null,
      categoryName: item.category?.name ?? null,
      subCategoryId: item.subCategory?.id ?? null,
      subCategoryName: item.subCategory?.name ?? null,
      alertDays: item.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS,
      status,
      flaggedQty,
      lastExpiry: flagged[0]!.expiryDate,
      batches,
    });
  }
  return result.sort(
    (a, b) => a.lastExpiry.localeCompare(b.lastExpiry) || a.name.localeCompare(b.name),
  );
}

/** Product ids with stock left in an expired batch, for Real-time Stock. */
export async function loadExpiredProductIds(owner: ProductListOwner) {
  const products = await loadExpiryStock(owner);
  return new Set(
    products
      .filter((item) => item.status === "expired")
      .map((item) => item.productId),
  );
}
