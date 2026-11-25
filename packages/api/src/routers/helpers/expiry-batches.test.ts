import { describe, expect, it } from "bun:test";
import {
  allocateBatches,
  daysBetween,
  dhakaDate,
  expiryStatus,
} from "./expiry-batches";

describe("expiry dates", () => {
  it("uses the Bangladesh date", () => {
    // 20:00 UTC on the 24th is 02:00 on the 25th in Dhaka.
    expect(dhakaDate(new Date("2026-11-24T20:00:00Z"))).toBe("2026-11-25");
    expect(dhakaDate(new Date("2026-11-24T17:59:00Z"))).toBe("2026-11-24");
  });

  it("counts whole days", () => {
    expect(daysBetween("2026-11-25", "2026-12-05")).toBe(10);
    expect(daysBetween("2026-11-25", "2026-11-24")).toBe(-1);
  });

  it("is expired after the date and expiring inside the alert days", () => {
    expect(expiryStatus("2026-11-24", "2026-11-25", 10)).toBe("expired");
    expect(expiryStatus("2026-11-25", "2026-11-25", 10)).toBe("expiring");
    expect(expiryStatus("2026-12-05", "2026-11-25", 10)).toBe("expiring");
    expect(expiryStatus("2026-12-06", "2026-11-25", 10)).toBe("ok");
  });
});

describe("what is left in each batch", () => {
  // Newest first: batch 3 came in last.
  const stockIns = [
    { id: 3, variantId: 1, quantity: 10, unitCost: 5, expiryDate: "2027-01-01" },
    { id: 2, variantId: 1, quantity: 10, unitCost: 5, expiryDate: "2026-12-01" },
    { id: 1, variantId: 1, quantity: 10, unitCost: 5, expiryDate: "2026-11-01" },
  ];

  it("counts the oldest batches as sold first", () => {
    const left = allocateBatches(stockIns, new Map([[1, 15]]));
    expect(left.get(3)).toBe(10);
    expect(left.get(2)).toBe(5);
    expect(left.get(1)).toBe(0);
  });

  it("leaves extra stock unbatched", () => {
    const left = allocateBatches(stockIns, new Map([[1, 40]]));
    expect([left.get(3), left.get(2), left.get(1)]).toEqual([10, 10, 10]);
  });
});
