import { describe, expect, test } from "bun:test";
import { platformDayRange } from "./platform-stats";

describe("platform daily orders", () => {
  test("changes day at Bangladesh midnight, not UTC midnight", () => {
    const before = platformDayRange(new Date("2026-09-15T17:59:59Z"));
    const after = platformDayRange(new Date("2026-09-15T18:00:00Z"));
    expect(before.start.toISOString()).toBe("2026-09-14T18:00:00.000Z");
    expect(after.start.toISOString()).toBe("2026-09-15T18:00:00.000Z");
    expect(after.end.toISOString()).toBe("2026-09-16T18:00:00.000Z");
  });
  test("handles year rollover", () => {
    const range = platformDayRange(new Date("2026-12-31T23:00:00Z"));
    expect(range.start.toISOString()).toBe("2026-12-31T18:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-01-01T18:00:00.000Z");
  });
});
