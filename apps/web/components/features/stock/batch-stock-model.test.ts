import { describe, expect, it } from "bun:test";
import {
  type BatchSize,
  brandColor,
  formatBatchDate,
  formatBatchQty,
  matchesBatchSearch,
} from "./batch-stock-model";

const size: BatchSize = {
  variantId: 1,
  productId: 10,
  productName: "ACI Miniket Rice",
  sizeLabel: "5 KG Pack",
  unit: "Pack",
  brandName: "ACI",
  color: "Red",
  batches: [
    {
      key: "a",
      batchNo: "BT-250101",
      manufactureDate: "2025-01-01",
      expiryDate: "2026-01-01",
      manufacturedCode: "XXL099",
      supplierName: "ACI Foods Ltd.",
      invoiceNo: "PINV-250110-001",
      receivedQty: 100,
      soldQty: 75,
      stockQty: 25,
    },
  ],
};

describe("batch page text", () => {
  it("formats dates the way the client's page shows them", () => {
    expect(formatBatchDate("2025-01-01")).toBe("01 Jan 25");
    expect(formatBatchDate("2026-01-01", true)).toBe("01 Jan 2026");
    expect(formatBatchDate(null)).toBe("—");
  });

  it("formats quantities and brand/colour", () => {
    expect(formatBatchQty(25, "Pack")).toBe("25 Pack");
    expect(brandColor(size)).toBe("ACI/Red");
    expect(brandColor({ ...size, color: null })).toBe("ACI");
    expect(brandColor({ ...size, brandName: null, color: null })).toBe("—");
  });

  it("finds a size by product, batch or Manufactured code", () => {
    expect(matchesBatchSearch(size, "miniket")).toBe(true);
    expect(matchesBatchSearch(size, "bt-2501")).toBe(true);
    expect(matchesBatchSearch(size, "xxl099")).toBe(true);
    expect(matchesBatchSearch(size, "teer")).toBe(false);
  });
});
