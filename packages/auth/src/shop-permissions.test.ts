import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeShopPermission,
  canPermissionMapAccessModule,
  canPermissionMapAccessPath,
  isValidShopPermissionMapInput,
  normalizeShopPermissionMap,
  permissionMapForShopActor,
  permissionPageForPath,
} from "./shop-permissions";

test("stored grants are validated against the Better Auth permission catalog", () => {
  assert.deepEqual(
    normalizeShopPermissionMap({
      shop_pos: ["view", "create", "launch_missiles"],
      invented_resource: ["view"],
    }),
    {
      shop_pos: ["view", "create"],
    },
  );
});

test("Better Auth evaluates a database-shaped role permission map", () => {
  const grants = normalizeShopPermissionMap({
    shop_pos: ["view", "create"],
  });

  assert.equal(authorizeShopPermission(grants, "shop_pos", "create"), true);
  assert.equal(authorizeShopPermission(grants, "shop_pos", "delete"), false);
  assert.equal(
    authorizeShopPermission(grants, "shop_purchase_orders", "view"),
    false,
  );
});

test("legacy templates separate inventory work from purchasing work", () => {
  const purchase = permissionMapForShopActor("purchase_manager");
  const inventory = permissionMapForShopActor("inventory");

  assert.equal(
    authorizeShopPermission(purchase, "shop_purchase_orders", "view"),
    true,
  );
  assert.equal(authorizeShopPermission(purchase, "shop_stock", "view"), false);
  assert.equal(authorizeShopPermission(inventory, "shop_stock", "view"), true);
  assert.equal(
    authorizeShopPermission(inventory, "shop_purchase_orders", "view"),
    false,
  );
});

test("the page catalog uses the most specific route registration", () => {
  assert.equal(
    permissionPageForPath("/dashboard/products/brands")?.resource,
    "shop_pricing",
  );
  assert.equal(
    permissionPageForPath("/dashboard/products/123/edit")?.resource,
    "shop_products",
  );
  assert.equal(
    permissionPageForPath("/dashboard/user-roles/member-1")?.resource,
    "shop_staff",
  );
});

test("direct page access requires the registered view permission", () => {
  const sales = permissionMapForShopActor("sales_agent");

  assert.equal(canPermissionMapAccessPath(sales, "/dashboard/pos"), true);
  assert.equal(canPermissionMapAccessPath(sales, "/dashboard/stock"), false);
  assert.equal(
    canPermissionMapAccessPath(sales, "/dashboard/user-roles"),
    false,
  );
});

test("alias and report overview routes inherit their page grants", () => {
  assert.equal(
    canPermissionMapAccessPath({ shop_stock: ["view"] }, "/dashboard/inventory"),
    true,
  );
  assert.equal(
    canPermissionMapAccessPath(
      { shop_purchase_report: ["view"] },
      "/dashboard/reports",
    ),
    true,
  );
});

test("the owner template includes sensitive staff management", () => {
  const owner = permissionMapForShopActor("owner");
  assert.equal(authorizeShopPermission(owner, "shop_staff", "manage"), true);
  assert.equal(
    authorizeShopPermission(owner, "shop_system_control", "update"),
    true,
  );
});

test("module access is derived from at least one visible registered page", () => {
  const grants = normalizeShopPermissionMap({
    shop_stock: ["view"],
  });
  assert.equal(canPermissionMapAccessModule(grants, "inventory"), true);
  assert.equal(canPermissionMapAccessModule(grants, "purchase"), false);
});

test("custom-role staff fail closed when their database assignment is missing", () => {
  const grants = permissionMapForShopActor("custom");
  assert.deepEqual(grants, {});
  assert.equal(
    authorizeShopPermission(grants, "shop_dashboard", "view"),
    false,
  );
});

test("role editor payloads reject unknown grants and actions without page access", () => {
  assert.equal(
    isValidShopPermissionMapInput({ shop_pos: ["view", "create"] }),
    true,
  );
  assert.equal(isValidShopPermissionMapInput({ shop_pos: ["create"] }), false);
  assert.equal(
    isValidShopPermissionMapInput({ unknown_page: ["view"] }),
    false,
  );
});
