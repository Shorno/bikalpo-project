import { db } from "@bikalpo-project/db";
import {
  consumerPriceLog,
  order,
  orderItem,
  product,
  user,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, max, ne, sql } from "drizzle-orm";

/**
 * The admin-only Product History block on the catalog product page: when the
 * product was created and by whom, its last consumer price change, and how
 * many end-consumer orders included it.
 */
export type AdminProductInsights = {
  createdAt: Date;
  createdByName: string | null;
  lastPriceChangeAt: Date | null;
  /** End-consumer orders (any seller) that include this catalog product. */
  orderCount: number;
};

export async function getAdminProductInsights(
  productId: number,
): Promise<AdminProductInsights | null> {
  const [found] = await db
    .select({
      catalogCode: product.catalogCode,
      createdAt: product.createdAt,
      createdByName: user.name,
    })
    .from(product)
    .leftJoin(user, eq(product.createdById, user.id))
    .where(and(eq(product.id, productId), eq(product.creatorSource, "admin")));
  if (!found) return null;

  // Sellers stock their own copies of a catalog product; they share its
  // Product ID (catalog code), so orders are matched on that.
  const sameProduct = found.catalogCode
    ? inArray(
        orderItem.productId,
        db
          .select({ id: product.id })
          .from(product)
          .where(eq(product.catalogCode, found.catalogCode)),
      )
    : eq(orderItem.productId, productId);

  const [[priceChange], [orders]] = await Promise.all([
    db
      .select({ at: max(consumerPriceLog.createdAt) })
      .from(consumerPriceLog)
      .where(eq(consumerPriceLog.productId, productId)),
    db
      .select({
        count: sql<number>`count(distinct ${order.id})::int`,
      })
      .from(orderItem)
      .innerJoin(order, eq(orderItem.orderId, order.id))
      .where(
        and(
          sameProduct,
          eq(order.orderType, "b2c"),
          ne(order.status, "cancelled"),
          // An open order's parent is a request; its matched sub-orders are the orders.
          sql`NOT (${order.isOpenOrder} AND ${order.parentOrderId} IS NULL)`,
        ),
      ),
  ]);

  return {
    createdAt: found.createdAt,
    createdByName: found.createdByName,
    lastPriceChangeAt: priceChange?.at ?? null,
    orderCount: Number(orders?.count ?? 0),
  };
}
