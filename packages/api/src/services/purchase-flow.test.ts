import assert from "node:assert/strict";
import test from "node:test";
import { buildPurchasePosting } from "./purchase-accounting";
import {
  allocateReceiptLandedCost,
  calculateReceiptPosting,
  classifyPurchasePayment,
  deriveFinancialStatus,
  derivePaymentAggregateStatus,
  derivePurchaseStatus,
} from "./purchase-lifecycle";

test("advance, receipt, and due settlement remain separate lifecycle steps", () => {
  const receivedAt = new Date("2026-08-22T06:00:00.000Z");
  const advance = classifyPurchasePayment({
    completedAt: new Date("2026-08-22T05:00:00.000Z"),
    receivedAt,
  });
  assert.deepEqual(advance, {
    purpose: "supplier_advance",
    timing: "before_receipt",
  });

  const receipt = calculateReceiptPosting({
    advanceAvailable: 9000,
    receiptValue: 50_000,
  });
  assert.deepEqual(receipt, {
    advanceApplied: 9000,
    payableCreated: 50_000,
    payableRemaining: 41_000,
    receiptValue: 50_000,
    settlementApplied: 0,
  });

  const settlement = classifyPurchasePayment({
    completedAt: new Date("2026-08-22T07:00:00.000Z"),
    receivedAt,
  });
  assert.deepEqual(settlement, {
    purpose: "payable_settlement",
    timing: "after_receipt",
  });
});

test("purchase receipt increases inventory without posting sales or COGS", () => {
  const receipt = buildPurchasePosting({
    amount: 50_000,
    transactionType: "purchase_receipt",
  });

  assert.deepEqual(receipt, [
    { accountCode: "1003-inventory", credit: 0, debit: 50_000 },
    { accountCode: "2001-accounts-payable", credit: 50_000, debit: 0 },
  ]);
  assert.equal(
    receipt.some((line) =>
      ["4001-sales-revenue", "5001-cost-of-goods-sold"].includes(
        line.accountCode,
      ),
    ),
    false,
  );
});

test("paid purchase cancellation uses a refund receivable until cash returns", () => {
  const returnPosting = buildPurchasePosting({
    amount: 2284,
    transactionType: "purchase_return_paid",
  });
  const refundPosting = buildPurchasePosting({
    amount: 2284,
    transactionType: "supplier_refund_received",
  });

  assert.deepEqual(returnPosting, [
    {
      accountCode: "1104-supplier-refund-receivable",
      credit: 0,
      debit: 2284,
    },
    { accountCode: "1003-inventory", credit: 2284, debit: 0 },
  ]);
  assert.deepEqual(refundPosting, [
    { accountCode: "1001-cash-on-hand", credit: 0, debit: 2284 },
    {
      accountCode: "1104-supplier-refund-receivable",
      credit: 2284,
      debit: 0,
    },
  ]);
});

test("partial receipts recognize only landed cost for stock received", () => {
  const [line] = allocateReceiptLandedCost({
    grandTotal: 2284,
    lines: [{ id: 7, lineTotal: 2200, orderedQty: 10, receivedQty: 4 }],
    subtotal: 2200,
  });

  assert.deepEqual(line, {
    id: 7,
    recognizedTotal: 913.6,
    unitCost: 228.4,
  });
  assert.equal(
    derivePurchaseStatus({
      expectedQty: 10,
      orderStatus: "delivered",
      receivedQty: 4,
    }),
    "partially_received",
  );
});

test("payment and financial status are independent from purchase status", () => {
  assert.equal(
    derivePaymentAggregateStatus({
      paidAmount: 50_000,
      purchaseTotal: 50_000,
      refundedAmount: 0,
    }),
    "paid",
  );
  assert.equal(
    deriveFinancialStatus({
      advanceBalance: 0,
      payableBalance: 0,
      recognizedAmount: 50_000,
      refundedAmount: 0,
    }),
    "settled",
  );
  assert.equal(
    deriveFinancialStatus({
      advanceBalance: 0,
      payableBalance: 0,
      recognizedAmount: 50_000,
      refundPending: true,
      refundedAmount: 0,
    }),
    "refund_pending",
  );
});
