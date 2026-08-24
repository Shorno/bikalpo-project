import assert from "node:assert/strict";
import test from "node:test";
import {
  getCartonSellingPriceBreakdown,
  operationalQuantityLabel,
} from "./carton-summary-values";

test("uses the operational unit instead of pack terminology", () => {
  assert.equal(operationalQuantityLabel(5, "cylinder"), "5 cylinders");
  assert.equal(operationalQuantityLabel(1, "unit"), "1 unit");
  assert.equal(operationalQuantityLabel(2, "pair"), "2 pairs");
});

test("derives unit selling price from the entered carton selling price", () => {
  assert.deepEqual(getCartonSellingPriceBreakdown("26000", 5), {
    cartonPrice: 26000,
    unitPrice: 5200,
  });
  assert.equal(getCartonSellingPriceBreakdown("", 5), null);
  assert.equal(getCartonSellingPriceBreakdown("26000", 0), null);
});
