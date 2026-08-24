import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateManualPurchaseTotals,
  verifyManualPurchaseInput,
} from "./manual-purchase-domain";

const items = [
  { inventoryId: 1, quantity: 5, unitCost: 700 },
  { inventoryId: 2, quantity: 8, unitCost: 120 },
];

test("calculates unpaid, partial, and full purchase totals", () => {
  const unpaid = calculateManualPurchaseTotals({ items, vatAmount: 40 });
  assert.deepEqual(unpaid, {
    amountDue: 4500,
    discount: 0,
    paidAmount: 0,
    paymentStatus: "unpaid",
    subtotal: 4460,
    total: 4500,
    vatAmount: 40,
  });

  const partial = calculateManualPurchaseTotals({
    discount: 100,
    items,
    paidAmount: 3000,
    vatAmount: 40,
  });
  assert.equal(partial.total, 4400);
  assert.equal(partial.amountDue, 1400);
  assert.equal(partial.paymentStatus, "partial");

  const paid = calculateManualPurchaseTotals({ items, paidAmount: 4460 });
  assert.equal(paid.amountDue, 0);
  assert.equal(paid.paymentStatus, "paid");
});

test("puts invalid manual purchases on hold", () => {
  const result = verifyManualPurchaseInput({
    items: [
      { inventoryId: 1, quantity: 1, unitCost: 100 },
      { inventoryId: 1, quantity: 0, unitCost: -1 },
    ],
    paidAmount: 200,
    supplierId: null,
  });

  assert.equal(result.isValid, false);
  assert.ok(result.errors.includes("Select a valid supplier"));
  assert.ok(result.errors.some((message) => message.includes("duplicates")));
  assert.ok(result.errors.some((message) => message.includes("quantity")));
  assert.ok(result.errors.some((message) => message.includes("price")));
});

test("requires an account only when money is paid", () => {
  assert.equal(
    verifyManualPurchaseInput({ items, paidAmount: 0, supplierId: 3 }).isValid,
    true,
  );
  assert.equal(
    verifyManualPurchaseInput({
      items,
      paidAmount: 100,
      supplierId: 3,
    }).isValid,
    false,
  );
  assert.equal(
    verifyManualPurchaseInput({
      items,
      paidAmount: 100,
      paymentAccountId: 8,
      paymentMethod: "bank",
      supplierId: 3,
    }).isValid,
    true,
  );
});
