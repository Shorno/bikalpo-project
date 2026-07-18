import assert from "node:assert/strict";
import test from "node:test";
import { buildConsumerOrderJourney } from "./consumer-order-journey";

const placedAt = new Date("2026-07-19T08:00:00.000Z");

test("a pending consumer order exposes only the placed milestone", () => {
  const journey = buildConsumerOrderJourney({
    order: {
      status: "pending",
      createdAt: placedAt,
    },
  });

  assert.equal(journey.phase, "placed");
  assert.deepEqual(
    journey.steps.map(({ key, state }) => ({ key, state })),
    [
      { key: "placed", state: "current" },
      { key: "confirmed", state: "upcoming" },
      { key: "preparing", state: "upcoming" },
      { key: "out_for_delivery", state: "upcoming" },
      { key: "delivered", state: "upcoming" },
    ],
  );
  assert.equal(journey.delivery.otp, null);
});

test("retailer confirmation advances the consumer to store confirmed", () => {
  const confirmedAt = new Date("2026-07-19T08:15:00.000Z");
  const journey = buildConsumerOrderJourney({
    order: {
      status: "ready_for_dispatch",
      createdAt: placedAt,
      confirmedAt,
      readyAt: confirmedAt,
    },
  });

  assert.equal(journey.phase, "confirmed");
  assert.deepEqual(
    journey.steps.map(({ state }) => state),
    ["complete", "current", "upcoming", "upcoming", "upcoming"],
  );
  assert.equal(journey.steps[1]?.completedAt, confirmedAt);
});

test("an invoiced order with an assigned rider stays in preparing", () => {
  const invoiceAt = new Date("2026-07-19T08:25:00.000Z");
  const assignedAt = new Date("2026-07-19T08:35:00.000Z");
  const journey = buildConsumerOrderJourney({
    order: {
      status: "invoiced",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
      riderName: "Amin",
      riderPhone: "01700000000",
    },
    invoices: [
      {
        id: 11,
        invoiceNumber: "INV-2026-0011",
        createdAt: invoiceAt,
        deliveryStatus: "pending",
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 11,
        groupStatus: "assigned",
        invoiceStatus: "pending",
        assignedAt,
        startedAt: null,
        deliveredAt: null,
        deliveryOtp: null,
      },
    ],
  });

  assert.equal(journey.phase, "preparing");
  assert.deepEqual(journey.invoice, {
    id: 11,
    invoiceNumber: "INV-2026-0011",
    createdAt: invoiceAt,
  });
  assert.equal(journey.delivery.status, "assigned");
  assert.equal(journey.delivery.riderName, "Amin");
  assert.equal(journey.delivery.otp, null);
});

test("only an active delivery exposes the OTP and out-for-delivery phase", () => {
  const startedAt = new Date("2026-07-19T09:00:00.000Z");
  const journey = buildConsumerOrderJourney({
    order: {
      status: "processing",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
      shippedAt: startedAt,
      riderName: "Amin",
    },
    invoices: [
      {
        id: 11,
        invoiceNumber: "INV-2026-0011",
        createdAt: new Date("2026-07-19T08:25:00.000Z"),
        deliveryStatus: "out_for_delivery",
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 11,
        groupStatus: "out_for_delivery",
        invoiceStatus: "pending",
        assignedAt: new Date("2026-07-19T08:35:00.000Z"),
        startedAt,
        deliveryOtp: "4821",
      },
    ],
  });

  assert.equal(journey.phase, "out_for_delivery");
  assert.equal(journey.delivery.otp, "4821");
  assert.equal(journey.steps[3]?.completedAt, startedAt);
});

test("OTP-completed delivery marks the consumer journey delivered and hides the code", () => {
  const deliveredAt = new Date("2026-07-19T09:40:00.000Z");
  const journey = buildConsumerOrderJourney({
    order: {
      status: "delivered",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
      shippedAt: new Date("2026-07-19T09:00:00.000Z"),
      deliveredAt,
      receivedAt: deliveredAt,
    },
    invoices: [
      {
        id: 11,
        invoiceNumber: "INV-2026-0011",
        createdAt: new Date("2026-07-19T08:25:00.000Z"),
        deliveryStatus: "delivered",
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 11,
        groupStatus: "completed",
        invoiceStatus: "delivered",
        assignedAt: new Date("2026-07-19T08:35:00.000Z"),
        startedAt: new Date("2026-07-19T09:00:00.000Z"),
        deliveredAt,
        deliveryOtp: "4821",
      },
    ],
  });

  assert.equal(journey.phase, "delivered");
  assert.deepEqual(
    journey.steps.map(({ state }) => state),
    ["complete", "complete", "complete", "complete", "current"],
  );
  assert.equal(journey.steps[4]?.completedAt, deliveredAt);
  assert.equal(journey.delivery.otp, null);
});

test("a failed delivery reports an issue without inventing delivery completion", () => {
  const journey = buildConsumerOrderJourney({
    order: {
      status: "processing",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
      shippedAt: new Date("2026-07-19T09:00:00.000Z"),
    },
    invoices: [
      {
        id: 11,
        invoiceNumber: "INV-2026-0011",
        createdAt: new Date("2026-07-19T08:25:00.000Z"),
        deliveryStatus: "failed",
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 11,
        groupStatus: "partial",
        invoiceStatus: "failed",
        startedAt: new Date("2026-07-19T09:00:00.000Z"),
        deliveryOtp: "4821",
      },
    ],
  });

  assert.equal(journey.phase, "delivery_issue");
  assert.notEqual(journey.steps[4]?.state, "complete");
  assert.equal(journey.delivery.otp, null);
});

test("a retry clears the consumer issue when the current invoice is preparing again", () => {
  const journey = buildConsumerOrderJourney({
    order: {
      status: "invoiced",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
    },
    invoices: [
      {
        id: 11,
        invoiceNumber: "INV-2026-0011",
        createdAt: new Date("2026-07-19T08:25:00.000Z"),
        deliveryStatus: "not_assigned",
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 11,
        groupStatus: "partial",
        invoiceStatus: "failed",
        startedAt: new Date("2026-07-19T09:00:00.000Z"),
        deliveryOtp: "4821",
      },
    ],
  });

  assert.equal(journey.phase, "preparing");
  assert.equal(journey.delivery.status, null);
  assert.equal(journey.delivery.startedAt, null);
  assert.equal(journey.delivery.otp, null);
});

test("a legacy processing row without dispatch facts remains in preparing", () => {
  const journey = buildConsumerOrderJourney({
    order: {
      status: "processing",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
      shippedAt: null,
    },
  });

  assert.equal(journey.phase, "preparing");
  assert.equal(journey.invoice, null);
  assert.equal(journey.delivery.otp, null);
});

test("a cancelled order preserves real milestones without advancing the journey", () => {
  const journey = buildConsumerOrderJourney({
    order: {
      status: "cancelled",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
      cancelledAt: new Date("2026-07-19T08:20:00.000Z"),
    },
  });

  assert.equal(journey.phase, "cancelled");
  assert.deepEqual(
    journey.steps.map(({ state }) => state),
    ["complete", "complete", "upcoming", "upcoming", "upcoming"],
  );
  assert.equal(journey.delivery.otp, null);
});

test("a returned order is terminal without pretending it was delivered", () => {
  const journey = buildConsumerOrderJourney({
    order: {
      status: "returned",
      createdAt: placedAt,
      confirmedAt: new Date("2026-07-19T08:15:00.000Z"),
      shippedAt: new Date("2026-07-19T09:00:00.000Z"),
    },
    invoices: [
      {
        id: 11,
        invoiceNumber: "INV-2026-0011",
        createdAt: new Date("2026-07-19T08:25:00.000Z"),
        deliveryStatus: "returned",
      },
    ],
    deliveryLinks: [
      {
        invoiceId: 11,
        groupStatus: "completed",
        invoiceStatus: "returned",
        startedAt: new Date("2026-07-19T09:00:00.000Z"),
        deliveryOtp: "4821",
      },
    ],
  });

  assert.equal(journey.phase, "returned");
  assert.deepEqual(
    journey.steps.map(({ state }) => state),
    ["complete", "complete", "complete", "complete", "upcoming"],
  );
  assert.equal(journey.delivery.otp, null);
});
