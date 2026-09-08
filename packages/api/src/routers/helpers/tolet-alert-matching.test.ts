import assert from "node:assert/strict";
import test from "node:test";
import { alertLocationTerms, matchesToLetAlert } from "./tolet-alert-matching";

const preference = { preferredCategory: "family_flat", preferredLocation: "Mohammadpur, Dhaka", minimumSizeSqFt: 850 };
const listing = { unitType: "family_flat", location: "Mohammadpur Dhaka Dhaka", sizeSqFt: 850 };

test("all three conditions must match, with inclusive minimum size", () => {
  assert.equal(matchesToLetAlert(preference, listing), true);
  assert.equal(matchesToLetAlert(preference, { ...listing, sizeSqFt: 1200 }), true);
  assert.equal(matchesToLetAlert(preference, { ...listing, sizeSqFt: 849 }), false);
  assert.equal(matchesToLetAlert(preference, { ...listing, unitType: "shop" }), false);
  assert.equal(matchesToLetAlert(preference, { ...listing, location: "Mirpur Dhaka" }), false);
});
test("other preferences never prevent a matching alert", () => {
  const additional = { ...preference, minimumBedrooms: 20, minimumBathrooms: 30, minimumBalconies: 12, balconyPreference: "required", preferredFloor: "99" };
  assert.equal(matchesToLetAlert(additional, listing), true);
});
test("Any category/location and zero minimum include any sized rental", () => {
  assert.equal(matchesToLetAlert({ preferredCategory: "any", preferredLocation: " Any LOCATION ", minimumSizeSqFt: 0 }, { unitType: "shop", location: "Khulna", sizeSqFt: 1 }), true);
});
test("location matching is case-insensitive and all comma-separated terms must appear", () => {
  assert.deepEqual(alertLocationTerms("  DHAKA,   Mohammadpur "), ["dhaka", "mohammadpur"]);
  assert.equal(matchesToLetAlert({ ...preference, preferredLocation: " DHAKA, Mohammadpur " }, listing), true);
  assert.equal(matchesToLetAlert({ ...preference, preferredLocation: "%" }, listing), false);
  assert.equal(matchesToLetAlert({ ...preference, preferredLocation: "ঢাকা" }, { ...listing, location: "মোহাম্মদপুর ঢাকা" }), true);
});
