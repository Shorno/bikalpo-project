import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductTypeFulfillmentProfile,
  isWarehouseCylinderExchangeAvailable,
  shouldEnableWarehouseCylinderExchange,
} from "./fulfillment";

test("explicit LPG family cannot inherit generic fixed-pack modes", () => {
  const profile = buildProductTypeFulfillmentProfile({
    family: "lpg",
    name: "Fuel",
    slug: "fuel",
    inventoryBehaviour: "fixed_pack",
  });

  assert.equal(profile.family, "lpg");
  assert.equal(profile.defaultMode, "cylinder");
  assert.deepEqual(profile.supportedModes, ["cylinder"]);
  assert.equal(profile.orderUnit, "cylinder");
  assert.equal(profile.stockUnit, "cylinder");
  assert.equal(profile.supportsModeSwitching, false);
});

test("legacy LPG names still infer the LPG family during migration", () => {
  const profile = buildProductTypeFulfillmentProfile({
    name: "LPG",
    slug: "lpg",
    inventoryBehaviour: "fixed_pack",
  });

  assert.equal(profile.family, "lpg");
  assert.deepEqual(profile.supportedModes, ["cylinder"]);
});

test("warehouse Returnable pack on LPG enables New/Exchange", () => {
  assert.equal(
    shouldEnableWarehouseCylinderExchange({
      isReturnablePack: true,
      family: "lpg",
    }),
    true,
  );
  assert.equal(
    shouldEnableWarehouseCylinderExchange({
      isReturnablePack: false,
      family: "lpg",
    }),
    false,
  );
  assert.equal(
    shouldEnableWarehouseCylinderExchange({
      isReturnablePack: true,
      family: "grocery",
    }),
    false,
  );
  assert.equal(
    isWarehouseCylinderExchangeAvailable({
      isReturnablePack: true,
      family: "lpg",
      exchangeEnabled: false,
    }),
    true,
  );
  assert.equal(
    isWarehouseCylinderExchangeAvailable({
      isReturnablePack: true,
      family: "grocery",
      exchangeEnabled: true,
    }),
    true,
  );
  assert.equal(
    isWarehouseCylinderExchangeAvailable({
      isReturnablePack: false,
      family: "lpg",
      exchangeEnabled: true,
    }),
    false,
  );
});
