import assert from "node:assert/strict";
import test from "node:test";
import {
  getWarehouseStorefrontCheckoutTarget,
  resolveWarehouseStorefrontBuyerContext,
} from "./warehouse-storefront-cart";

test("Shop Owner storefront buyers retain the retailer-to-warehouse flow", () => {
  assert.deepEqual(
    resolveWarehouseStorefrontBuyerContext("shop_owner", false),
    {
      viewMode: "shop-owner",
      orderMode: "retailer",
    },
  );
  assert.equal(
    getWarehouseStorefrontCheckoutTarget("retailer"),
    "shop_owner.placeWarehouseOrder",
  );
});

test("connected Warehouse Owners retain the warehouse-supplier flow", () => {
  assert.deepEqual(resolveWarehouseStorefrontBuyerContext("warehouse", true), {
    viewMode: "warehouse-to-warehouse",
    orderMode: "w2w",
  });
  assert.equal(
    getWarehouseStorefrontCheckoutTarget("w2w"),
    "warehouse.placeWarehouseSupplierOrder",
  );
});

test("unconnected Warehouse Owners and guests cannot enter an order flow", () => {
  assert.deepEqual(resolveWarehouseStorefrontBuyerContext("warehouse", false), {
    viewMode: "view-only",
    orderMode: null,
  });
  assert.deepEqual(resolveWarehouseStorefrontBuyerContext(undefined, false), {
    viewMode: "login-only",
    orderMode: null,
  });
});
