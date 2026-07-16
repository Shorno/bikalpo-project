import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERY_START_ORDER_STATUSES,
  getRetailerHandoffOtps,
  getRetailerOrderDisplayStatus,
} from "./retailer-delivery-handoff";

test("delivery start supports the restored order-first statuses", () => {
  assert.equal(DELIVERY_START_ORDER_STATUSES.includes("invoiced"), true);
  assert.equal(
    DELIVERY_START_ORDER_STATUSES.includes("partially_invoiced"),
    true,
  );
  assert.equal(
    (DELIVERY_START_ORDER_STATUSES as readonly string[]).includes("cancelled"),
    false,
  );
});

test("an active delivery overrides a stale invoiced display status", () => {
  assert.equal(
    getRetailerOrderDisplayStatus("invoiced", [
      {
        invoiceId: 7,
        groupStatus: "out_for_delivery",
        invoiceStatus: "pending",
        deliveryOtp: "4821",
      },
    ]),
    "processing",
  );
});

test("only active and unverified handoff codes are exposed", () => {
  const otps = getRetailerHandoffOtps(
    [
      { id: 1, invoiceNumber: "INV-1", fulfillmentMode: "internal_delivery" },
      {
        id: 2,
        invoiceNumber: "INV-2",
        fulfillmentMode: "self_pickup",
        completionOtp: "2233",
      },
      {
        id: 3,
        invoiceNumber: "INV-3",
        fulfillmentMode: "self_pickup",
        completionOtp: "3344",
        completionOtpVerifiedAt: new Date(),
      },
    ],
    [
      {
        invoiceId: 1,
        groupStatus: "out_for_delivery",
        invoiceStatus: "pending",
        deliveryOtp: "1122",
      },
      {
        invoiceId: 3,
        groupStatus: "completed",
        invoiceStatus: "delivered",
        deliveryOtp: "3344",
      },
    ],
  );

  assert.deepEqual(
    otps.map(({ invoiceNumber, label, otp }) => ({
      invoiceNumber,
      label,
      otp,
    })),
    [
      { invoiceNumber: "INV-1", label: "Delivery OTP", otp: "1122" },
      { invoiceNumber: "INV-2", label: "Pickup OTP", otp: "2233" },
    ],
  );
});

test("completed and failed delivery links do not expose an OTP", () => {
  const invoices = [
    { id: 1, invoiceNumber: "INV-1", fulfillmentMode: "internal_delivery" },
  ];

  for (const invoiceStatus of ["delivered", "failed", "returned"]) {
    assert.deepEqual(
      getRetailerHandoffOtps(invoices, [
        {
          invoiceId: 1,
          groupStatus: "out_for_delivery",
          invoiceStatus,
          deliveryOtp: "1122",
        },
      ]),
      [],
    );
  }
});
