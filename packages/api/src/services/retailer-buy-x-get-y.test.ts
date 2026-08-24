import assert from "node:assert/strict";
import test from "node:test";

import { calculateBuyXGetYDiscount } from "./retailer-buy-x-get-y";

test("requires every configured buy and get variant", () => {
  const offer = {
    buyProducts: [
      { variantId: 10, quantity: 1 },
      { variantId: 20, quantity: 1 },
    ],
    getProducts: [{ variantId: 30, quantity: 1 }],
    benefitType: "free_product" as const,
  };

  assert.equal(
    calculateBuyXGetYDiscount({
      ...offer,
      lines: [
        { variantId: 10, quantity: 1, unitPrice: 100, lineTotal: 100 },
        { variantId: 20, quantity: 1, unitPrice: 80, lineTotal: 80 },
      ],
    }),
    null,
  );

  assert.deepEqual(
    calculateBuyXGetYDiscount({
      ...offer,
      lines: [
        { variantId: 10, quantity: 1, unitPrice: 100, lineTotal: 100 },
        { variantId: 20, quantity: 1, unitPrice: 80, lineTotal: 80 },
        { variantId: 30, quantity: 1, unitPrice: 50, lineTotal: 50 },
      ],
    }),
    {
      applications: 1,
      rewardQuantity: 1,
      discountAmount: 50,
      salesAmount: 230,
    },
  );
});

test("calculates complete bundles and honors the per-order cap", () => {
  assert.deepEqual(
    calculateBuyXGetYDiscount({
      lines: [
        { variantId: 10, quantity: 6, unitPrice: 100, lineTotal: 600 },
        { variantId: 30, quantity: 3, unitPrice: 50, lineTotal: 150 },
      ],
      buyProducts: [{ variantId: 10, quantity: 2 }],
      getProducts: [{ variantId: 30, quantity: 1 }],
      benefitType: "percentage_discount",
      benefitValue: 50,
      maxApplications: 2,
    }),
    {
      applications: 2,
      rewardQuantity: 2,
      discountAmount: 50,
      salesAmount: 750,
    },
  );
});

test("does not reuse the same units as both purchased and rewarded", () => {
  assert.equal(
    calculateBuyXGetYDiscount({
      lines: [{ variantId: 10, quantity: 2, unitPrice: 100, lineTotal: 200 }],
      buyProducts: [{ variantId: 10, quantity: 2 }],
      getProducts: [{ variantId: 10, quantity: 1 }],
      benefitType: "free_product",
    }),
    null,
  );

  assert.equal(
    calculateBuyXGetYDiscount({
      lines: [{ variantId: 10, quantity: 3, unitPrice: 100, lineTotal: 300 }],
      buyProducts: [{ variantId: 10, quantity: 2 }],
      getProducts: [{ variantId: 10, quantity: 1 }],
      benefitType: "free_product",
    })?.discountAmount,
    100,
  );
});

test("charges the configured fixed price for each reward unit", () => {
  assert.equal(
    calculateBuyXGetYDiscount({
      lines: [
        { variantId: 10, quantity: 4, unitPrice: 100, lineTotal: 400 },
        { variantId: 30, quantity: 2, unitPrice: 50, lineTotal: 100 },
      ],
      buyProducts: [{ variantId: 10, quantity: 2 }],
      getProducts: [{ variantId: 30, quantity: 1 }],
      benefitType: "fixed_price",
      benefitValue: 20,
    })?.discountAmount,
    60,
  );
});
