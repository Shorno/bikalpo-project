import assert from "node:assert/strict";
import test from "node:test";
import { buildRetailerProductHref } from "./retailer-storefront-route";

test("retailer product links preserve the selected store", () => {
  assert.equal(
    buildRetailerProductHref({
      storeSlug: "shorno-xyz",
      categorySlug: "lpg",
      productSlug: "bashundhara-lpg-gas-cylinder-wja4mg",
      previewMode: false,
    }),
    "/stores/shorno-xyz/products/bashundhara-lpg-gas-cylinder-wja4mg",
  );
});

test("retailer product links preserve customer preview mode", () => {
  assert.equal(
    buildRetailerProductHref({
      storeSlug: "shorno-xyz",
      categorySlug: "lpg",
      productSlug: "fresh-lpg-gas-cylinder-wja4mg",
      previewMode: true,
    }),
    "/stores/shorno-xyz/products/fresh-lpg-gas-cylinder-wja4mg?preview=customer",
  );
});
