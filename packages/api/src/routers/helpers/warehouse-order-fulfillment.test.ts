import assert from "node:assert/strict";
import test from "node:test";
import { resolveWarehouseOrderMode } from "./warehouse-order-fulfillment";

test("LPG rejects legacy pack requests and resolves to cylinders", () => {
  const resolved = resolveWarehouseOrderMode({
    requestedMode: "pack",
    activeCartonCount: 10,
    productType: {
      inventoryBehaviour: "fixed_pack",
    },
    variantOperations: {
      operationalUnit: "cylinder",
      receivingMode: "direct",
      quantityKind: "count",
      allowsDecimal: false,
    },
  });

  assert.equal(resolved.supportsRequestedMode, false);
  assert.equal(resolved.mode, "cylinder");
  assert.equal(resolved.stockStrategy, "direct_quantity");
  assert.equal(resolved.inventoryBehaviour, "fixed_pack");
});

test("RAM resolves to unit ordering without Product Type family input", () => {
  const variantOperations = {
    operationalUnit: "unit",
    receivingMode: "direct" as const,
    quantityKind: "count" as const,
    allowsDecimal: false,
  };
  const first = resolveWarehouseOrderMode({
    requestedMode: "pack",
    productType: { inventoryBehaviour: "fixed_pack" },
    variantOperations,
  });
  const second = resolveWarehouseOrderMode({
    requestedMode: "pack",
    productType: { inventoryBehaviour: "fixed_pack" },
    variantOperations,
  });

  assert.equal(first.mode, "unit");
  assert.equal(second.mode, "unit");
  assert.equal(first.stockStrategy, "direct_quantity");
  assert.equal(second.stockStrategy, "direct_quantity");
});
