import assert from "node:assert/strict";
import test from "node:test";
import { buildPurchasePosting } from "./purchase-accounting";

function lineMap(transactionType: Parameters<typeof buildPurchasePosting>[0]["transactionType"]) {
  return new Map(
    buildPurchasePosting({ amount: 71_200, transactionType }).map((line) => [
      line.accountCode,
      { credit: line.credit, debit: line.debit },
    ]),
  );
}

test("manual receipt recognizes inventory and payable without touching profit and loss", () => {
  const lines = lineMap("purchase_receipt");
  assert.deepEqual(lines.get("1003-inventory"), { credit: 0, debit: 71_200 });
  assert.deepEqual(lines.get("2001-accounts-payable"), {
    credit: 71_200,
    debit: 0,
  });
  assert.equal(lines.has("5000-cost-of-goods-sold"), false);
  assert.equal(lines.has("4000-sales-revenue"), false);
});

test("partial settlement reduces both payable and cash", () => {
  const lines = lineMap("supplier_payment");
  assert.deepEqual(lines.get("2001-accounts-payable"), {
    credit: 0,
    debit: 71_200,
  });
  assert.deepEqual(lines.get("1001-cash-on-hand"), {
    credit: 71_200,
    debit: 0,
  });
});

test("advance is an asset until it is applied at receipt", () => {
  const paid = lineMap("supplier_advance_payment");
  assert.deepEqual(paid.get("1103-supplier-advance"), {
    credit: 0,
    debit: 71_200,
  });
  const applied = lineMap("supplier_advance_applied");
  assert.deepEqual(applied.get("1103-supplier-advance"), {
    credit: 71_200,
    debit: 0,
  });
  assert.deepEqual(applied.get("2001-accounts-payable"), {
    credit: 0,
    debit: 71_200,
  });
});

test("cancelled paid receipts become supplier refund receivables", () => {
  const lines = lineMap("purchase_return_paid");
  assert.deepEqual(lines.get("1104-supplier-refund-receivable"), {
    credit: 0,
    debit: 71_200,
  });
  assert.deepEqual(lines.get("1003-inventory"), {
    credit: 71_200,
    debit: 0,
  });
});
