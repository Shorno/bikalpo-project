import assert from "node:assert/strict";
import test from "node:test";
import {
  composeProductCode,
  parseProductCode,
  productCodesFor,
  saleTypesOf,
} from "./product-code";

const cylinder = (skuCode: string) => ({
  skuCode,
  definition: {
    kind: "measurement",
    value: "12",
    measurementUnit: "KG",
    container: "cylinder",
  },
});

test("builds Product ID + 0 + size code + Type code", () => {
  assert.equal(composeProductCode("02020117", "03", "02"), "0202011700302");
  assert.equal(composeProductCode("02020117", "3", "2"), "0202011700302");
  assert.equal(composeProductCode("0202011", "03", "02"), null);
  assert.equal(composeProductCode("02020117", null, "02"), null);
});

test("reads a typed or scanned code", () => {
  assert.deepEqual(parseProductCode(" 0202011700302 "), {
    productId: "02020117",
    sizeCode: "03",
    typeCode: "02",
  });
  assert.equal(parseProductCode("0202011710302"), null);
  assert.equal(parseProductCode("020201170030"), null);
});

test("Types come from the Variant Table, in Type order", () => {
  assert.deepEqual(
    saleTypesOf({
      variantOptionId: 1,
      saleTypePrices: { Refill: "1000", New: "1450", Exchange: "" },
    }),
    ["New", "Exchange", "Refill"],
  );
});

test("older cylinders read as New, plus Exchange when on", () => {
  assert.deepEqual(
    saleTypesOf({
      variantOptionId: 1,
      exchangeEnabled: true,
      variantOption: cylinder("01"),
    }),
    ["New", "Exchange"],
  );
  assert.deepEqual(
    saleTypesOf({ variantOptionId: 1, variantOption: { name: "35KG Cylinder" } }),
    ["New"],
  );
});

test("products without Types get Type code 00", () => {
  assert.deepEqual(
    productCodesFor("07180101", [
      { variantOptionId: 5, variantOption: { skuCode: "01", name: "8 GB" } },
    ]),
    [{ variantOptionId: 5, saleType: null, code: "0718010100100" }],
  );
});

test("one code per active size and Type; sizes without a code get none", () => {
  const codes = productCodesFor("02020117", [
    {
      variantOptionId: 1,
      variantOption: cylinder("01"),
      saleTypePrices: { New: "1450", Exchange: "1200" },
    },
    {
      variantOptionId: 4,
      variantOption: cylinder("04"),
      saleTypePrices: { Refill: "4000" },
    },
    {
      variantOptionId: 15,
      isActive: false,
      variantOption: cylinder("05"),
      saleTypePrices: { New: "800" },
    },
    { variantOptionId: 12, variantOption: cylinder(""), exchangeEnabled: false },
  ]);
  assert.deepEqual(
    codes.map((code) => code.code),
    ["0202011700101", "0202011700102", "0202011700403"],
  );
});
