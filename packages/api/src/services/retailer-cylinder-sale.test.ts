import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveRetailerCylinderSale,
  settleRetailerCylinderReturns,
} from "./retailer-cylinder-sale";

test("Exchange deducts the snapshotted credit and expects one exact empty per unit", () => {
  assert.deepEqual(
    resolveRetailerCylinderSale({
      newUnitPrice: "1500",
      exchangeEnabled: true,
      exchangeCreditAmount: "300",
      requestedMode: "exchange",
      quantity: 2,
    }),
    {
      mode: "exchange",
      newUnitPrice: "1500.00",
      exchangeCreditAmount: "300.00",
      effectiveUnitPrice: "1200.00",
      expectedEmptyPackQty: 2,
      lineTotal: "2400.00",
    },
  );
});

test("New keeps the listed price and does not expect an empty cylinder", () => {
  const result = resolveRetailerCylinderSale({
    newUnitPrice: 1500,
    exchangeEnabled: true,
    exchangeCreditAmount: 300,
    requestedMode: "new",
    quantity: 2,
  });
  assert.equal(result.effectiveUnitPrice, "1500.00");
  assert.equal(result.expectedEmptyPackQty, 0);
  assert.equal(result.lineTotal, "3000.00");
});

test("Exchange is rejected when the exact retailer variant is not enabled", () => {
  assert.throws(
    () =>
      resolveRetailerCylinderSale({
        newUnitPrice: 1500,
        exchangeEnabled: false,
        exchangeCreditAmount: 300,
        requestedMode: "exchange",
        quantity: 1,
      }),
    /not enabled/i,
  );
});

test("partial handoff converts missing empties to New using the snapshot credit", () => {
  assert.deepEqual(
    settleRetailerCylinderReturns([
      {
        orderItemId: 41,
        expectedEmptyPackQty: 3,
        acceptedEmptyPackQty: 2,
        exchangeCreditAmount: "300",
      },
    ]),
    {
      handoffBalance: "300.00",
      totalCollectedEmptyPacks: 2,
      lines: [
        {
          orderItemId: 41,
          collectedEmptyPackQty: 2,
          convertedToNewQty: 1,
          handoffBalance: "300.00",
        },
      ],
    },
  );
});
