import assert from "node:assert/strict";
import test from "node:test";
import {
  areVariantOptionsStructurallyCompatible,
  formatVariantStockQuantity,
  resolveVariantOperations,
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

  const movement = resolveVariantOperations(option({
    kind: "measurement",
    value: "12",
    measurementUnit: "KG",
    container: "cylinder",
    operationalUnit: "cylinder",
  }));
  assert.deepEqual(movement, {
    operationalUnit: "cylinder",
    receivingMode: "direct",
    quantityKind: "count",
    allowsDecimal: false,
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

test("derives family-independent operations from structured variant definitions", () => {
  const cases = [
    {
      definition: {
        kind: "measurement",
        value: "12",
        measurementUnit: "KG",
        container: "cylinder",
      },
      expected: { operationalUnit: "cylinder", receivingMode: "direct", quantityKind: "count", allowsDecimal: false },
    },
    {
      definition: {
        kind: "measurement",
        value: "500",
        measurementUnit: "Gram",
        container: "packet",
      },
      expected: { operationalUnit: "pack", receivingMode: "pack", quantityKind: "count", allowsDecimal: false },
    },
    {
      definition: {
        kind: "loose",
        measurementUnit: "KG",
      },
      expected: { operationalUnit: "kg", receivingMode: "loose", quantityKind: "mass", allowsDecimal: true },
    },
    {
      definition: {
        kind: "attribute",
        attribute: "Model",
        value: "Pro",
      },
      expected: { operationalUnit: "unit", receivingMode: "direct", quantityKind: "count", allowsDecimal: false },
    },
    {
      definition: {
        kind: "attribute",
        attribute: "Size",
        value: "42",
        operationalUnit: "pair",
      },
      expected: { operationalUnit: "pair", receivingMode: "direct", quantityKind: "count", allowsDecimal: false },
    },
    {
      definition: {
        kind: "attribute",
        attribute: "Size",
        value: "XL",
        operationalUnit: "piece",
      },
      expected: { operationalUnit: "piece", receivingMode: "direct", quantityKind: "count", allowsDecimal: false },
    },
  ];

  for (const testCase of cases) {
    const operations = resolveVariantOperations(option(testCase.definition));
    assert.deepEqual(
      {
        operationalUnit: operations.operationalUnit,
        receivingMode: operations.receivingMode,
        quantityKind: operations.quantityKind,
        allowsDecimal: operations.allowsDecimal,
      },
      testCase.expected,
    );
  }
});

test("RAM operations do not accept or depend on a Product Type family", () => {
  const ram = option({
    kind: "attribute",
    attribute: "RAM Capacity",
    value: "16 GB",
    operationalUnit: "unit",
  });

  assert.deepEqual(resolveVariantOperations(ram), {
    operationalUnit: "unit",
    receivingMode: "direct",
    quantityKind: "count",
    allowsDecimal: false,
  });
});

test("rejects an attribute definition that claims a container unit", () => {
  assert.throws(() =>
    resolveVariantOperations(option({
      kind: "attribute",
      attribute: "RAM Capacity",
      value: "16 GB",
      operationalUnit: "box",
    })),
  );
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
