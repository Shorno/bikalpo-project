import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardGrowthPercent,
  dashboardPeriodWindow,
  dashboardTrendPoints,
} from "./dashboard-period";

test("daily reporting switches days at Bangladesh midnight and compares elapsed time", () => {
  const window = dashboardPeriodWindow(
    "daily",
    new Date("2026-09-23T18:30:00.000Z"),
  );
  assert.equal(window.start.toISOString(), "2026-09-23T18:00:00.000Z");
  assert.equal(window.previousStart.toISOString(), "2026-09-22T18:00:00.000Z");
  assert.equal(window.previousEnd.toISOString(), "2026-09-22T18:30:00.000Z");
  assert.equal(window.buckets.length, 30);
  assert.equal(window.buckets[0]?.date, "2026-08-26");
  assert.deepEqual(window.buckets.at(-1), {
    date: "2026-09-24",
    label: "Sep-24",
  });
});

test("monthly buckets cross years and cap comparison at the previous month end", () => {
  const window = dashboardPeriodWindow(
    "monthly",
    new Date("2024-03-31T06:00:00.000Z"),
  );
  assert.equal(window.start.toISOString(), "2024-02-29T18:00:00.000Z");
  assert.equal(window.previousStart.toISOString(), "2024-01-31T18:00:00.000Z");
  assert.equal(window.previousEnd.toISOString(), window.start.toISOString());
  assert.equal(window.buckets.length, 12);
  assert.equal(window.buckets[0]?.date, "2023-04-01");
  assert.equal(window.buckets.at(-1)?.date, "2024-03-01");
});

test("yearly buckets and the current period start on the Bangladesh new year", () => {
  const window = dashboardPeriodWindow(
    "yearly",
    new Date("2025-12-31T19:00:00.000Z"),
  );
  assert.equal(window.start.toISOString(), "2025-12-31T18:00:00.000Z");
  assert.equal(window.previousStart.toISOString(), "2024-12-31T18:00:00.000Z");
  assert.equal(window.previousEnd.toISOString(), "2024-12-31T19:00:00.000Z");
  assert.equal(window.buckets.length, 5);
  assert.equal(window.buckets[0]?.label, "2022");
  assert.equal(window.buckets.at(-1)?.label, "2026");
});

test("growth preserves declines and distinguishes no activity from no baseline", () => {
  assert.equal(dashboardGrowthPercent(0, 0), 0);
  assert.equal(dashboardGrowthPercent(3, 0), null);
  assert.equal(dashboardGrowthPercent(0, 4), -100);
  assert.equal(dashboardGrowthPercent(4, 3), 33.3);
  assert.equal(dashboardGrowthPercent(3, 4), -25);
});

test("series keeps real counts, zero-fills gaps, and excludes out-of-window rows", () => {
  const window = dashboardPeriodWindow(
    "daily",
    new Date("2026-09-24T06:00:00.000Z"),
  );
  const points = dashboardTrendPoints(window.buckets, [
    { date: "2026-09-23", value: 2 },
    { date: "2026-09-24", value: 7 },
    { date: "2026-09-25", value: 1 },
  ]);
  assert.equal(points.length, 30);
  assert.equal(points[0]?.value, 0);
  assert.equal(points.at(-2)?.value, 2);
  assert.equal(points.at(-1)?.value, 7);
  assert.equal(
    points.reduce((total, point) => total + point.value, 0),
    9,
  );
});
