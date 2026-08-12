import assert from "node:assert/strict";
import test from "node:test";
import { structuredVariantOptionInputSchema } from "./structured-variant-option-schema";

const scope = { typeId: 1, categoryId: null };

test("accepts Admin structured measurement, loose, and attribute definitions", () => {
  const definitions = [
    {
      kind: "measurement",
      value: "12",
      measurementUnit: "KG",
      container: "cylinder",
    },
    { kind: "loose", measurementUnit: "KG" },
    { kind: "attribute", attribute: "RAM Capacity", value: "16 GB" },
  ];

  for (const definition of definitions) {
    const parsed = structuredVariantOptionInputSchema.parse({
      ...scope,
      definition,
    });
    assert.equal(parsed.sortOrder, 0);
    assert.deepEqual(parsed.definition, definition);
  }
});

test("rejects the legacy requester contract and Global scope", () => {
  assert.equal(
    structuredVariantOptionInputSchema.safeParse({
      name: "16 GB RAM",
      unit: "Unit",
      size: "16 GB",
      variantType: "pack",
      typeId: 1,
      categoryId: null,
    }).success,
    false,
  );
  assert.equal(
    structuredVariantOptionInputSchema.safeParse({
      ...scope,
      typeId: null,
      definition: {
        kind: "attribute",
        attribute: "RAM Capacity",
        value: "16 GB",
      },
    }).success,
    false,
  );
});

test("rejects incomplete definitions and unsupported containers", () => {
  const invalidDefinitions = [
    {
      kind: "measurement",
      value: "",
      measurementUnit: "KG",
      container: "packet",
    },
    {
      kind: "measurement",
      value: "1",
      measurementUnit: "KG",
      container: "crate",
    },
    { kind: "loose", measurementUnit: "" },
    { kind: "attribute", attribute: "RAM Capacity", value: "" },
  ];

  for (const definition of invalidDefinitions) {
    assert.equal(
      structuredVariantOptionInputSchema.safeParse({ ...scope, definition })
        .success,
      false,
    );
  }
});
