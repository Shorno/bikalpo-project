import assert from "node:assert/strict";
import test from "node:test";
import { publicSocialUrl, storeFooterAnchor } from "./shop-footer-links";

test("footer anchors return to the shop root from product pages and retain preview", () => {
  assert.equal(
    storeFooterAnchor("shorno-xyz", "store-products", false),
    "/stores/shorno-xyz#store-products",
  );
  assert.equal(
    storeFooterAnchor("shorno-xyz", "store-information", true),
    "/stores/shorno-xyz?preview=customer#store-information",
  );
  assert.equal(
    storeFooterAnchor("store/name", "store-products", false),
    "/stores/store%2Fname#store-products",
  );
});

test("public social URLs reject executable or invalid destinations", () => {
  assert.equal(
    publicSocialUrl(" https://www.instagram.com/example/ "),
    "https://www.instagram.com/example/",
  );
  assert.equal(
    publicSocialUrl("http://facebook.com/example"),
    "http://facebook.com/example",
  );
  for (const value of [
    null,
    undefined,
    "",
    "invalid",
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.com",
    "https://user:secret@example.com",
  ])
    assert.equal(publicSocialUrl(value), null);
});
