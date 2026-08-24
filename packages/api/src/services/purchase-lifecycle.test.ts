import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateReceiptLandedCost,
  calculateIncrementalReceipt,
  calculateReceiptPosting,
  classifyPurchasePayment,
  deriveFinancialStatus,
  derivePaymentAggregateStatus,
  derivePurchaseStatus,
} from "./purchase-lifecycle";

test("classifies successful payments around the receipt boundary", () => {
  const receivedAt = new Date("2026-08-22T10:00:00.000Z");

  assert.deepEqual(
    classifyPurchasePayment({
      completedAt: new Date("2026-08-22T09:00:00.000Z"),
      receivedAt,
    }),
    { purpose: "supplier_advance", timing: "before_receipt" },
  );
  assert.deepEqual(
    classifyPurchasePayment({ completedAt: receivedAt, receivedAt }),
    { purpose: "payable_settlement", timing: "at_receipt" },
  );
});

test("derives purchase state independently from payment", () => {
  assert.equal(
    derivePurchaseStatus({
      expectedQty: 10,
      orderStatus: "confirmed",
      receivedAt: null,
      receivedQty: 0,
    }),
    "accepted",
  );
  assert.equal(
    derivePurchaseStatus({
      expectedQty: 10,
      orderStatus: "delivered",
      receivedAt: null,
      receivedQty: 4,
    }),
    "partially_received",
  );
});

test("applies advance before leaving a supplier payable", () => {
  assert.deepEqual(
    calculateReceiptPosting({ advanceAvailable: 9000, receiptValue: 50_000 }),
    {
      advanceApplied: 9000,
      payableCreated: 50_000,
      payableRemaining: 41_000,
      receiptValue: 50_000,
      settlementApplied: 0,
    },
  );
});

test("posts only the newly received quantity and value", () => {
  assert.deepEqual(
    calculateIncrementalReceipt({
      cumulativeQuantity: 7,
      cumulativeValue: 1750,
      priorQuantity: 3,
      priorValue: 750,
    }),
    { quantity: 4, value: 1000 },
  );
});

test("rejects receipt totals that move backwards", () => {
  assert.throws(
    () =>
      calculateIncrementalReceipt({
        cumulativeQuantity: 2,
        cumulativeValue: 500,
        priorQuantity: 3,
        priorValue: 750,
      }),
    /cannot be lower/,
  );
});

test("allocates shipping and discounts proportionally into received stock", () => {
  const allocation = allocateReceiptLandedCost({
    grandTotal: 2284,
    subtotal: 2200,
    lines: [
      { id: 1, lineTotal: 1100, orderedQty: 10, receivedQty: 10 },
      { id: 2, lineTotal: 1100, orderedQty: 10, receivedQty: 5 },
    ],
  });

  assert.deepEqual(allocation, [
    { id: 1, recognizedTotal: 1142, unitCost: 114.2 },
    { id: 2, recognizedTotal: 571, unitCost: 114.2 },
  ]);
});

test("derives aggregate payment and financial statuses", () => {
  assert.equal(
    derivePaymentAggregateStatus({
      paidAmount: 9000,
      purchaseTotal: 50_000,
      refundedAmount: 0,
    }),
    "partial",
  );
  assert.equal(
    deriveFinancialStatus({
      advanceBalance: 9000,
      payableBalance: 0,
      recognizedAmount: 0,
      refundedAmount: 0,
    }),
    "advance_recorded",
  );
  assert.equal(
    deriveFinancialStatus({
      advanceBalance: 0,
      payableBalance: 41_000,
      recognizedAmount: 50_000,
      refundedAmount: 0,
    }),
    "partially_settled",
  );
});
