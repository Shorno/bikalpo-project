import { db } from "@bikalpo-project/db";
import { order, shopFollower } from "@bikalpo-project/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { dashboardPeriodWindow } from "./dashboard-period";

/** Sales orders only: a retailer's procurement is not its business's sales. */
export async function getUserBusinessPerformance(
  account: {
    id: string;
    role: "warehouse" | "shop_owner";
    businessType: string | null;
  },
  now = new Date(),
) {
  const month = dashboardPeriodWindow("monthly", now);
  const ownership =
    account.role === "warehouse"
      ? and(eq(order.warehouseId, account.id), eq(order.orderType, "b2b"))
      : and(eq(order.shopId, account.id), eq(order.orderType, "b2c"));
  const [orders, followers] = await Promise.all([
    db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        pendingOrders: sql<number>`count(*) filter (where ${order.status} = 'pending')::int`,
        cancelledOrders: sql<number>`count(*) filter (where ${order.status} = 'cancelled')::int`,
        totalSales: sql<string>`coalesce(sum(${order.total}::numeric) filter (where ${order.status} = 'delivered'), 0)::text`,
        lastMonthOrders: sql<number>`count(*) filter (where ${order.createdAt} >= ${month.previousStart.toISOString()}::timestamp and ${order.createdAt} < ${month.start.toISOString()}::timestamp)::int`,
      })
      .from(order)
      .where(ownership),
    account.role === "shop_owner" && account.businessType === "retail"
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(shopFollower)
          .where(eq(shopFollower.shopId, account.id))
      : Promise.resolve(null),
  ]);
  if (!orders[0])
    throw new Error("Business performance query returned no result");
  return {
    ...orders[0],
    totalSales: Number(orders[0].totalSales),
    shopFollowers: followers?.[0]?.count ?? null,
    lastMonthStart: month.previousStart.toISOString(),
    lastMonthEnd: month.start.toISOString(),
  };
}
