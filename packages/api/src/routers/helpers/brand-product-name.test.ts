import assert from "node:assert/strict";
import test from "node:test";
import { brandProductName } from "./brand-product-name";

test("adds the brand in front of the display name", () => {
  assert.equal(brandProductName("Omera", "LPG Cylinder"), "Omera LPG Cylinder");
});

test("does not repeat a brand the display name already starts with", () => {
  assert.equal(
    brandProductName("Bengal", "Bengal LPG Cylinder"),
    "Bengal LPG Cylinder",
  );
  assert.equal(
    brandProductName("delta", "Delta LPG Cylinder"),
    "Delta LPG Cylinder",
  );
});

test("a name that only begins with the same letters still gets the brand", () => {
  assert.equal(brandProductName("BM", "BMW Gas"), "BM BMW Gas");
});

test("no brand keeps the display name", () => {
  assert.equal(brandProductName(null, " LPG Cylinder "), "LPG Cylinder");
});
