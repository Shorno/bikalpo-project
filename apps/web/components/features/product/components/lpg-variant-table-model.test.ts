import assert from "node:assert/strict";
import test from "node:test";
import {
  cylinderKgOf,
  DEFAULT_LPG_TYPE_OPTIONS,
  lpgTableError,
  lpgTableFromSizes,
  parseSizeList,
  rowsFromSizeSaleTypes,
  salePriceError,
  salePriceKey,
  saleTypePricesFor,
  sizeSaleTypes,
} from "./lpg-variant-table-model";

const types = DEFAULT_LPG_TYPE_OPTIONS;

test("parses typed sizes into KG and flags the rest", () => {
  const { sizes, invalid } = parseSizeList("12 KG, 15kg, 30, 12, 12.50 Kg., XL");
  assert.deepEqual(
    sizes.map((size) => size.label),
    ["12 KG", "12.5 KG", "15 KG", "30 KG"],
  );
  assert.deepEqual(invalid, ["XL"]);
});

test("a size only gets the Type options of the rows it is in", () => {
  const entries = sizeSaleTypes(
    [
      { types: ["New", "Exchange"], sizes: "12 KG, 15 KG" },
      { types: ["New"], sizes: "45 KG" },
      { types: ["Refill"], sizes: "50 KG" },
    ],
    types,
  );
  assert.deepEqual(
    entries.map((entry) => [entry.size.label, entry.types]),
    [
      ["12 KG", ["New", "Exchange"]],
      ["15 KG", ["New", "Exchange"]],
      ["45 KG", ["New"]],
      ["50 KG", ["Refill"]],
    ],
  );
});

test("the same size in two rows combines their Type options", () => {
  const entries = sizeSaleTypes(
    [
      { types: ["Exchange"], sizes: "12 KG" },
      { types: ["New"], sizes: "12" },
    ],
    types,
  );
  assert.deepEqual(entries.map((entry) => entry.types), [["New", "Exchange"]]);
});

test("rows without a ticked Type or a size are ignored", () => {
  const entries = sizeSaleTypes(
    [
      { types: [], sizes: "12 KG" },
      { types: ["New"], sizes: "" },
    ],
    types,
  );
  assert.equal(entries.length, 0);
});

test("saved sizes rebuild one row per selling condition, padded", () => {
  const rows = rowsFromSizeSaleTypes(
    [
      { size: { value: "12", label: "12 KG" }, types: ["Exchange", "New"] },
      { size: { value: "45", label: "45 KG" }, types: ["New"] },
      { size: { value: "15", label: "15 KG" }, types: ["New", "Exchange"] },
    ],
    types,
    6,
  );
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], { types: ["New", "Exchange"], sizes: "12 KG, 15 KG" });
  assert.deepEqual(rows[1], { types: ["New"], sizes: "45 KG" });
  assert.deepEqual(rows[2], { types: [], sizes: "" });
});

test("reads the KG of cylinder variant options", () => {
  assert.equal(
    cylinderKgOf({
      definition: {
        kind: "measurement",
        value: "12.0",
        measurementUnit: "KG",
        container: "cylinder",
      },
    }),
    "12",
  );
  assert.equal(
    cylinderKgOf({
      definition: {
        kind: "measurement",
        value: "1",
        measurementUnit: "KG",
        container: "pack",
      },
    }),
    null,
  );
  assert.equal(cylinderKgOf({ name: "35KG Cylinder" }), "35");
});

test("Exchange can't cost more than New for the same size", () => {
  const entry = {
    size: { value: "12", label: "12 KG" },
    types: ["New", "Exchange"],
  };
  assert.equal(
    salePriceError(entry, {
      [salePriceKey("12", "New")]: "1200",
      [salePriceKey("12", "Exchange")]: "1450",
    }),
    "12 KG: Exchange price can't be more than the New price.",
  );
  assert.equal(
    salePriceError(entry, { [salePriceKey("12", "Exchange")]: "1450" }),
    null,
  );
});

test("plain numbers are sizes in KG", () => {
  assert.deepEqual(
    parseSizeList("10, 12, 15").sizes.map((size) => size.label),
    ["10 KG", "12 KG", "15 KG"],
  );
});

test("saved seller sizes come back as rows and prices, and save the same", () => {
  const table = lpgTableFromSizes(
    [
      { kg: "12", saleTypePrices: { New: "1500", Exchange: "1200" } },
      { kg: "15", saleTypePrices: { New: "1800", Exchange: "" } },
      { kg: "50", saleTypePrices: { Refill: "" } },
      { kg: "12", saleTypePrices: { Refill: "900" } },
    ],
    types,
  );
  assert.equal(table.rows.length, types.length);
  assert.deepEqual(table.rows.slice(0, 2), [
    { types: ["New", "Exchange"], sizes: "12 KG, 15 KG" },
    { types: ["Refill"], sizes: "50 KG" },
  ]);
  assert.equal(table.prices[salePriceKey("12", "Exchange")], "1200");
  const entries = sizeSaleTypes(table.rows, types);
  assert.deepEqual(saleTypePricesFor(entries[0]!, table.prices), {
    New: "1500",
    Exchange: "1200",
  });
  assert.equal(lpgTableError(table, types), null);
});

test("a table with no size, a bad size or Exchange above New can't save", () => {
  const empty = lpgTableFromSizes([], types);
  assert.equal(
    lpgTableError(empty, types),
    "Tick a Type and enter at least one size",
  );
  assert.equal(
    lpgTableError(
      { rows: [{ types: ["New"], sizes: "12, big" }], prices: {} },
      types,
    ),
    "Not a size in KG: big",
  );
  assert.match(
    lpgTableError(
      {
        rows: [{ types: ["New", "Exchange"], sizes: "12" }],
        prices: { "12|New": "1000", "12|Exchange": "1100" },
      },
      types,
    ) ?? "",
    /Exchange price can't be more/,
  );
});

test("sizes come out smallest first, however they were typed or saved", () => {
  const entries = sizeSaleTypes(
    [
      { types: ["New"], sizes: "50, 12.5, 20" },
      { types: ["Refill"], sizes: "5" },
    ],
    types,
  );
  assert.deepEqual(
    entries.map((entry) => entry.size.label),
    ["5 KG", "12.5 KG", "20 KG", "50 KG"],
  );

  const table = lpgTableFromSizes(
    [
      { kg: "50", saleTypePrices: { New: "9000" } },
      { kg: "20", saleTypePrices: { New: "4000" } },
      { kg: "12", saleTypePrices: { New: "1500" } },
    ],
    types,
  );
  assert.equal(table.rows[0]?.sizes, "12 KG, 20 KG, 50 KG");
});
