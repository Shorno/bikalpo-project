"use client";

import { MoreVertical } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type DashboardKpiTone =
  | "slate"
  | "red"
  | "blue"
  | "violet"
  | "amber"
  | "emerald";

export type DashboardKpiTrend = {
  value: string;
  label: string;
  direction: "up" | "down" | "neutral";
};

export type DashboardKpiFooter = {
  label: string;
  value: React.ReactNode;
};

export type DashboardKpiChartPoint = {
  label: string;
  value: number;
};

type DashboardKpiGridProps = React.ComponentProps<"div">;

type DashboardKpiCardProps = {
  label: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: DashboardKpiTone;
  active?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  trend?: DashboardKpiTrend;
  footer?: DashboardKpiFooter;
  chartData?: DashboardKpiChartPoint[];
  className?: string;
};

type DashboardKpiSparklineProps = {
  data: DashboardKpiChartPoint[];
  tone?: DashboardKpiTone;
  className?: string;
};

const toneStyles: Record<
  DashboardKpiTone,
  {
    active: string;
    icon: string;
    value: string;
    accent: string;
    trendUp: string;
    trendDown: string;
    chart: string;
  }
> = {
  slate: {
    active: "border-slate-300 bg-slate-50/70 ring-slate-100",
    icon: "bg-slate-100 text-slate-800",
    value: "text-slate-950",
    accent: "text-slate-800",
    trendUp: "text-slate-700",
    trendDown: "text-slate-700",
    chart: "oklch(0.372 0.044 257.287)",
  },
  red: {
    active: "border-red-200 bg-red-50/70 ring-red-100",
    icon: "bg-red-100 text-red-600",
    value: "text-red-700",
    accent: "text-red-600",
    trendUp: "text-red-600",
    trendDown: "text-red-600",
    chart: "oklch(0.577 0.245 27.325)",
  },
  blue: {
    active: "border-blue-200 bg-blue-50/70 ring-blue-100",
    icon: "bg-blue-100 text-blue-600",
    value: "text-blue-700",
    accent: "text-blue-600",
    trendUp: "text-blue-600",
    trendDown: "text-blue-600",
    chart: "var(--primary)",
  },
  violet: {
    active: "border-violet-200 bg-violet-50/70 ring-violet-100",
    icon: "bg-violet-100 text-violet-600",
    value: "text-violet-700",
    accent: "text-violet-600",
    trendUp: "text-violet-600",
    trendDown: "text-violet-600",
    chart: "oklch(0.541 0.281 293.009)",
  },
  amber: {
    active: "border-amber-200 bg-amber-50/70 ring-amber-100",
    icon: "bg-amber-100 text-amber-600",
    value: "text-amber-700",
    accent: "text-amber-600",
    trendUp: "text-amber-600",
    trendDown: "text-amber-600",
    chart: "oklch(0.769 0.188 70.08)",
  },
  emerald: {
    active: "border-emerald-200 bg-emerald-50/70 ring-emerald-100",
    icon: "bg-emerald-100 text-emerald-600",
    value: "text-emerald-700",
    accent: "text-emerald-600",
    trendUp: "text-emerald-600",
    trendDown: "text-red-600",
    chart: "var(--chart-3)",
  },
};

export function DashboardKpiGrid({
  className,
  ...props
}: DashboardKpiGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        className,
      )}
      {...props}
    />
  );
}

export function DashboardKpiCard({
  label,
  value,
  description,
  icon,
  tone = "slate",
  active = false,
  disabled = false,
  badge,
  href,
  onClick,
  trend,
  footer,
  chartData,
  className,
}: DashboardKpiCardProps) {
  const styles = toneStyles[tone];
  const isInteractive = Boolean(href || onClick) && !disabled;
  const hasChart = chartData && chartData.length > 0;
  const cardClassName = cn(
    "group relative min-h-[148px] overflow-hidden rounded-2xl border bg-background p-4 text-left transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active && cn(styles.active, "ring-2"),
    !active && isInteractive && "hover:border-foreground/20 hover:bg-muted/20",
    "shadow-[0_10px_26px_rgba(15,23,42,0.06)]",
    disabled && "cursor-not-allowed bg-muted/30 opacity-60",
    className,
  );

  const content = (
    <>
      <div className="relative z-10 flex min-h-[116px] min-w-0 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&>svg]:h-[18px] [&>svg]:w-[18px]",
                styles.icon,
              )}
            >
              {icon}
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="truncate text-[15px] font-bold leading-tight tracking-tight text-foreground">
                {label}
              </h3>
              {trend ? (
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                  <span
                    className={cn(
                      trend.direction === "up" && styles.trendUp,
                      trend.direction === "down" && styles.trendDown,
                      trend.direction === "neutral" && "text-muted-foreground",
                    )}
                  >
                    {trend.value}
                  </span>{" "}
                  {trend.label}
                </p>
              ) : description ? (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {badge ? (
            <div className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {badge}
            </div>
          ) : (
            <MoreVertical className="h-4 w-4 shrink-0 text-muted-foreground/70" />
          )}
        </div>

        <div
          className={cn(
            "mt-5 text-4xl font-extrabold tracking-tight text-foreground tabular-nums",
            styles.value,
          )}
        >
          {value}
        </div>

        {footer ? (
          <p className="mt-auto max-w-[58%] pt-2 text-xs font-semibold text-muted-foreground">
            {footer.label}:{" "}
            <span
              className={cn(
                "font-bold",
                active ? styles.value : styles.accent,
              )}
            >
              {footer.value}
            </span>
          </p>
        ) : null}
      </div>

      {hasChart ? (
        <div className="pointer-events-none absolute bottom-4 right-4 hidden w-[43%] min-w-24 max-w-32 md:block">
          <DashboardKpiSparkline data={chartData} tone={tone} />
        </div>
      ) : null}
    </>
  );

  if (disabled) {
    return <div className={cardClassName}>{content}</div>;
  }

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClassName}>
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

export function DashboardKpiSparkline({
  data,
  tone = "slate",
  className,
}: DashboardKpiSparklineProps) {
  const gradientId = React.useId().replace(/:/g, "");
  const styles = toneStyles[tone];
  const lastPointIndex = data.length - 1;
  const chartConfig = {
    value: {
      label: "Value",
      color: styles.chart,
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("h-14 min-h-14 w-full", className)}
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ bottom: 8, left: 4, right: 4, top: 8 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-value)"
              stopOpacity={0.24}
            />
            <stop
              offset="95%"
              stopColor="var(--color-value)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <YAxis hide allowDecimals={false} domain={[0, "dataMax + 1"]} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel indicator="dot" />}
        />
        <Area
          dataKey="value"
          fill={`url(#${gradientId})`}
          stroke="var(--color-value)"
          strokeWidth={2.35}
          dot={(props: unknown) => {
            const point = props as {
              cx?: number;
              cy?: number;
              index?: number;
            };

            if (
              point.index !== lastPointIndex ||
              typeof point.cx !== "number" ||
              typeof point.cy !== "number"
            ) {
              return null;
            }

            return (
              <circle
                cx={point.cx}
                cy={point.cy}
                fill="var(--color-value)"
                r={3.25}
                stroke="var(--background)"
                strokeWidth={2}
              />
            );
          }}
          type="natural"
        />
      </AreaChart>
    </ChartContainer>
  );
}
