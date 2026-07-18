import assert from "node:assert/strict";
import test from "node:test";
import { getRetailerOrderTransition } from "./retailer-consumer-flow";

test("confirming a pending retailer order makes it ready for invoicing", () => {
  assert.deepEqual(getRetailerOrderTransition("pending", "confirm"), {
    nextStatus: "ready_for_dispatch",
    setConfirmedAt: true,
    setReadyAt: true,
  });
});

test("only confirmed or dispatch-ready retailer orders can be invoiced", () => {
  assert.deepEqual(
    getRetailerOrderTransition("ready_for_dispatch", "create_invoice"),
    { nextStatus: "invoiced" },
  );
  assert.deepEqual(getRetailerOrderTransition("confirmed", "create_invoice"), {
    nextStatus: "invoiced",
  });
  assert.equal(getRetailerOrderTransition("pending", "create_invoice"), null);
});

test("retailer cancellation stops once an invoice exists", () => {
  for (const status of ["pending", "confirmed", "ready_for_dispatch"]) {
    assert.deepEqual(getRetailerOrderTransition(status, "cancel"), {
      nextStatus: "cancelled",
      setCancelledAt: true,
    });
  }
  assert.equal(getRetailerOrderTransition("invoiced", "cancel"), null);
  assert.equal(getRetailerOrderTransition("processing", "cancel"), null);
});
