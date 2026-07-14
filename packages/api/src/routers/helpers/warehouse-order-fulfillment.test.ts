import assert from "node:assert/strict";
import test from "node:test";
import { resolveWarehouseOrderMode } from "./warehouse-order-fulfillment";

test("LPG rejects legacy pack requests and resolves to cylinders", () => {
  const resolved = resolveWarehouseOrderMode({
    requestedMode: "pack",
    activeCartonCount: 10,
    productType: {
      family: "lpg",
      inventoryBehaviour: "fixed_pack",
    },
  });

  assert.equal(resolved.supportsRequestedMode, false);
  assert.equal(resolved.mode, "cylinder");
  assert.equal(resolved.stockStrategy, "direct_quantity");
  assert.deepEqual(resolved.profile.supportedModes, ["cylinder"]);
});
