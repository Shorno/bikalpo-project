import assert from "node:assert/strict";
import test from "node:test";
import {
  validateWarehouseStockTracking,
  WarehouseExpiryValidationError,
} from "./warehouse-expiry";
import { allocateCurrentStockLots } from "./warehouse-stock-lots";

test("expiry-enabled receipts require batch tracking, lot identity, and a valid date range", () => {
  assert.throws(
    () =>
      validateWarehouseStockTracking({
        productName: "Rice",
        trackingType: "none",
        expiryEnabled: true,
        expiryDate: "2027-01-01",
      }),
    WarehouseExpiryValidationError,
  );
  assert.throws(
    () =>
      validateWarehouseStockTracking({
        productName: "Rice",
        trackingType: "batch",
        expiryEnabled: true,
        batchNo: "LOT-1",
      }),
    /requires an expiry date/,
  );
  assert.throws(
    () =>
      validateWarehouseStockTracking({
        productName: "Rice",
        trackingType: "batch",
        expiryEnabled: true,
        batchNo: "LOT-1",
        manufactureDate: "2027-02-01",
        expiryDate: "2027-01-01",
      }),
    /after its manufacture date/,
  );

  assert.deepEqual(
    validateWarehouseStockTracking({
      productName: "Rice",
      trackingType: "batch",
      expiryEnabled: true,
      batchNo: " LOT-1 ",
      manufactureDate: "2026-01-01",
      expiryDate: "2027-01-01",
    }),
    {
      batchNo: "LOT-1",
      manufactureDate: "2026-01-01",
      expiryDate: "2027-01-01",
    },
  );
});

test("FIFO allocation reports only the receipt quantities still on hand", () => {
  const rows = [
    {
      id: 2,
      variantId: 10,
      inventoryDelta: "6",
      purchasePrice: "20",
      totalCost: "120",
    },
    {
      id: 1,
      variantId: 10,
      inventoryDelta: "4",
      purchasePrice: "10",
      totalCost: "40",
    },
  ];
  const allocation = allocateCurrentStockLots(rows, new Map([[10, 8]]));

  assert.equal(allocation.availableByStockEntry.get(2), 6);
  assert.equal(allocation.availableByStockEntry.get(1), 2);
  assert.equal(allocation.costsByVariant.get(10)?.quantity, 8);
  assert.equal(allocation.costsByVariant.get(10)?.weightedUnitCost, 17.5);
});
