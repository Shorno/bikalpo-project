import assert from "node:assert/strict";
import test from "node:test";
import { resolveSelfPickupPaymentStatus } from "./self-pickup";

test("unpaid B2B self pickup remains unpaid after handover", () => {
  assert.equal(
    resolveSelfPickupPaymentStatus({
      dueAmount: 2_000,
      orderType: "b2b",
      requestedStatus: "settled",
    }),
    "unpaid",
  );
});

test("fully paid B2B self pickup is settled after handover", () => {
  assert.equal(
    resolveSelfPickupPaymentStatus({
      dueAmount: 0,
      orderType: "b2b",
      requestedStatus: "unpaid",
    }),
    "settled",
  );
});

test("retail self pickup keeps the collection status selected by its flow", () => {
  assert.equal(
    resolveSelfPickupPaymentStatus({
      dueAmount: 500,
      orderType: "b2c",
      requestedStatus: "collected",
    }),
    "collected",
  );
});
