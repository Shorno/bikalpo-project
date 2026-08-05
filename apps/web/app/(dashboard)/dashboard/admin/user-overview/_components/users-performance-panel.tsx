"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type UsersKpiKey =
  | "total"
  | "active"
  | "pending"
  | "suspended"
  | "verifiedKyc";

export type UsersPerformanceStats = {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  verifiedKyc: number;
  newThisMonth: number;
};

export type UsersGrowthTrend = {
  points: { label: string; value: number }[];
  growthPercent: number;
  newUsers: number;
};

const chartConfig = {
  users: {
    label: "Users",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

type StatCell = {
  key: UsersKpiKey | null;
  label: string;
  value: number;
};

function GrowthIndicator({ percent }: { percent: number }) {
  const Icon = percent > 0 ? TrendingUp : percent < 0 ? TrendingDown : Minus;
  const tone =
    percent > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : percent < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <span className={cn("inline-flex items-center gap-1.5", tone)}>
      <Icon className="h-5 w-5" aria-hidden />
      <span className="text-2xl font-semibold tabular-nums">
        {percent > 0 ? "+" : ""}
        {percent}%
      </span>
    </span>
  );
}

export function UsersPerformancePanel({
  title = "Users Performance",
  stats,
  trend,
  isTrendLoading,
  activeKpi,
  onSelectKpi,
}: {
  title?: string;
  stats?: UsersPerformanceStats;
  trend?: UsersGrowthTrend;
  isTrendLoading?: boolean;
  activeKpi: UsersKpiKey;
  onSelectKpi: (key: UsersKpiKey) => void;
}) {
  const points = trend?.points ?? [];

  const cells: StatCell[] = [
    {
      key: null,
      label: "New Users",
      value: trend?.newUsers ?? stats?.newThisMonth ?? 0,
    },
    { key: "active", label: "Active Users", value: stats?.active ?? 0 },
    { key: "pending", label: "Applying", value: stats?.pending ?? 0 },
    { key: "suspended", label: "Suspended", value: stats?.suspended ?? 0 },
    { key: "verifiedKyc", label: "Verified", value: stats?.verifiedKyc ?? 0 },
  ];

  return (
    <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <header className="border-b bg-muted/30 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h2>
      </header>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelectKpi("total")}
          className={cn(
            "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors",
            activeKpi === "total"
              ? "border-primary/40 bg-primary/5"
              : "border-transparent hover:bg-muted/50",
          )}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total Users
          </span>
          <span className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
            {(stats?.total ?? 0).toLocaleString()}
          </span>
        </button>

        <div className="flex flex-col items-start rounded-lg px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            User Growth
          </span>
          <div className="mt-1">
            <GrowthIndicator percent={trend?.growthPercent ?? 0} />
          </div>
          <span className="mt-0.5 text-xs text-muted-foreground">
            vs previous period
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-y bg-border sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((cell) => {
          const isActive = cell.key !== null && activeKpi === cell.key;
          const content = (
            <>
              <span className="text-xs text-muted-foreground">
                {cell.label}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  isActive ? "text-primary" : "text-foreground",
                )}
              >
                {cell.value.toLocaleString()}
              </span>
            </>
          );

          if (cell.key === null) {
            return (
              <div
                key={cell.label}
                className="flex flex-col gap-0.5 bg-background px-4 py-3"
              >
                {content}
              </div>
            );
          }

          return (
            <button
              key={cell.label}
              type="button"
              onClick={() => onSelectKpi(cell.key as UsersKpiKey)}
              className={cn(
                "flex flex-col gap-0.5 px-4 py-3 text-left transition-colors",
                isActive ? "bg-primary/5" : "bg-background hover:bg-muted/50",
              )}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            User Growth (Active)
          </h3>
          {points.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Last {points.length} days
            </span>
          )}
        </div>

        {isTrendLoading ? (
          <div className="h-[200px] w-full animate-pulse rounded-lg bg-muted" />
        ) : points.length === 0 ? (
          <div className="grid h-[200px] w-full place-items-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              No growth data for this period
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[200px] w-full"
          >
            <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-users)"
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-users)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={44}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Area
                dataKey="value"
                name="users"
                type="monotone"
                fill="url(#fillUsers)"
                stroke="var(--color-users)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
