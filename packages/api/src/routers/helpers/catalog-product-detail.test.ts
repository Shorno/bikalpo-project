import assert from "node:assert/strict";
import test from "node:test";
import { withoutPrices } from "./catalog-product-detail";

test("the seller view carries no product, variant, or exchange prices", () => {
  const detail = {
    id: 1,
    name: "Omera LPG Gas Cylinder",
    price: "1528.00",
    minimumOrderQty: "1.00",
    variantPrices: [
      {
        id: 10,
        consumerPrice: "1528.00",
        exchangeCreditAmount: "500.00",
        exchangeEnabled: true,
        catalogSku: "OMR-LPG-12KG",
      },
    ],
    variants: [{ id: 20, exchangeCreditAmount: "500.00", exchangeEnabled: true }],
  } as unknown as Parameters<typeof withoutPrices>[0];

  const view = withoutPrices(detail);
  const json = JSON.stringify(view);
  assert.ok(!json.includes("1528"), "selling price leaked");
  assert.ok(!json.includes("500.00"), "exchange credit leaked");
  // Everything else the page needs is kept.
  assert.equal(view.variantPrices[0]?.catalogSku, "OMR-LPG-12KG");
  assert.equal(view.variantPrices[0]?.exchangeEnabled, true);
  assert.equal((view as { minimumOrderQty?: string }).minimumOrderQty, "1.00");
});
