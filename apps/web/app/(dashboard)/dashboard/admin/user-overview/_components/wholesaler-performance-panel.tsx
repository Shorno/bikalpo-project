"use client";

import type { userRegistrationTrend } from "@bikalpo-project/api/routers/helpers/user-registration-trend";
import { ArrowDown, ArrowUp, FileText, Minus, Users } from "lucide-react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import type {
  UsersKpiKey,
  UsersPerformanceStats,
} from "./users-performance-panel";

type RegistrationTrend = ReturnType<typeof userRegistrationTrend>;
const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function MetricValue({ value, loading }: { value?: number; loading: boolean }) {
  return loading ? (
    <Skeleton className="inline-block h-5 w-16 align-middle" />
  ) : (
    <span className="tabular-nums">
      {value === undefined ? "—" : numberFormat.format(value)}
    </span>
  );
}

function Growth({
  percent,
  loading,
}: {
  percent?: number | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-7 w-20" />;
  if (percent == null) {
    return (
      <span
        title={
          percent === null ? "No previous-period baseline" : "Data unavailable"
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

export function WholesalerPerformancePanel({
  stats,
  trend,
  loading,
  activeKpis,
  pendingApplications,
  pendingApplicationsHref,
  onSelectKpi,
}: {
  stats?: UsersPerformanceStats;
  trend?: RegistrationTrend;
  loading: boolean;
  activeKpis: UsersKpiKey[];
  pendingApplications?: number;
  pendingApplicationsHref: string;
  onSelectKpi: (key: UsersKpiKey) => void;
}) {
  const metrics = [
    {
      label: "New Users",
      value: trend?.newUsers,
      description: "Accounts registered in the last 30 days.",
    },
    {
      label: "Active Users",
      value: stats?.active,
      key: "active" as const,
      description: "Accounts that are neither suspended nor pending approval.",
    },
    {
      label: "Applying",
      value: pendingApplications,
      href: pendingApplicationsHref,
      description: "Warehouse applications awaiting approval.",
    },
    {
      label: "Suspended",
      value: stats?.suspended,
      key: "suspended" as const,
      description: "Suspended warehouse accounts.",
    },
  ];
  const dateFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: trend?.timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Card
      role="region"
      aria-labelledby="wholesaler-performance-heading"
      aria-busy={loading}
      className="min-w-0 gap-0 border py-0 shadow-none ring-0"
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-4 sm:px-6">
        <h2
          id="wholesaler-performance-heading"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight sm:gap-3 sm:text-base"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:size-9">
            <Users className="size-[18px]" aria-hidden />
          </span>
          Users Performance
        </h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-2 text-xs sm:gap-2 sm:px-2.5 sm:text-[0.8rem]"
              disabled={!stats || !trend || pendingApplications === undefined}
            >
              <FileText className="size-3.5 sm:size-4" aria-hidden />
              View Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader className="pr-8">
              <DialogTitle>Users Performance</DialogTitle>
              <DialogDescription>
                Wholesaler users matching the search, location and business type
                filters. Time zone: {trend?.timeZone}.
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y py-4 text-sm">
              {[
                {
                  label: "Total Users",
                  value: stats?.total,
                  description:
                    "All registered warehouse accounts in this cohort.",
                },
                ...metrics,
              ].map((metric) => (
                <div key={metric.label}>
                  <dt className="text-muted-foreground">{metric.label}</dt>
                  <dd className="font-mono font-medium">
                    <MetricValue value={metric.value} loading={false} />
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {metric.description}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-muted-foreground">User Growth</dt>
                <dd>
                  <Growth percent={trend?.growthPercent} loading={false} />
                </dd>
              </div>
            </dl>
            {trend && (
              <>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Last 30 days: {dateFormat.format(new Date(trend.start))} –{" "}
                    {dateFormat.format(new Date(trend.end))} (
                    {numberFormat.format(trend.newUsers)} registrations).
                  </p>
                  <p>
                    Previous 30 days:{" "}
                    {dateFormat.format(new Date(trend.previousStart))} –{" "}
                    {dateFormat.format(new Date(trend.previousEnd))} (
                    {numberFormat.format(trend.previousUsers)} registrations).
                  </p>
                  <p>
                    User Growth compares registrations in these two periods. A
                    dash means there is no previous-period baseline.
                  </p>
                  <p>
                    The chart groups currently active accounts by registration
                    date within the last 30 days. It does not measure daily
                    sign-ins or historical status changes. The first and last
                    dates may contain partial days.
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <caption className="pb-3 text-left font-medium">
                    User Growth (Active)
                  </caption>
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="py-2 font-medium">
                        Date
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Active Users
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
      </CardHeader>
      <CardContent className="px-4 py-5 sm:px-6 sm:py-6">
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:gap-x-10">
          <div>
            <dt className="text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => onSelectKpi("total")}
                aria-pressed={activeKpis.includes("total")}
                className="rounded-sm text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                Total Users
              </button>
            </dt>
            <dd className="mt-1.5 font-mono text-3xl font-semibold tracking-tight">
              <MetricValue value={stats?.total} loading={loading} />
            </dd>
          </div>
          <div title="Registrations in the last 30 days vs the previous 30 days">
            <dt className="text-sm text-muted-foreground">User Growth</dt>
            <dd className="mt-1.5 text-2xl leading-9">
              <Growth percent={trend?.growthPercent} loading={loading} />
            </dd>
          </div>
        </dl>
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 border-t pt-4 text-xs sm:gap-x-10 sm:text-sm">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              title={metric.description}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
            >
              <dt className="text-muted-foreground">
                {metric.key ? (
                  <button
                    type="button"
                    aria-pressed={activeKpis.includes(metric.key)}
                    onClick={() => onSelectKpi(metric.key)}
                    className={cn(
                      "rounded-sm text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                      activeKpis.includes(metric.key) &&
                        "text-primary underline underline-offset-4",
                    )}
                  >
                    {metric.label}
                  </button>
                ) : metric.href ? (
                  <Link
                    href={metric.href}
                    className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {metric.label}
                  </Link>
                ) : (
                  metric.label
                )}
              </dt>
              <dd className="font-mono font-medium">
                <MetricValue value={metric.value} loading={loading} />
              </dd>
            </div>
          ))}
        </dl>
        <figure className="mt-6">
          <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            User Growth (Active)
          </figcaption>
          {loading ? (
            <div className="flex h-48 items-center" role="status">
              <span className="sr-only">Loading active user growth</span>
              <Skeleton className="h-36 w-full rounded-lg" />
            </div>
          ) : !trend ? (
            <div className="grid h-48 place-items-center rounded-lg bg-muted/20 text-sm text-muted-foreground">
              Chart data is unavailable.
            </div>
          ) : (
            <div className="relative">
              {!trend.points.some((point) => point.value > 0) && (
                <p className="absolute inset-x-0 top-12 z-10 text-center text-xs text-muted-foreground">
                  No new active users in this period.
                </p>
              )}
              <ChartContainer
                config={{
                  value: { label: "Active Users", color: "var(--primary)" },
                }}
                className="h-48 w-full aspect-auto"
                aria-label="Daily registrations of currently active wholesaler users in the last 30 days. Exact counts are available in View Report."
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
