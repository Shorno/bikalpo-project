export type DashboardPeriod = "daily" | "monthly" | "yearly";

// Dashboard reporting follows the platform's Bangladesh business calendar.
export const DASHBOARD_TIME_ZONE = "Asia/Dhaka";
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

const periodConfig = {
  daily: { unit: "day", points: 30 },
  monthly: { unit: "month", points: 12 },
  yearly: { unit: "year", points: 5 },
} as const;

export function dashboardPeriodWindow(period: DashboardPeriod, now: Date) {
  const localNow = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const day = localNow.getUTCDate();
  const config = periodConfig[period];
  const localStart = new Date(
    Date.UTC(
      year,
      period === "yearly" ? 0 : month,
      period === "daily" ? day : 1,
    ),
  );

  function shiftPeriod(date: Date, amount: number) {
    const shifted = new Date(date);
    if (period === "daily") shifted.setUTCDate(shifted.getUTCDate() + amount);
    if (period === "monthly")
      shifted.setUTCMonth(shifted.getUTCMonth() + amount);
    if (period === "yearly")
      shifted.setUTCFullYear(shifted.getUTCFullYear() + amount);
    return shifted;
  }

  function toInstant(localDate: Date) {
    return new Date(localDate.getTime() - DHAKA_OFFSET_MS);
  }

  const start = toInstant(localStart);
  const previousStart = toInstant(shiftPeriod(localStart, -1));
  // Compare elapsed time with elapsed time, including shorter previous months.
  const previousEnd = new Date(
    Math.min(
      start.getTime(),
      previousStart.getTime() + now.getTime() - start.getTime(),
    ),
  );
  const firstBucket = shiftPeriod(localStart, 1 - config.points);
  const labelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...(period === "daily"
      ? { month: "short", day: "2-digit" }
      : period === "monthly"
        ? { month: "short", year: "numeric" }
        : { year: "numeric" }),
  });
  const buckets = Array.from({ length: config.points }, (_, index) => {
    const date = shiftPeriod(firstBucket, index);
    return {
      date: date.toISOString().slice(0, 10),
      label: labelFormatter
        .format(date)
        .replace(" ", period === "daily" ? "-" : " "),
    };
  });

  return {
    period,
    unit: config.unit,
    start,
    end: now,
    previousStart,
    previousEnd,
    seriesStart: toInstant(firstBucket),
    buckets,
  };
}

export function dashboardGrowthPercent(current: number, previous: number) {
  // A percentage increase from no baseline is undefined, not an invented 100%.
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function dashboardTrendPoints(
  buckets: { date: string; label: string }[],
  counts: { date: string; value: number }[],
) {
  const values = new Map(
    counts.map((point) => [point.date, Number(point.value)]),
  );
  // A missing grouped row means there were no records in that calendar bucket.
  return buckets.map((bucket) => ({
    ...bucket,
    value: values.get(bucket.date) ?? 0,
  }));
}
