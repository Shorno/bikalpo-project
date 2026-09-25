import assert from "node:assert/strict";
import test from "node:test";
import {
  userRegistrationTrend,
  userRegistrationWindow,
} from "./user-registration-trend";

test("new-user reporting uses two adjacent rolling 30-day windows", () => {
  const window = userRegistrationWindow(new Date("2026-09-25T12:34:56Z"));
  assert.equal(window.start.toISOString(), "2026-08-26T12:34:56.000Z");
  assert.equal(window.end.toISOString(), "2026-09-25T12:34:56.000Z");
  assert.equal(window.previousStart.toISOString(), "2026-07-27T12:34:56.000Z");
  assert.equal(window.previousEnd.toISOString(), window.start.toISOString());
});

test("chart dates follow Bangladesh midnight, including leap days", () => {
  const window = userRegistrationWindow(new Date("2024-03-01T18:15:00Z"));
  assert.equal(window.buckets[0]?.date, "2024-02-01");
  assert.equal(window.buckets.at(-1)?.date, "2024-03-02");
  assert.ok(window.buckets.some((bucket) => bucket.date === "2024-02-29"));
  assert.equal(window.buckets.length, 31);
});

test("growth compares registrations while the chart contains only supplied active counts", () => {
  const window = userRegistrationWindow(new Date("2026-09-25T12:00:00Z"));
  const trend = userRegistrationTrend(window, {
    current: 12,
    previous: 10,
    activeByDay: [{ date: "2026-09-24", value: 4 }],
  });
  assert.equal(trend.newUsers, 12);
  assert.equal(trend.previousUsers, 10);
  assert.equal(trend.growthPercent, 20);
  assert.equal(
    trend.points.find((point) => point.date === "2026-09-24")?.value,
    4,
  );
  assert.equal(trend.points.at(-1)?.value, 0);
  assert.equal(
    trend.points.reduce((total, point) => total + point.value, 0),
    4,
  );
});

test("no previous registrations produces an undefined growth percentage, not 100%", () => {
  const window = userRegistrationWindow(new Date("2026-09-25T12:00:00Z"));
  assert.equal(
    userRegistrationTrend(window, { current: 1, previous: 0, activeByDay: [] })
      .growthPercent,
    null,
  );
  const empty = userRegistrationTrend(window, {
    current: 0,
    previous: 0,
    activeByDay: [],
  });
  assert.equal(empty.growthPercent, 0);
  assert.ok(empty.points.every((point) => point.value === 0));
});
