import assert from "node:assert/strict";
import test from "node:test";
import { isCatalogRequesterRole } from "./catalog-requester-role";

test("only Warehouse and Shop Owner roles may request catalog definitions", () => {
  assert.equal(isCatalogRequesterRole("warehouse"), true);
  assert.equal(isCatalogRequesterRole("shop_owner"), true);
  assert.equal(isCatalogRequesterRole("consumer"), false);
  assert.equal(isCatalogRequesterRole("admin"), false);
  assert.equal(isCatalogRequesterRole(null), false);
});
