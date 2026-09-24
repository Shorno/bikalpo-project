"use client";

import type { getDashboardPerformance } from "@bikalpo-project/api/routers/helpers/dashboard-performance";
import type { DashboardPeriod } from "@bikalpo-project/api/routers/helpers/dashboard-period";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  FileText,
  type LucideIcon,
  Minus,
  Package,
  Users,
} from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type Performance = Awaited<ReturnType<typeof getDashboardPerformance>>;
type Trend = Performance["users"] | Performance["orders"];
type Metric = {
  label: string;
  value: number | undefined;
  description?: string;
};

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const periods = [
  {
    value: "daily",
    label: "Daily",
    comparison: "Today vs yesterday",
    unit: "day",
  },
  {
    value: "monthly",
    label: "Monthly",
    comparison: "This month vs last month",
    unit: "month",
  },
  {
    value: "yearly",
    label: "Yearly",
    comparison: "This year vs last year",
    unit: "year",
  },
] as const;

function MetricValue({
  value,
  loading,
}: {
  value: number | undefined;
  loading: boolean;
}) {
  if (loading)
    return <Skeleton className="inline-block h-5 w-16 align-middle" />;
  return (
    <span className="tabular-nums">
      {value === undefined ? "—" : numberFormat.format(value)}
    </span>
  );
}

function Growth({ trend, loading }: { trend?: Trend; loading: boolean }) {
  if (loading) return <Skeleton className="h-7 w-20" />;
  const percent = trend?.growthPercent;
  if (percent === undefined || percent === null) {
    return (
      <span
        title={
          percent === null
            ? "No previous-period baseline for a percentage comparison"
            : "Data unavailable"
        }
      >
        —
      </span>
    );
  }
  const Icon = percent > 0 ? ArrowUp : percent < 0 ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono font-semibold",
        percent > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : percent < 0
            ? "text-destructive"
            : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">
        {percent > 0 ? "Increase " : percent < 0 ? "Decrease " : "No change "}
      </span>
      <span className="tabular-nums">
        {numberFormat.format(Math.abs(percent))}%
      </span>
    </span>
  );
}

function PerformanceReport({
  title,
  totalLabel,
  trendLabel,
  trend,
  metrics,
  timeZone,
}: {
  title: string;
  totalLabel: string;
  trendLabel: string;
  trend?: Trend;
  metrics: Metric[];
  timeZone?: string;
}) {
  const dateFormat = new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-2 text-xs sm:gap-2 sm:px-2.5 sm:text-[0.8rem]"
          disabled={!trend}
        >
          <FileText className="size-3.5 sm:size-4" aria-hidden />
          View Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {trend
              ? `Actual counts by ${periods.find((item) => item.value === trend.period)?.unit}. Time zone: ${timeZone}.`
              : "Data unavailable"}
          </DialogDescription>
        </DialogHeader>
        {trend && (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y py-4 text-sm">
              {[
                {
                  label: totalLabel,
                  value: trend.total,
                  description: "All time",
                },
                ...metrics,
              ].map((metric) => (
                <div key={metric.label}>
                  <dt className="text-muted-foreground">{metric.label}</dt>
                  <dd className="font-mono font-medium">
                    <MetricValue value={metric.value} loading={false} />
                  </dd>
                  {metric.description && (
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {metric.description}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Current period: {dateFormat.format(new Date(trend.start))} –{" "}
                {dateFormat.format(new Date(trend.end))} (
                {numberFormat.format(trend.currentCount)}).
              </p>
              <p>
                Comparison: {dateFormat.format(new Date(trend.previousStart))} –{" "}
                {dateFormat.format(new Date(trend.previousEnd))} (
                {numberFormat.format(trend.previousCount)}).
              </p>
              <p>
                Growth compares elapsed time in the selected period. A dash
                means there is no previous-period baseline.
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <caption className="pb-3 text-left font-medium">
                {trendLabel}
              </caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="py-2 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {trend.points.map((point) => (
                  <tr key={point.date} className="border-b last:border-0">
                    <th scope="row" className="py-2 font-normal">
                      {point.date}
                    </th>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {numberFormat.format(point.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PerformancePanel({
  id,
  icon: Icon,
  title,
  totalLabel,
  growthLabel,
  chartLabel,
  pointLabel,
  period,
  onPeriodChange,
  trend,
  metrics,
  reportMetrics,
  loading,
  timeZone,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  totalLabel: string;
  growthLabel: string;
  chartLabel: string;
  pointLabel: string;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  trend?: Trend;
  metrics: (Metric | null)[];
  reportMetrics: Metric[];
  loading: boolean;
  timeZone?: string;
}) {
  const hasActivity = trend?.points.some((point) => point.value > 0);
  return (
    <Card
      role="region"
      aria-labelledby={`${id}-heading`}
      aria-busy={loading}
      className="min-w-0 gap-0 border py-0 shadow-none ring-0"
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-4 sm:px-6">
        <h2
          id={`${id}-heading`}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight sm:gap-3 sm:text-base"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:size-9">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          {title}
        </h2>
        <PerformanceReport
          title={title}
          totalLabel={totalLabel}
          trendLabel={chartLabel}
          trend={trend}
          metrics={reportMetrics}
          timeZone={timeZone}
        />
      </CardHeader>
      <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6">
        <div className="flex justify-end py-4">
          <ToggleGroup
            type="single"
            value={period}
            variant="outline"
            size="sm"
            aria-label={`${title} period`}
            onValueChange={(value) => {
              const selected = periods.find((item) => item.value === value);
              if (selected) onPeriodChange(selected.value);
            }}
          >
            {periods.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                className="h-9 min-w-16 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:gap-x-10">
          <div>
            <dt className="text-sm text-muted-foreground">{totalLabel}</dt>
            <dd className="mt-1.5 font-mono text-3xl font-semibold tracking-tight">
              <MetricValue value={trend?.total} loading={loading} />
            </dd>
          </div>
          <div
            title={`${periods.find((item) => item.value === period)?.comparison}, matching elapsed time`}
          >
            <dt className="text-sm text-muted-foreground">{growthLabel}</dt>
            <dd className="mt-1.5 text-2xl leading-9">
              <Growth trend={trend} loading={loading} />
            </dd>
          </div>
        </dl>
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 border-t pt-4 text-xs sm:gap-x-10 sm:text-sm">
          {metrics.map((metric, index) =>
            metric ? (
              <div
                key={metric.label}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                title={metric.description}
              >
                <dt className="text-muted-foreground">{metric.label}</dt>
                <dd className="font-mono font-medium">
                  <MetricValue value={metric.value} loading={loading} />
                </dd>
              </div>
            ) : (
              <div key={`space-${index}`} aria-hidden />
            ),
          )}
        </dl>
        <figure className="mt-6">
          <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {chartLabel}
          </figcaption>
          {loading ? (
            <div className="flex h-48 items-center" role="status">
              <span className="sr-only">
                Loading {chartLabel.toLowerCase()}
              </span>
              <Skeleton className="h-36 w-full rounded-lg" />
            </div>
          ) : !trend ? (
            <div className="grid h-48 place-items-center rounded-lg bg-muted/20 text-sm text-muted-foreground">
              Chart data is unavailable.
            </div>
          ) : (
            <div className="relative">
              {!hasActivity && (
                <p className="absolute inset-x-0 top-12 z-10 text-center text-xs text-muted-foreground">
                  No {pointLabel.toLowerCase()} in this period.
                </p>
              )}
              <ChartContainer
                config={{
                  value: { label: pointLabel, color: "var(--primary)" },
                }}
                className="h-48 w-full aspect-auto"
                aria-label={`${chartLabel}: ${trend.points[0]?.date} to ${trend.points.at(-1)?.date}. Exact counts are available in View Report.`}
              >
                <LineChart
                  accessibilityLayer
                  data={trend.points}
                  margin={{ top: 12, right: 14, bottom: 0, left: 14 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    minTickGap={32}
                    interval="preserveStartEnd"
                    height={32}
                  />
                  <YAxis
                    hide
                    allowDecimals={false}
                    domain={[0, (max: number) => Math.max(max, 1)]}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="line"
                        labelFormatter={(_label, payload) =>
                          payload[0]?.payload.date
                        }
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            </div>
          )}
        </figure>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardClient() {
  const [usersPeriod, setUsersPeriod] = useState<DashboardPeriod>("daily");
  const [ordersPeriod, setOrdersPeriod] = useState<DashboardPeriod>("daily");
  const query = useQuery({
    ...orpc.dashboard.getPerformance.queryOptions({
      input: { usersPeriod, ordersPeriod },
    }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  return (
    <AdminDashboardView
      data={query.data}
      usersPeriod={usersPeriod}
      ordersPeriod={ordersPeriod}
      onUsersPeriodChange={setUsersPeriod}
      onOrdersPeriodChange={setOrdersPeriod}
      isError={query.isError}
      isFetching={query.isFetching}
      onRetry={() => void query.refetch()}
    />
  );
}

export function AdminDashboardView({
  data,
  usersPeriod,
  ordersPeriod,
  onUsersPeriodChange,
  onOrdersPeriodChange,
  isError,
  isFetching,
  onRetry,
}: {
  data?: Performance;
  usersPeriod: DashboardPeriod;
  ordersPeriod: DashboardPeriod;
  onUsersPeriodChange: (period: DashboardPeriod) => void;
  onOrdersPeriodChange: (period: DashboardPeriod) => void;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
}) {
  const users = data?.users.period === usersPeriod ? data.users : undefined;
  const orders = data?.orders.period === ordersPeriod ? data.orders : undefined;
  const usersLoading = !users && !isError;
  const ordersLoading = !orders && !isError;
  const userMetrics: Metric[] = [
    {
      label: "New Users",
      value: users?.currentCount,
      description: "Registrations in the selected day, month, or year to date",
    },
    {
      label: "Active Users",
      value: users?.active,
      description: "Accounts that are neither suspended nor pending approval",
    },
    {
      label: "Inactive",
      value: users?.inactive,
      description:
        "Business accounts pending approval, matching user management account status",
    },
    {
      label: "Suspended",
      value: users?.suspended,
      description: "Suspended accounts",
    },
  ];
  const completed: Metric = {
    label: "Completed",
    value: orders?.completed,
    description: "Delivered orders, all time",
  };
  const pending: Metric = {
    label: "Pending",
    value: orders?.pending,
    description: "All open orders awaiting completion, all time",
  };
  const cancelled: Metric = {
    label: "Cancelled",
    value: orders?.cancelled,
    description: "Cancelled orders, all time",
  };

  // The reference defines the panel layout and metrics. Presentation follows
  // the project's shared dashboard components, typography, and semantic colors.
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Today Overview</h1>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden />
          <span>Last Updated:</span>
          {data ? (
            <time
              dateTime={data.updatedAt}
              title={`${data.updatedAt} (${data.timeZone})`}
            >
              {new Intl.DateTimeFormat("en-US", {
                timeZone: data.timeZone,
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(data.updatedAt))}
            </time>
          ) : isError ? (
            "—"
          ) : (
            <Skeleton className="h-4 w-20" />
          )}
        </p>
      </header>

      {isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p>
            {data
              ? "Could not refresh the dashboard. Showing the last successful update."
              : "Could not load dashboard data."}
          </p>
          <Button variant="outline" onClick={onRetry} disabled={isFetching}>
            Retry
          </Button>
        </div>
      )}

      <div className="space-y-6">
        <PerformancePanel
          id="users-performance"
          icon={Users}
          title="Users Performance"
          totalLabel="Total Users"
          growthLabel="User Growth"
          chartLabel="USER GROWTH"
          pointLabel="New Users"
          period={usersPeriod}
          onPeriodChange={onUsersPeriodChange}
          trend={users}
          metrics={userMetrics}
          reportMetrics={userMetrics}
          loading={usersLoading}
          timeZone={data?.timeZone}
        />
        <PerformancePanel
          id="orders-performance"
          icon={Package}
          title="Orders Performance"
          totalLabel="Total Orders"
          growthLabel="Order Growth"
          chartLabel="ORDER TREND"
          pointLabel="Orders"
          period={ordersPeriod}
          onPeriodChange={onOrdersPeriodChange}
          trend={orders}
          metrics={[completed, null, pending, cancelled]}
          reportMetrics={[
            completed,
            pending,
            cancelled,
            {
              label: "Returned",
              value: orders?.returned,
              description: "Returned orders are included in Total Orders",
            },
          ]}
          loading={ordersLoading}
          timeZone={data?.timeZone}
        />
      </div>
    </div>
  );
}
