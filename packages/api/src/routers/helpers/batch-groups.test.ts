import { describe, expect, it } from "bun:test";
import { type BatchStockIn, buildBatchGroups } from "./batch-groups";

const size = {
  variantId: 1,
  productId: 10,
  productName: "ACI Miniket Rice",
  sizeLabel: "5 KG Pack",
  unit: "Pack",
  brandName: "ACI",
  color: "Red",
};

function stockIn(overrides: Partial<BatchStockIn>): BatchStockIn {
  return {
    id: 1,
    variantId: 1,
    quantity: 100,
    batchNo: "BT-250101",
    manufacturedCode: "XXL099",
    manufactureDate: "2025-01-01",
    expiryDate: "2026-01-01",
    receivedAt: new Date("2025-01-10T00:00:00Z"),
    source: "p1",
    supplierName: "ACI Foods Ltd.",
    invoiceNo: "PINV-250110-001",
    ...overrides,
  };
}

describe("buildBatchGroups", () => {
  it("lists batches with stock per size, soonest expiry first", () => {
    const groups = buildBatchGroups(
      [
        stockIn({ id: 3, batchNo: "BT-250401", expiryDate: "2026-04-01", quantity: 200, source: "p3" }),
        stockIn({ id: 2, batchNo: "BT-250215", expiryDate: "2026-02-15", quantity: 80, source: "p2" }),
        stockIn({ id: 1 }),
      ],
      new Map([
        [3, 200],
        [2, 80],
        [1, 25],
      ]),
      new Map([[1, size]]),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.brandName).toBe("ACI");
    expect(groups[0]!.batches.map((batch) => batch.batchNo)).toEqual([
      "BT-250101",
      "BT-250215",
      "BT-250401",
    ]);
    expect(groups[0]!.batches[0]).toMatchObject({
      manufacturedCode: "XXL099",
      receivedQty: 100,
      soldQty: 75,
      stockQty: 25,
      supplierName: "ACI Foods Ltd.",
      invoiceNo: "PINV-250110-001",
    });
  });

  it("leaves out sold-out batches, stock-ins without a batch and other owners' sizes", () => {
    const groups = buildBatchGroups(
      [
        stockIn({ id: 1 }),
        stockIn({ id: 2, batchNo: null, source: "p2" }),
        stockIn({ id: 3, variantId: 99, source: "p3" }),
      ],
      new Map([
        [1, 0],
        [2, 50],
        [3, 50],
      ]),
      new Map([[1, size]]),
    );
    expect(groups).toEqual([]);
  });
});
