import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPosTypeTree,
  matchesPosTypeSelection,
} from "./warehouse-pos-catalog";

const variants = [
  { typeId: 1, typeName: "LPG", categoryId: 10, pack: "35 KG", brand: "Omera" },
  { typeId: 1, typeName: "LPG", categoryId: 10, pack: "12 KG", brand: "Omera" },
  {
    typeId: 1,
    typeName: "LPG",
    categoryId: 11,
    pack: "12 KG",
    brand: "Jamuna",
  },
  { typeId: 1, typeName: "LPG", categoryId: 11, pack: "5 KG", brand: "Jamuna" },
  {
    typeId: 2,
    typeName: "Cylinders",
    categoryId: 20,
    pack: "12 KG",
    brand: "Omera",
  },
];

test("POS tree lists every variant size under its type, once across brands and categories", () => {
  assert.deepEqual(buildPosTypeTree(variants), [
    { id: 2, name: "Cylinders", packs: ["12 KG"] },
    { id: 1, name: "LPG", packs: ["5 KG", "12 KG", "35 KG"] },
  ]);
});

test("selecting a type shows all its variants across categories", () => {
  const result = variants.filter((variant) =>
    matchesPosTypeSelection(variant, { typeId: 1, pack: null }),
  );
  assert.equal(result.length, 4);
  assert.deepEqual(
    new Set(result.map((variant) => variant.categoryId)),
    new Set([10, 11]),
  );
});

test("selecting a child retains its type and matches all brands of that variant", () => {
  const result = variants.filter((variant) =>
    matchesPosTypeSelection(variant, { typeId: 1, pack: "12 KG" }),
  );
  assert.deepEqual(
    result.map((variant) => variant.brand),
    ["Omera", "Jamuna"],
  );
  assert.ok(result.every((variant) => variant.typeId === 1));
});

test("All clears both type and variant filters; empty catalogs stay empty", () => {
  assert.equal(
    variants.filter((variant) => matchesPosTypeSelection(variant, null)).length,
    5,
  );
  assert.deepEqual(buildPosTypeTree([]), []);
});
