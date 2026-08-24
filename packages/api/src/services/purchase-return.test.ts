import assert from "node:assert/strict";
import test from "node:test";
import { calculatePurchaseReturnSplit } from "./purchase-return";

test("an unpaid return reverses accounts payable", () => {
  assert.deepEqual(
    calculatePurchaseReturnSplit({
      dueAmount: 2284,
      paidAmount: 0,
      returnValue: 2284,
    }),
    { payableReversal: 2284, refundReceivable: 0, returnValue: 2284 },
  );
});

test("a paid return creates a supplier refund receivable", () => {
  assert.deepEqual(
    calculatePurchaseReturnSplit({
      dueAmount: 0,
      paidAmount: 2284,
      returnValue: 2284,
    }),
    { payableReversal: 0, refundReceivable: 2284, returnValue: 2284 },
  );
});

test("a partially paid return reverses due before requesting cash", () => {
  assert.deepEqual(
    calculatePurchaseReturnSplit({
      dueAmount: 1284,
      paidAmount: 1000,
      returnValue: 2284,
    }),
    { payableReversal: 1284, refundReceivable: 1000, returnValue: 2284 },
  );
});
