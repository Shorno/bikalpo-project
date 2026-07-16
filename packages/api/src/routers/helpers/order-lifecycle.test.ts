import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalOrderFlow } from "./order-lifecycle";

const createdAt = new Date("2026-01-01T08:00:00.000Z");

function order(overrides: Record<string, unknown> = {}) {
  return {
    status: "pending",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function keys(flow: ReturnType<typeof buildCanonicalOrderFlow>) {
  return flow.map((step) => step.key);
}

test("pending orders stop at review without inventing fulfillment progress", () => {
  const flow = buildCanonicalOrderFlow({ order: order() });

  assert.deepEqual(keys(flow), [
    "placed",
    "review",
    "approved",
    "ready",
    "invoiced",
    "fulfillment",
    "delivered",
    "received",
  ]);
  assert.equal(flow.find((step) => step.key === "review")?.completed, false);
  assert.equal(flow.find((step) => step.key === "invoiced")?.completed, false);
});

test("modified orders wait for buyer approval with warning tone", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({
      status: "confirmed",
      confirmedAt: createdAt,
      modifiedByWarehouseAt: createdAt,
    }),
  });
  const approval = flow.find((step) => step.key === "approved");

  assert.equal(approval?.label, "Awaiting Buyer Approval");
  assert.equal(approval?.completed, false);
  assert.equal(approval?.tone, "warning");
});

test("the first delivery invoice completes invoicing but not dispatch or delivery", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({ status: "partially_invoiced", confirmedAt: createdAt }),
    invoices: [
      {
        id: 1,
        createdAt,
        deliveryStatus: "not_assigned",
        fulfillmentMode: "delivery",
      },
    ],
  });

  assert.equal(flow.find((step) => step.key === "invoiced")?.completed, true);
  assert.equal(
    flow.find((step) => step.key === "dispatched")?.completed,
    false,
  );
  assert.equal(flow.find((step) => step.key === "delivered")?.completed, false);
});

test("delivery orders use dispatch, transit, delivery, and receipt facts", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({
      status: "delivered",
      confirmedAt: createdAt,
      readyAt: createdAt,
      deliveredAt: createdAt,
      receivedAt: createdAt,
    }),
    invoices: [
      {
        id: 1,
        createdAt,
        deliveryStatus: "delivered",
        fulfillmentMode: "delivery",
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 1,
        groupStatus: "completed",
        invoiceStatus: "delivered",
        assignedAt: createdAt,
        startedAt: createdAt,
      },
    ],
  });

  assert.deepEqual(keys(flow).slice(-4), [
    "dispatched",
    "in_transit",
    "delivered",
    "received",
  ]);
  assert.equal(
    flow.every((step) => step.completed),
    true,
  );
});

test("self pickup replaces delivery-only milestones", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({ status: "invoiced", confirmedAt: createdAt }),
    invoices: [
      {
        id: 1,
        createdAt,
        deliveryStatus: "not_assigned",
        fulfillmentMode: "self_pickup",
        completionOtp: "123456",
      },
    ],
  });

  assert.deepEqual(keys(flow).slice(-3), [
    "ready_for_pickup",
    "collected",
    "received",
  ]);
  assert.equal(
    flow.some((step) => step.key === "in_transit"),
    false,
  );
});

test("legacy invoices infer delivery from their delivery group", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({ status: "processing", confirmedAt: createdAt }),
    invoices: [
      {
        id: 1,
        createdAt,
        deliveryStatus: "pending",
        fulfillmentMode: null,
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 1,
        groupStatus: "assigned",
        assignedAt: createdAt,
      },
    ],
  });

  assert.equal(
    flow.some((step) => step.key === "dispatched"),
    true,
  );
  assert.equal(
    flow.some((step) => step.key === "ready_for_pickup"),
    false,
  );
});

test("cancelled orders have a compact terminal flow", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({ status: "cancelled", cancelledAt: createdAt }),
  });

  assert.deepEqual(keys(flow), ["placed", "cancelled"]);
  assert.equal(flow[1]?.tone, "danger");
});

test("returned orders end at the factual terminal step", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({
      status: "returned",
      confirmedAt: createdAt,
      modifiedByWarehouseAt: createdAt,
    }),
    invoices: [
      {
        id: 1,
        createdAt,
        deliveryStatus: "returned",
        fulfillmentMode: "delivery",
      },
    ],
  });

  assert.equal(flow.at(-1)?.key, "returned");
  assert.equal(flow.at(-1)?.completed, true);
  assert.equal(
    flow.slice(0, -1).some((step) => !step.completed),
    false,
  );
});

test("failed delivery shows an issue without completing delivered", () => {
  const flow = buildCanonicalOrderFlow({
    order: order({ status: "processing", confirmedAt: createdAt }),
    invoices: [
      {
        id: 1,
        createdAt,
        deliveryStatus: "failed",
        fulfillmentMode: "delivery",
      },
    ],
  });

  assert.equal(flow.at(-1)?.key, "delivery_issue");
  assert.equal(flow.at(-1)?.tone, "warning");
  assert.equal(
    flow.some((step) => step.key === "delivered"),
    false,
  );
});
