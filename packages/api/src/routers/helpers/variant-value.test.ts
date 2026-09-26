import assert from "node:assert/strict";
import { test } from "node:test";
import { variantValueLabel } from "./variant-value";

test("shows measurement and attribute values instead of generic names", () => {
	assert.equal(
		variantValueLabel({
			name: "Cylinder",
			definition: {
				kind: "measurement",
				value: "12",
				measurementUnit: "KG",
				container: "cylinder",
			},
		}),
		"12 KG",
	);
	assert.equal(
		variantValueLabel({
			name: "RAM Capacity",
			unit: "unit",
			definition: {
				kind: "attribute",
				attribute: "RAM Capacity",
				value: "16 GB",
			},
		}),
		"16 GB",
	);
});

test("keeps legacy values and units without adding generic units twice", () => {
	assert.equal(
		variantValueLabel({ name: "RAM", size: "8 GB", unit: "unit" }),
		"8 GB",
	);
	assert.equal(
		variantValueLabel({ name: "Cylinder", size: "25", unit: "KG" }),
		"25 KG",
	);
	assert.equal(
		variantValueLabel({ definition: { kind: "loose", measurementUnit: "L" } }),
		"Per L",
	);
	assert.equal(variantValueLabel({ name: "Special pack" }), "Special pack");
	assert.equal(variantValueLabel({}), "—");
});
