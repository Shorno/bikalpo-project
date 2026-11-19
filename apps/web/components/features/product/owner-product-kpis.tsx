"use client";

import type { OwnerProductKpis } from "@bikalpo-project/api/routers/helpers/owner-product-kpis";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Wallet } from "lucide-react";
import {
  DashboardKpiCard,
  type DashboardKpiChartPoint,
} from "@/components/dashboard/dashboard-kpi-card";

/** The Products and Inventory Value cards above the shared Products list. */

/** ৳ 4.8 Cr, ৳ 12.5 L, or the full amount below one lakh. */
export function formatCompactTaka(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const short = (amount: number) =>
    amount.toLocaleString("en-BD", { maximumFractionDigits: 1 });
  if (abs >= 10_000_000) return `${sign}৳ ${short(abs / 10_000_000)} Cr`;
  if (abs >= 100_000) return `${sign}৳ ${short(abs / 100_000)} L`;
  return `${sign}৳ ${abs.toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
}

const ids = (count: number) => `${count.toLocaleString("en-BD")} ID`;

/**
 * Months without a recorded value are left out rather than drawn as zero.
 * With only this month recorded so far, the line is drawn flat at the
 * current value so the card still shows its trend.
 */
function chartPoints(
  trend: Array<{ label: string; value: number | null }>,
): DashboardKpiChartPoint[] | undefined {
  const points = trend.filter(
    (point): point is DashboardKpiChartPoint => point.value !== null,
  );
  if (points.length === 1) return [points[0]!, points[0]!];
  return points.length >= 2 ? points : undefined;
}

export function OwnerProductKpiCards({
  queryKey,
  fetchKpis,
}: {
  queryKey: readonly unknown[];
  fetchKpis: () => Promise<OwnerProductKpis>;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: fetchKpis,
    staleTime: 60_000,
  });
  const status = isLoading
    ? "Loading…"
    : isError
      ? "Could not load figures"
      : undefined;
  const products = data?.products;
  const stock = data?.inventoryValue;
  const change = stock?.changePercent;

  return (
    <section aria-label="Product summary" className="@container">
      {/* Side by side only when each card has room for its title and footer. */}
      <div className="grid grid-cols-1 gap-4 max-md:gap-3 @2xl:grid-cols-2">
        <DashboardKpiCard
          label="Products"
          icon={<Boxes aria-hidden="true" />}
          tone="blue"
          badge="This month"
          value={products ? ids(products.total) : "—"}
          trend={
            products
              ? {
                  value: `+${products.newThisMonth.toLocaleString("en-BD")}`,
                  label: "New ID Added",
                  direction: products.newThisMonth > 0 ? "up" : "neutral",
                }
              : undefined
          }
          description={status}
          footer={
            products
              ? { label: "Inactive", value: ids(products.inactive) }
              : undefined
          }
          chartData={products ? chartPoints(products.trend) : undefined}
          chartLabel="Trend"
          chartOnMobile
        />
        <DashboardKpiCard
          label="Inventory Value"
          icon={<Wallet aria-hidden="true" />}
          tone="emerald"
          badge="This month"
          value={stock ? formatCompactTaka(stock.current) : "—"}
          trend={
            change != null
              ? {
                  value: `${change > 0 ? "+" : ""}${change}%`,
                  label: "vs Last Month",
                  direction:
                    change > 0 ? "up" : change < 0 ? "down" : "neutral",
                }
              : undefined
          }
          description={
            status ??
            (stock?.previousMonth === null
              ? "No data for last month yet"
              : stock && change == null
                ? "Last month's value was ৳ 0"
                : undefined)
          }
          footer={
            stock
              ? { label: "Slow-moving stock", value: ids(stock.slowMoving) }
              : undefined
          }
          chartData={stock ? chartPoints(stock.trend) : undefined}
          chartLabel="Trend"
          chartOnMobile
        />
      </div>
    </section>
  );
}
