import {
  DASHBOARD_TIME_ZONE,
  dashboardGrowthPercent,
  dashboardTrendPoints,
} from "./dashboard-period";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

export function userRegistrationWindow(now: Date) {
  const end = new Date(now);
  const start = new Date(end.getTime() - WINDOW_DAYS * DAY_MS);
  const previousStart = new Date(start.getTime() - WINDOW_DAYS * DAY_MS);
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const labelFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
  });
  const firstDay = new Date(`${dayFormat.format(start)}T00:00:00Z`);
  const lastDay = new Date(`${dayFormat.format(end)}T00:00:00Z`);
  const buckets: { date: string; label: string }[] = [];

  // Rolling 30-day windows can span 31 calendar dates. The first and last
  // buckets contain only the part of that day inside the reporting window.
  for (let day = firstDay.getTime(); day <= lastDay.getTime(); day += DAY_MS) {
    const date = new Date(day);
    buckets.push({
      date: date.toISOString().slice(0, 10),
      label: labelFormat.format(date).replace(" ", "-"),
    });
  }

  return { start, end, previousStart, previousEnd: start, buckets };
}

export function userRegistrationTrend(
  window: ReturnType<typeof userRegistrationWindow>,
  counts: {
    current: number;
    previous: number;
    activeByDay: { date: string; value: number }[];
  },
) {
  return {
    newUsers: counts.current,
    previousUsers: counts.previous,
    growthPercent: dashboardGrowthPercent(counts.current, counts.previous),
    points: dashboardTrendPoints(window.buckets, counts.activeByDay),
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    previousStart: window.previousStart.toISOString(),
    previousEnd: window.previousEnd.toISOString(),
    timeZone: DASHBOARD_TIME_ZONE,
  };
}
