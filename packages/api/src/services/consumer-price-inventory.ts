import { db } from "@bikalpo-project/db";
import {
  consumerPriceLog,
  inventory,
  order,
  orderItem,
  product,
  productVariant,
  productVariantPrice,
  purchase,
  purchaseItem,
  stockEntry,
  user,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import { createConsumerPriceService } from "./consumer-reference-prices";

/** Purchase costs are owner records, joined by exact variant identity, never by name. */
export function createConsumerPriceInventoryService(database: typeof db) {
  const priceService = createConsumerPriceService(database);
  return async function getReferencePriceInventory(productId: number) {
    const [found] = await database
      .select({ id: product.id, categoryId: product.categoryId })
      .from(product)
      .where(
        and(eq(product.id, productId), eq(product.creatorSource, "admin")),
      );
    if (!found)
      throw new ORPCError("NOT_FOUND", { message: "Admin product not found" });
    const prices =
      await priceService.fetchConsumerReferenceProductPrices(productId);
    const references = await database
      .select({
        priceId: productVariantPrice.id,
        variantId: productVariant.id,
        catalogId: productVariant.catalogVariantId,
      })
      .from(productVariantPrice)
      .innerJoin(
        productVariant,
        and(
          eq(productVariant.productId, productVariantPrice.productId),
          or(
            eq(productVariant.sourceVariantPriceId, productVariantPrice.id),
            sql`${productVariant.sourceVariantPriceId} IS NULL AND ${productVariant.sourceVariantOptionId} = ${productVariantPrice.variantOptionId} AND ${productVariant.brandId} IS NOT DISTINCT FROM ${productVariantPrice.brandId}`,
          ),
        ),
      )
      .where(
        and(
          eq(productVariantPrice.productId, productId),
          eq(productVariantPrice.isActive, true),
        ),
      );
    const localIds = [...new Set(references.map((row) => row.variantId))];
    const catalogIds = [
      ...new Set(
        references.flatMap((row) =>
          row.catalogId == null ? [] : [row.catalogId],
        ),
      ),
    ];
    const identity = or(
      localIds.length ? inArray(productVariant.id, localIds) : sql`false`,
      catalogIds.length
        ? inArray(productVariant.catalogVariantId, catalogIds)
        : sql`false`,
    )!;
    const ownerName = sql<string>`coalesce(${user.warehouseName}, ${user.shopName}, ${user.name}, 'Unknown owner')`;
    const priceIds = (variantId: number, catalogId: number | null) => [
      ...new Set(
        references
          .filter(
            (row) =>
              row.variantId === variantId ||
              (catalogId != null && row.catalogId === catalogId),
          )
          .map((row) => row.priceId),
      ),
    ];

    const [
      stockRows,
      purchaseRows,
      receiptRows,
      history,
      related,
      performanceRows,
    ] = await Promise.all([
      database
        .select({
          id: inventory.id,
          ownerId: inventory.ownerId,
          ownerType: inventory.ownerType,
          ownerName,
          variantId: productVariant.id,
          catalogId: productVariant.catalogVariantId,
          unit: productVariant.unitLabel,
          available: inventory.availableQty,
          reserved: inventory.reservedQty,
          sellingPrice: inventory.retailPrice,
          updatedAt: inventory.updatedAt,
        })
        .from(inventory)
        .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
        .leftJoin(user, eq(user.id, inventory.ownerId))
        .where(identity)
        .orderBy(desc(inventory.updatedAt), desc(inventory.id))
        .limit(201),
      database
        .select({
          id: purchaseItem.id,
          ownerId: purchase.warehouseId,
          ownerType: purchase.ownerType,
          ownerName,
          variantId: productVariant.id,
          catalogId: productVariant.catalogVariantId,
          unit: purchaseItem.quantityUnit,
          unitCost: purchaseItem.unitCost,
          mode: purchase.entryMode,
          reference: purchase.purchaseNumber,
          quantity: purchaseItem.receivedQty,
          recordedAt: purchaseItem.updatedAt,
        })
        .from(purchaseItem)
        .innerJoin(purchase, eq(purchaseItem.purchaseId, purchase.id))
        .innerJoin(
          productVariant,
          eq(purchaseItem.variantId, productVariant.id),
        )
        .leftJoin(user, eq(user.id, purchase.warehouseId))
        .where(
          and(
            identity,
            inArray(purchase.status, ["received", "partial"]),
            gt(purchaseItem.receivedQty, "0"),
          ),
        )
        .orderBy(desc(purchaseItem.updatedAt), desc(purchaseItem.id))
        .limit(201),
      database
        .select({
          id: stockEntry.id,
          ownerId: stockEntry.warehouseId,
          ownerName,
          variantId: productVariant.id,
          catalogId: productVariant.catalogVariantId,
          unit: stockEntry.costType,
          unitCost: stockEntry.purchasePrice,
          reference: stockEntry.reference,
          quantity: stockEntry.quantity,
          recordedAt: stockEntry.createdAt,
        })
        .from(stockEntry)
        .innerJoin(productVariant, eq(stockEntry.variantId, productVariant.id))
        .leftJoin(user, eq(user.id, stockEntry.warehouseId))
        .where(identity)
        .orderBy(desc(stockEntry.createdAt), desc(stockEntry.id))
        .limit(201),
      database
        .select({
          id: consumerPriceLog.id,
          variantPriceId: consumerPriceLog.variantPriceId,
          actorId: consumerPriceLog.actorId,
          source: consumerPriceLog.source,
          previousPrice: consumerPriceLog.previousPrice,
          newPrice: consumerPriceLog.newPrice,
          previousExchangePrice: consumerPriceLog.previousExchangePrice,
          newExchangePrice: consumerPriceLog.newExchangePrice,
          createdAt: consumerPriceLog.createdAt,
        })
        .from(consumerPriceLog)
        .where(eq(consumerPriceLog.productId, productId))
        .orderBy(desc(consumerPriceLog.createdAt), desc(consumerPriceLog.id))
        .limit(20),
      database
        .select({ id: product.id, name: product.name, image: product.image })
        .from(product)
        .where(
          and(
            eq(product.creatorSource, "admin"),
            eq(product.status, "active"),
            eq(product.categoryId, found.categoryId),
            ne(product.id, productId),
          ),
        )
        .orderBy(product.id)
        .limit(4),
      database
        .select({
          orders: sql<number>`count(distinct ${order.id})::int`,
          sales: sql<string>`coalesce(sum(${orderItem.totalPrice}), 0)::text`,
        })
        .from(orderItem)
        .innerJoin(order, eq(orderItem.orderId, order.id))
        .where(
          and(
            eq(order.status, "delivered"),
            or(
              catalogIds.length
                ? inArray(orderItem.catalogVariantId, catalogIds)
                : sql`false`,
              sql`EXISTS (SELECT 1 FROM product_variant WHERE product_variant.id = ${orderItem.variantId} AND ${identity})`,
            ),
          ),
        ),
    ]);
    const receipts = [
      ...purchaseRows.map((row) => ({
        ...row,
        key: `purchase:${row.id}`,
        source: "Purchase receipt",
        priceIds: priceIds(row.variantId, row.catalogId),
      })),
      ...receiptRows.map((row) => ({
        ...row,
        ownerType: "warehouse",
        mode: null,
        key: `stock:${row.id}`,
        source: "Stock entry",
        unit: row.unit.replace("per_", ""),
        priceIds: priceIds(row.variantId, row.catalogId),
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      )
      .slice(0, 200);
    return {
      prices,
      stock: stockRows.slice(0, 200).map((row) => ({
        ...row,
        priceIds: priceIds(row.variantId, row.catalogId),
      })),
      receipts,
      stockHasMore: stockRows.length > 200,
      receiptsHasMore: purchaseRows.length + receiptRows.length > 200,
      history,
      related,
      performance: performanceRows[0] ?? { orders: 0, sales: "0" },
    };
  };
}

export const getReferencePriceInventory =
  createConsumerPriceInventoryService(db);
