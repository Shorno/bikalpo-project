import assert from "node:assert/strict";
import test from "node:test";
import {
  type DetailVariantPrice,
  hasExchangeOption,
  inventoryUnitLabel,
  lpgPriceRows,
  variantOptionLabel,
} from "./catalog-product-detail";

const cylinder = (id: number, value: string) => ({
  id,
  name: `${value} kg Cylinder`,
  definitionKind: "measurement",
  definition: {
    kind: "measurement",
    value,
    measurementUnit: "kg",
    container: "cylinder",
  },
});

const variants: DetailVariantPrice[] = [
  {
    id: 2,
    consumerPrice: "4200",
    exchangeEnabled: true,
    exchangeCreditAmount: "2220",
    variantOption: cylinder(20, "33"),
  },
  {
    id: 1,
    consumerPrice: "3200.00",
    exchangeEnabled: true,
    exchangeCreditAmount: "1720.00",
    variantOption: cylinder(10, "12"),
  },
  {
    id: 3,
    consumerPrice: null,
    exchangeEnabled: false,
    variantOption: cylinder(30, "16"),
  },
];

test("variant labels keep value and unit", () => {
  assert.equal(variantOptionLabel(cylinder(1, "12")), "12 KG");
  assert.equal(variantOptionLabel({ id: 9, name: "Large" }), "Large");
  assert.equal(variantOptionLabel(null), "Variant");
});

test("inventory unit comes from the cylinder container", () => {
  assert.equal(inventoryUnitLabel(variants), "Cylinder");
  assert.equal(inventoryUnitLabel([]), null);
});

test("LPG price rows run smallest first with Exchange = New − credit", () => {
  assert.deepEqual(lpgPriceRows(variants), [
    { id: 1, capacity: "12 KG", newPrice: 3200, exchangePrice: 1480 },
    { id: 3, capacity: "16 KG", newPrice: null, exchangePrice: null },
    { id: 2, capacity: "33 KG", newPrice: 4200, exchangePrice: 1980 },
  ]);
  assert.equal(hasExchangeOption(variants), true);
  assert.equal(hasExchangeOption([variants[2]!]), false);
});
