import assert from "node:assert/strict";
import test from "node:test";
import {
  importConsumerReferencePricesSchema,
  referencePriceAmountSchema,
  resolveReferencePriceUpdate,
  updateConsumerReferencePriceSchema,
} from "./consumer-price";

test("reference prices reject zero, negative, fractional overflow, exponent and database overflow", () => {
  for (const value of [
    "0",
    "-1",
    "0.00",
    "1.234",
    "1e3",
    "NaN",
    "Infinity",
    "100000000",
    "",
    "1,500",
  ]) {
    assert.equal(
      referencePriceAmountSchema.safeParse(value).success,
      false,
      value,
    );
  }
  for (const value of ["0.01", "60", "3200.50", "99999999.99"])
    assert.equal(referencePriceAmountSchema.safeParse(value).success, true);
});

test("the client's LPG example preserves New price and derives the existing exchange credit exactly", () => {
  assert.deepEqual(
    resolveReferencePriceUpdate(
      { variantPriceId: 1, consumerPrice: "3200", exchangePrice: "1480" },
      {
        isCylinderPricing: true,
        exchangeEnabled: true,
        exchangeCreditAmount: "1700",
      },
    ),
    {
      consumerPrice: "3200.00",
      exchangePrice: "1480.00",
      exchangeEnabled: true,
      exchangeCreditAmount: "1720.00",
    },
  );
  assert.equal(
    resolveReferencePriceUpdate(
      { variantPriceId: 1, consumerPrice: "0.30", exchangePrice: "0.10" },
      {
        isCylinderPricing: true,
        exchangeEnabled: false,
        exchangeCreditAmount: "0",
      },
    ).exchangeCreditAmount,
    "0.20",
  );
});

test("cylinder price relationships and ordinary product scope are validated", () => {
  assert.equal(
    updateConsumerReferencePriceSchema.safeParse({
      variantPriceId: 1,
      consumerPrice: "1400",
      exchangePrice: "3200",
    }).success,
    false,
  );
  assert.throws(
    () =>
      resolveReferencePriceUpdate(
        { variantPriceId: 1, consumerPrice: "60", exchangePrice: "50" },
        {
          isCylinderPricing: false,
          exchangeEnabled: false,
          exchangeCreditAmount: "0",
        },
      ),
    /only available for cylinder/,
  );
  assert.throws(
    () =>
      resolveReferencePriceUpdate(
        { variantPriceId: 1, consumerPrice: "1000" },
        {
          isCylinderPricing: true,
          exchangeEnabled: true,
          exchangeCreditAmount: "1720",
        },
      ),
    /existing exchange credit/,
  );
});

test("bulk updates reject duplicate identities and empty imports", () => {
  assert.equal(
    importConsumerReferencePricesSchema.safeParse({ rows: [] }).success,
    false,
  );
  assert.equal(
    importConsumerReferencePricesSchema.safeParse({
      rows: [
        { variantPriceId: 1, consumerPrice: "60" },
        { variantPriceId: 1, consumerPrice: "65" },
      ],
    }).success,
    false,
  );
});
