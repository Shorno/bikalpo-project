import { db } from "@bikalpo-project/db";
import { order, user } from "@bikalpo-project/db/schema";
import { and, count, gte, lt, sql } from "drizzle-orm";
import {
  DASHBOARD_TIME_ZONE,
  type DashboardPeriod,
  dashboardGrowthPercent,
  dashboardPeriodWindow,
  dashboardTrendPoints,
} from "./dashboard-period";

type Window = ReturnType<typeof dashboardPeriodWindow>;

function periodCount(
  column: typeof user.createdAt | typeof order.createdAt,
  window: Window,
  previous = false,
) {
  const start = previous ? window.previousStart : window.start;
  const end = previous ? window.previousEnd : window.end;
  return sql<number>`count(*) filter (where ${column} >= ${start.toISOString()}::timestamp
    and ${column} < ${end.toISOString()}::timestamp)::int`;
}

function trendDate(
  column: typeof user.createdAt | typeof order.createdAt,
  window: Window,
) {
  return sql<string>`to_char(date_trunc(${window.unit},
    ${column} at time zone 'UTC' at time zone ${DASHBOARD_TIME_ZONE}), 'YYYY-MM-DD')`;
}

function trendResult(
  window: Window,
  current: number,
  previous: number,
  counts: { date: string; value: number }[],
) {
  return {
    period: window.period,
    currentCount: current,
    previousCount: previous,
    growthPercent: dashboardGrowthPercent(current, previous),
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    previousStart: window.previousStart.toISOString(),
    previousEnd: window.previousEnd.toISOString(),
    points: dashboardTrendPoints(window.buckets, counts),
  };
}

export async function getDashboardPerformance(input: {
  usersPeriod: DashboardPeriod;
  ordersPeriod: DashboardPeriod;
}) {
  const now = new Date();
  const usersWindow = dashboardPeriodWindow(input.usersPeriod, now);
  const ordersWindow = dashboardPeriodWindow(input.ordersPeriod, now);

  // One read-only snapshot keeps the headline counts and charts consistent.
  // Let query failures propagate: a failed query must never look like zero data.
  return db.transaction(
    async (tx) => {
      const userCounts = await tx.execute<{
        total: number;
        suspended: number;
        inactive: number;
        current: number;
        previous: number;
      }>(sql`
        select
          count(*)::int as total,
          count(*) filter (where u.banned is true)::int as suspended,
          count(*) filter (
            where u.banned is not true and coalesce(
              (u.role = 'shop_owner' and (u.seller_status = 'pending' or sa.status = 'pending'))
              or (u.role = 'warehouse' and wa.status = 'pending'), false)
          )::int as inactive,
          count(*) filter (where u.created_at >= ${usersWindow.start.toISOString()}::timestamp
            and u.created_at < ${usersWindow.end.toISOString()}::timestamp)::int as current,
          count(*) filter (where u.created_at >= ${usersWindow.previousStart.toISOString()}::timestamp
            and u.created_at < ${usersWindow.previousEnd.toISOString()}::timestamp)::int as previous
        from "user" u
        left join lateral (
          select status from seller_application where user_id = u.id
          order by created_at desc limit 1
        ) sa on u.role = 'shop_owner'
        left join lateral (
          select status from warehouse_application where user_id = u.id
          order by created_at desc limit 1
        ) wa on u.role = 'warehouse'
        where u.created_at < ${now.toISOString()}::timestamp
      `);
      const orderCounts = await tx
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${order.status} = 'delivered')::int`,
          pending: sql<number>`count(*) filter (where ${order.status} not in ('delivered', 'cancelled', 'returned'))::int`,
          cancelled: sql<number>`count(*) filter (where ${order.status} = 'cancelled')::int`,
          returned: sql<number>`count(*) filter (where ${order.status} = 'returned')::int`,
          current: periodCount(order.createdAt, ordersWindow),
          previous: periodCount(order.createdAt, ordersWindow, true),
        })
        .from(order)
        .where(lt(order.createdAt, now));
      const userTrend = await tx
        .select({
          date: trendDate(user.createdAt, usersWindow),
          value: count(),
        })
        .from(user)
        .where(
          and(
            gte(user.createdAt, usersWindow.seriesStart),
            lt(user.createdAt, now),
          ),
        )
        .groupBy(sql`1`)
        .orderBy(sql`1`);
      const orderTrend = await tx
        .select({
          date: trendDate(order.createdAt, ordersWindow),
          value: count(),
        })
        .from(order)
        .where(
          and(
            gte(order.createdAt, ordersWindow.seriesStart),
            lt(order.createdAt, now),
          ),
        )
        .groupBy(sql`1`)
        .orderBy(sql`1`);

      const users = userCounts.rows[0];
      const orders = orderCounts[0];
      if (!users || !orders)
        throw new Error("Dashboard aggregate query returned no result");

      return {
        updatedAt: now.toISOString(),
        timeZone: DASHBOARD_TIME_ZONE,
        users: {
          total: users.total,
          active: users.total - users.inactive - users.suspended,
          inactive: users.inactive,
          suspended: users.suspended,
          ...trendResult(usersWindow, users.current, users.previous, userTrend),
        },
        orders: {
          total: orders.total,
          completed: orders.completed,
          pending: orders.pending,
          cancelled: orders.cancelled,
          returned: orders.returned,
          ...trendResult(
            ordersWindow,
            orders.current,
            orders.previous,
            orderTrend,
          ),
        },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
