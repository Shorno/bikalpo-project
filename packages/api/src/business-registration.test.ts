import assert from "node:assert/strict";
import test from "node:test";

import {
  assertBusinessNatureMatchesApplicationPath,
  resolveBusinessRegistration,
} from "./business-registration";

test("business nature selects the application path and portal role", () => {
  assert.deepEqual(resolveBusinessRegistration("retail_shop"), {
    applicationPath: "seller",
    portalRole: "shop_owner",
  });
  assert.deepEqual(resolveBusinessRegistration("manufacturer"), {
    applicationPath: "seller",
    portalRole: "shop_owner",
  });
  assert.deepEqual(resolveBusinessRegistration("importer"), {
    applicationPath: "seller",
    portalRole: "shop_owner",
  });
  assert.deepEqual(resolveBusinessRegistration("wholesaler"), {
    applicationPath: "warehouse",
    portalRole: "warehouse",
  });
  assert.deepEqual(resolveBusinessRegistration("distributor"), {
    applicationPath: "warehouse",
    portalRole: "warehouse",
  });
});

test("application paths reject contradictory business natures", () => {
  assert.throws(
    () => assertBusinessNatureMatchesApplicationPath("wholesaler", "seller"),
    /requires a warehouse owner application/i,
  );
  assert.throws(
    () =>
      assertBusinessNatureMatchesApplicationPath("retail_shop", "warehouse"),
    /requires a shop owner application/i,
  );
});

test("legacy applications may omit business nature", () => {
  assert.doesNotThrow(() =>
    assertBusinessNatureMatchesApplicationPath(undefined, "seller"),
  );
  assert.doesNotThrow(() =>
    assertBusinessNatureMatchesApplicationPath(undefined, "warehouse"),
  );
});
