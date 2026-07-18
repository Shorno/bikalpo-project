import assert from "node:assert/strict";
import test from "node:test";
import {
  getCartItemProductHref,
  getRetailerProductHref,
} from "./retailer-storefront-url";

test("builds retailer-scoped product links and preserves preview mode", () => {
  assert.equal(
    getRetailerProductHref({
      shopSlug: "rahman-store",
      productSlug: "miniket-rice",
    }),
    "/stores/rahman-store/products/miniket-rice",
  );
  assert.equal(
    getRetailerProductHref({
      shopSlug: "rahman-store",
      productSlug: "miniket-rice",
      previewMode: true,
    }),
    "/stores/rahman-store/products/miniket-rice?preview=customer",
  );
});

test("routes shop cart items back to their retailer and preserves global fallback", () => {
  assert.equal(
    getCartItemProductHref({
      shopSlug: "rahman-store",
      productSlug: "miniket-rice",
      categorySlug: "rice",
    }),
    "/stores/rahman-store/products/miniket-rice",
  );
  assert.equal(
    getCartItemProductHref({
      shopSlug: null,
      productSlug: "miniket-rice",
      categorySlug: "rice",
    }),
    "/products/rice/miniket-rice",
  );
  assert.equal(
    getCartItemProductHref({
      productSlug: "miniket-rice",
    }),
    "/products/all/miniket-rice",
  );
});
