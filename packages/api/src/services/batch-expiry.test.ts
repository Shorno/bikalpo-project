import { describe, expect, it } from "bun:test";
import { batchFieldErrors, cleanBatchFields } from "./batch-expiry";

describe("batch fields on stock-in", () => {
  it("needs a batch and expiry date when expiry tracking is on", () => {
    expect(batchFieldErrors({}, { expiryEnabled: true, label: "Rice 5 KG" })).toEqual([
      "Rice 5 KG: enter a batch number",
      "Rice 5 KG: enter an expiry date",
    ]);
    expect(
      batchFieldErrors(
        { batchNo: " B-1 ", expiryDate: "2026-12-31" },
        { expiryEnabled: true, label: "Rice" },
      ),
    ).toEqual([]);
  });

  it("asks nothing when expiry tracking is off", () => {
    expect(batchFieldErrors({ batchNo: "" }, { expiryEnabled: false, label: "Gas" })).toEqual([]);
  });

  it("rejects bad dates and expiry before manufacture", () => {
    expect(
      batchFieldErrors(
        { batchNo: "B", manufactureDate: "2026-02-30", expiryDate: "2026-01-01" },
        { expiryEnabled: true, label: "Oil" },
      ),
    ).toEqual(["Oil: Manufacture date is not a valid date"]);
    expect(
      batchFieldErrors(
        { batchNo: "B", manufactureDate: "2026-05-01", expiryDate: "2026-04-01" },
        { expiryEnabled: true, label: "Oil" },
      ),
    ).toEqual(["Oil: expiry date is before the manufacture date"]);
  });

  it("trims and turns blanks into null", () => {
    expect(cleanBatchFields({ batchNo: "  ", expiryDate: " 2026-01-01 " })).toEqual({
      batchNo: null,
      manufactureDate: null,
      expiryDate: "2026-01-01",
    });
  });
});
