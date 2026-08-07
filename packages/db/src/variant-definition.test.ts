import assert from "node:assert/strict";
import test from "node:test";
import {
  areVariantOptionsStructurallyCompatible,
  formatVariantStockQuantity,
  resolveVariantMovementSemantics,
  resolveVariantStockSemantics,
} from "./variant-definition";

const option = (definition: Record<string, unknown>) => ({
  name: "Structured variant",
  definitionKind: definition.kind as string,
  definition,
  needsReview: false,
});

test("formats cylinders as count plus normalized mass", () => {
  const semantics = resolveVariantStockSemantics(option({
    kind: "measurement",
    value: "12",
    measurementUnit: "KG",
    container: "cylinder",
    operationalUnit: "cylinder",
  }));
  assert.equal(semantics.packType, "cylinder");
  assert.equal(semantics.massKgPerUnit, 12);
	assert.equal(formatVariantStockQuantity(semantics, 2), "2 cylinders · 24 KG");

  const movement = resolveVariantMovementSemantics(option({
    kind: "measurement",
    value: "12",
    measurementUnit: "KG",
    container: "cylinder",
    operationalUnit: "cylinder",
  }), "lpg");
  assert.deepEqual(movement, {
    family: "lpg",
    movementKind: "direct",
    enteredUnit: "cylinder",
    inventoryUnit: "cylinder",
    quantityKind: "count",
    allowsDecimal: false,
    conversionFactor: "1",
    referenceMeasurement: { unit: "kg", perInventoryUnit: "12" },
  });
});

test("normalizes grams without treating volume as weight", () => {
  const packet = resolveVariantStockSemantics(option({
    kind: "measurement",
    value: "500",
    measurementUnit: "Gram",
    container: "packet",
    operationalUnit: "pack",
  }));
  assert.equal(packet.massKgPerUnit, 0.5);
	assert.equal(formatVariantStockQuantity(packet, 10), "10 packs · 5 KG");

  const bottle = resolveVariantStockSemantics(option({
    kind: "measurement",
    value: "5",
    measurementUnit: "L",
    container: "bottle",
    operationalUnit: "bottle",
  }));
  assert.equal(bottle.massKgPerUnit, 0);
  assert.equal(bottle.volumeLPerUnit, 5);
	assert.equal(formatVariantStockQuantity(bottle, 3), "3 bottles · 15 L");
});

test("keeps loose and attribute inventory in their operational units", () => {
  const loose = resolveVariantStockSemantics(option({
    kind: "loose",
    measurementUnit: "L",
    operationalUnit: "l",
  }));
  assert.equal(formatVariantStockQuantity(loose, 20), "20 l");

  const size = resolveVariantStockSemantics(option({
    kind: "attribute",
    attribute: "Size",
    value: "XL",
    operationalUnit: "unit",
  }));
	assert.equal(formatVariantStockQuantity(size, 4), "4 units");
});

test("derives operational units from structured variant definitions", () => {
  const cases = [
    {
      family: "lpg" as const,
      definition: {
        kind: "measurement",
        value: "12",
        measurementUnit: "KG",
        container: "cylinder",
      },
      expected: "cylinder",
    },
    {
      family: "grocery" as const,
      definition: {
        kind: "measurement",
        value: "500",
        measurementUnit: "Gram",
        container: "packet",
      },
      expected: "pack",
    },
    {
      family: "grocery" as const,
      definition: {
        kind: "loose",
        measurementUnit: "KG",
      },
      expected: "kg",
    },
    {
      family: "electronics" as const,
      definition: {
        kind: "attribute",
        attribute: "Model",
        value: "Pro",
      },
      expected: "unit",
    },
  ];

  for (const testCase of cases) {
    const movement = resolveVariantMovementSemantics(
      option(testCase.definition),
      testCase.family,
    );
    assert.equal(movement.enteredUnit, testCase.expected);
    assert.equal(movement.inventoryUnit, testCase.expected);
  }
});

test("requires matching LPG capacity for linked inventory variants", () => {
  const cylinder = (value: string) =>
    option({
      kind: "measurement",
      value,
      measurementUnit: "KG",
      container: "cylinder",
      operationalUnit: "cylinder",
    });

  assert.equal(
    areVariantOptionsStructurallyCompatible(cylinder("12"), cylinder("12")),
    true,
  );
  assert.equal(
    areVariantOptionsStructurallyCompatible(cylinder("12"), cylinder("35")),
    false,
  );
});
