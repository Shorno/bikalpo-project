import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOfferTotals,
  getOpenOrderStage,
  isEligibleRetailer,
  planStockHoldTransition,
  resolveCartTransition,
  sortComparableOffers,
} from "./open-order-domain";

test("fixed offer discounts produce a complete comparable total", () => {
  assert.deepEqual(
    calculateOfferTotals({
      lines: [
        { quantity: 2, unitPrice: 125 },
        { quantity: 1, unitPrice: 80 },
      ],
      discountType: "fixed",
      discountValue: 30,
      deliveryCharge: 20,
    }),
    {
      itemSubtotal: 330,
      discountAmount: 30,
      deliveryCharge: 20,
      finalTotal: 320,
    },
  );
});

test("percentage discounts are rounded to currency precision", () => {
  assert.deepEqual(
    calculateOfferTotals({
      lines: [{ quantity: 3, unitPrice: 99.99 }],
      discountType: "percentage",
      discountValue: 12.5,
      deliveryCharge: 15,
    }),
    {
      itemSubtotal: 299.97,
      discountAmount: 37.5,
      deliveryCharge: 15,
      finalTotal: 277.47,
    },
  );
});

test("offer totals reject invalid prices, discounts, and delivery charges", () => {
  assert.throws(
    () =>
      calculateOfferTotals({
        lines: [{ quantity: 1, unitPrice: 0 }],
        discountType: "fixed",
        discountValue: 0,
        deliveryCharge: 0,
      }),
    /positive retailer price/i,
  );
  assert.throws(
    () =>
      calculateOfferTotals({
        lines: [{ quantity: 1, unitPrice: 100 }],
        discountType: "percentage",
        discountValue: 101,
        deliveryCharge: 0,
      }),
    /percentage/i,
  );
  assert.throws(
    () =>
      calculateOfferTotals({
        lines: [{ quantity: 1, unitPrice: 100 }],
        discountType: "fixed",
        discountValue: 0,
        deliveryCharge: -1,
      }),
    /delivery/i,
  );
  assert.throws(
    () =>
      calculateOfferTotals({
        lines: [{ quantity: 1, unitPrice: 100 }],
        discountType: "fixed",
        discountValue: 101,
        deliveryCharge: 0,
      }),
    /subtotal/i,
  );
});

test("open orders move from collection to selection only after prices freeze", () => {
  const offerDeadline = new Date("2026-07-22T10:05:00.000Z");
  const selectionDeadline = new Date("2026-07-22T10:10:00.000Z");

  assert.equal(
    getOpenOrderStage({
      status: "negotiating",
      offerDeadline,
      selectionDeadline,
      offerCount: 2,
      now: new Date("2026-07-22T10:04:59.000Z"),
    }),
    "collecting_offers",
  );
  assert.equal(
    getOpenOrderStage({
      status: "negotiating",
      offerDeadline,
      selectionDeadline,
      offerCount: 2,
      now: offerDeadline,
    }),
    "selecting_offer",
  );
  assert.equal(
    getOpenOrderStage({
      status: "negotiating",
      offerDeadline,
      selectionDeadline,
      offerCount: 2,
      now: selectionDeadline,
    }),
    "expired",
  );
});

test("an offerless request ends as soon as its offer window closes", () => {
  assert.equal(
    getOpenOrderStage({
      status: "negotiating",
      offerDeadline: new Date("2026-07-22T10:05:00.000Z"),
      selectionDeadline: new Date("2026-07-22T10:10:00.000Z"),
      offerCount: 0,
      now: new Date("2026-07-22T10:05:00.000Z"),
    }),
    "no_offers",
  );
});

test("eligible retailers match every exact catalog variant and full quantity", () => {
  const request = [
    { catalogVariantId: 11, quantity: 2 },
    { catalogVariantId: 22, quantity: 1 },
  ];

  assert.equal(
    isEligibleRetailer({
      requestedItems: request,
      inventory: [
        { catalogVariantId: 11, availableQty: 2 },
        { catalogVariantId: 22, availableQty: 5 },
      ],
      distanceKm: 4.99,
      retailerAreaIds: [7],
      consumerAreaId: 7,
    }),
    true,
  );
  assert.equal(
    isEligibleRetailer({
      requestedItems: request,
      inventory: [
        { catalogVariantId: 11, availableQty: 1 },
        { catalogVariantId: 22, availableQty: 5 },
      ],
      distanceKm: 2,
      retailerAreaIds: [7],
      consumerAreaId: 7,
    }),
    false,
  );
  assert.equal(
    isEligibleRetailer({
      requestedItems: request,
      inventory: [
        { catalogVariantId: 11, availableQty: 2 },
        { catalogVariantId: 23, availableQty: 5 },
      ],
      distanceKm: 2,
      retailerAreaIds: [7],
      consumerAreaId: 7,
    }),
    false,
  );
  assert.equal(
    isEligibleRetailer({
      requestedItems: [{ catalogVariantId: 11, quantity: 2 }],
      inventory: [
        { catalogVariantId: 11, availableQty: 1 },
        { catalogVariantId: 11, availableQty: 1 },
      ],
      distanceKm: 2,
      retailerAreaIds: [7],
      consumerAreaId: 7,
    }),
    false,
  );
});

test("retailer eligibility enforces the five kilometre radius and service area", () => {
  const base = {
    requestedItems: [{ catalogVariantId: 11, quantity: 1 }],
    inventory: [{ catalogVariantId: 11, availableQty: 1 }],
    retailerAreaIds: [7],
    consumerAreaId: 7,
  };

  assert.equal(isEligibleRetailer({ ...base, distanceKm: 5.01 }), false);
  assert.equal(
    isEligibleRetailer({ ...base, distanceKm: 2, consumerAreaId: 9 }),
    false,
  );
});

test("comparable offers sort by total, delivery charge, then distance", () => {
  const offers = [
    { id: 1, finalTotal: 500, deliveryCharge: 30, distanceKm: 1 },
    { id: 2, finalTotal: 480, deliveryCharge: 50, distanceKm: 2 },
    { id: 3, finalTotal: 500, deliveryCharge: 20, distanceKm: 4 },
    { id: 4, finalTotal: 500, deliveryCharge: 20, distanceKm: 3 },
  ];

  assert.deepEqual(
    sortComparableOffers(offers).map((offer) => offer.id),
    [2, 4, 3, 1],
  );
  assert.deepEqual(
    offers.map((offer) => offer.id),
    [1, 2, 3, 4],
  );
});

test("stock hold transitions are idempotent for retries", () => {
  assert.deepEqual(
    planStockHoldTransition({ held: false, action: "reserve", quantity: 3 }),
    { availableDelta: -3, reservedDelta: 3, held: true },
  );
  assert.deepEqual(
    planStockHoldTransition({ held: true, action: "reserve", quantity: 3 }),
    { availableDelta: 0, reservedDelta: 0, held: true },
  );
  assert.deepEqual(
    planStockHoldTransition({ held: true, action: "release", quantity: 3 }),
    { availableDelta: 3, reservedDelta: -3, held: false },
  );
  assert.deepEqual(
    planStockHoldTransition({ held: false, action: "release", quantity: 3 }),
    { availableDelta: 0, reservedDelta: 0, held: false },
  );
  assert.deepEqual(
    planStockHoldTransition({ held: true, action: "consume", quantity: 3 }),
    { availableDelta: 0, reservedDelta: -3, held: false },
  );
});

test("cart mode changes require explicit replacement", () => {
  assert.deepEqual(
    resolveCartTransition({
      hasItems: false,
      currentMode: null,
      currentDirectShopId: null,
      requestedMode: "open_order",
      requestedDirectShopId: null,
      replaceCart: false,
    }),
    { replaceExistingItems: false },
  );
  assert.throws(
    () =>
      resolveCartTransition({
        hasItems: true,
        currentMode: "open_order",
        currentDirectShopId: null,
        requestedMode: "direct",
        requestedDirectShopId: "shop-b",
        replaceCart: false,
      }),
    /replace/i,
  );
  assert.throws(
    () =>
      resolveCartTransition({
        hasItems: true,
        currentMode: "direct",
        currentDirectShopId: "shop-a",
        requestedMode: "direct",
        requestedDirectShopId: "shop-b",
        replaceCart: false,
      }),
    /replace/i,
  );
  assert.deepEqual(
    resolveCartTransition({
      hasItems: true,
      currentMode: "open_order",
      currentDirectShopId: null,
      requestedMode: "direct",
      requestedDirectShopId: "shop-b",
      replaceCart: true,
    }),
    { replaceExistingItems: true },
  );
});
