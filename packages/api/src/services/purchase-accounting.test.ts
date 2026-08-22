import assert from "node:assert/strict";
import test from "node:test";
import { buildPurchasePosting } from "./purchase-accounting";

const scenarios = [
  ["supplier_advance_payment", "1103-supplier-advance", "1001-cash-on-hand"],
  ["purchase_receipt", "1003-inventory", "2001-accounts-payable"],
  ["supplier_advance_applied", "2001-accounts-payable", "1103-supplier-advance"],
  ["supplier_payment", "2001-accounts-payable", "1001-cash-on-hand"],
  ["purchase_return_due", "2001-accounts-payable", "1003-inventory"],
  [
    "purchase_return_paid",
    "1104-supplier-refund-receivable",
    "1003-inventory",
  ],
  [
    "supplier_refund_received",
    "1001-cash-on-hand",
    "1104-supplier-refund-receivable",
  ],
] as const;

for (const [transactionType, debitCode, creditCode] of scenarios) {
  test(`${transactionType} produces a balanced journal`, () => {
    const lines = buildPurchasePosting({ amount: 2284, transactionType });

    assert.deepEqual(lines, [
      { accountCode: debitCode, credit: 0, debit: 2284 },
      { accountCode: creditCode, credit: 2284, debit: 0 },
    ]);
    assert.equal(
      lines.reduce((total, line) => total + line.debit, 0),
      lines.reduce((total, line) => total + line.credit, 0),
    );
  });
}

test("rejects zero and negative purchase postings", () => {
  assert.throws(
    () => buildPurchasePosting({ amount: 0, transactionType: "purchase_receipt" }),
    /greater than zero/,
  );
});
