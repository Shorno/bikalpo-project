import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageShopStaff,
  canShopActorAccessModule,
  isShopPortalRole,
  listAssignableShopFunctions,
  platformRoleForShopFunction,
  presentShopDirectoryMember,
  resolveShopFunctionForUser,
  SHOP_STAFF_PLATFORM_ROLE,
  shopFunctionAccessLevel,
  shopFunctionLabel,
  modulesForShopActor,
  shopPortalShopId,
} from "./shop-staff-access";

test("assignable shop functions stay off the platform role column", () => {
  assert.deepEqual(listAssignableShopFunctions(), [
    "shop_admin",
    "purchase_manager",
    "sales_agent",
    "delivery",
    "inventory",
  ]);
  assert.equal(listAssignableShopFunctions().includes("shop_owner"), false);
  assert.equal(listAssignableShopFunctions().includes("admin"), false);
});

test("shop functions map to display labels and access levels from the store wireframe", () => {
  assert.equal(shopFunctionLabel("shop_admin"), "Admin");
  assert.equal(shopFunctionAccessLevel("shop_admin"), "All Modules");
  assert.equal(shopFunctionLabel("purchase_manager"), "Purchase Mgr");
  assert.equal(shopFunctionAccessLevel("purchase_manager"), "Purchase");
  assert.equal(shopFunctionLabel("sales_agent"), "Sales Agent");
  assert.equal(shopFunctionAccessLevel("sales_agent"), "Sales");
  assert.equal(shopFunctionLabel("delivery"), "Delivery");
  assert.equal(shopFunctionAccessLevel("delivery"), "Delivery");
  assert.equal(shopFunctionLabel("inventory"), "Warehouse");
  assert.equal(shopFunctionAccessLevel("inventory"), "Inventory");
});

test("purchase manager may use purchase modules and not sales or staff", () => {
  assert.equal(canShopActorAccessModule("purchase_manager", "purchase"), true);
  assert.equal(canShopActorAccessModule("purchase_manager", "overview"), true);
  assert.equal(canShopActorAccessModule("purchase_manager", "sales"), false);
  assert.equal(canShopActorAccessModule("purchase_manager", "inventory"), false);
  assert.equal(canShopActorAccessModule("purchase_manager", "staff"), false);
});

test("sales agent may use sales modules and not purchase", () => {
  assert.equal(canShopActorAccessModule("sales_agent", "sales"), true);
  assert.equal(canShopActorAccessModule("sales_agent", "purchase"), false);
  assert.equal(canShopActorAccessModule("sales_agent", "delivery"), false);
});

test("shop admin may use every operational module but not staff management", () => {
  assert.equal(canShopActorAccessModule("shop_admin", "purchase"), true);
  assert.equal(canShopActorAccessModule("shop_admin", "sales"), true);
  assert.equal(canShopActorAccessModule("shop_admin", "inventory"), true);
  assert.equal(canShopActorAccessModule("shop_admin", "delivery"), true);
  assert.equal(canShopActorAccessModule("shop_admin", "finance"), true);
  assert.equal(canShopActorAccessModule("shop_admin", "staff"), false);
});

test("the shop owner has full control including staff management", () => {
  assert.equal(canShopActorAccessModule("owner", "staff"), true);
  assert.equal(canShopActorAccessModule("owner", "purchase"), true);
  assert.equal(canManageShopStaff("owner"), true);
  assert.equal(canManageShopStaff("shop_admin"), false);
  assert.equal(canManageShopStaff("purchase_manager"), false);
});

test("delivery stays on the deliveryman portal; other functions use shop_staff", () => {
  assert.equal(platformRoleForShopFunction("delivery"), "deliveryman");
  assert.equal(
    platformRoleForShopFunction("purchase_manager"),
    SHOP_STAFF_PLATFORM_ROLE,
  );
  assert.equal(platformRoleForShopFunction("shop_admin"), SHOP_STAFF_PLATFORM_ROLE);
  assert.equal(isShopPortalRole("shop_owner"), true);
  assert.equal(isShopPortalRole(SHOP_STAFF_PLATFORM_ROLE), true);
  assert.equal(isShopPortalRole("deliveryman"), false);
  assert.equal(isShopPortalRole("admin"), false);
});

test("stored users resolve to shop functions without rewriting platform role", () => {
  assert.equal(
    resolveShopFunctionForUser({
      role: "shop_staff",
      shopFunction: "purchase_manager",
    }),
    "purchase_manager",
  );
  assert.equal(
    resolveShopFunctionForUser({ role: "deliveryman", shopFunction: null }),
    "delivery",
  );
  assert.equal(
    resolveShopFunctionForUser({ role: "shop_owner", shopFunction: null }),
    "owner",
  );
});

test("shop portal tenancy is the owner id or the staff shopId", () => {
  assert.equal(
    shopPortalShopId({ id: "shop-1", role: "shop_owner", shopId: null }),
    "shop-1",
  );
  assert.equal(
    shopPortalShopId({
      id: "staff-1",
      role: SHOP_STAFF_PLATFORM_ROLE,
      shopId: "shop-1",
    }),
    "shop-1",
  );
  assert.equal(
    shopPortalShopId({
      id: "staff-1",
      role: SHOP_STAFF_PLATFORM_ROLE,
      shopId: null,
    }),
    null,
  );
  assert.equal(
    shopPortalShopId({
      id: "rider-1",
      role: "deliveryman",
      shopId: "shop-1",
    }),
    null,
  );
});

test("module bundles for the catalog are closed sets per function", () => {
  assert.deepEqual(modulesForShopActor("purchase_manager"), [
    "overview",
    "purchase",
    "contacts",
    "network",
  ]);
  assert.deepEqual(modulesForShopActor("sales_agent"), [
    "overview",
    "sales",
    "contacts",
    "fulfillment",
  ]);
  assert.equal(modulesForShopActor("shop_admin").includes("staff"), false);
  assert.equal(modulesForShopActor("owner").includes("staff"), true);
});

test("directory presentation labels the owner as Super Admin with Full Control", () => {
  const owner = presentShopDirectoryMember({
    id: "shop-1",
    name: "Roni",
    role: "shop_owner",
    shopFunction: null,
    banned: false,
  });
  assert.equal(owner.roleLabel, "Super Admin");
  assert.equal(owner.accessLevel, "Full Control");
  assert.equal(owner.isOwner, true);
  assert.equal(owner.canOpenProfile, true);

  const purchase = presentShopDirectoryMember({
    id: "staff-1",
    name: "Mehedi",
    role: "shop_staff",
    shopFunction: "purchase_manager",
    banned: false,
  });
  assert.equal(purchase.roleLabel, "Purchase Mgr");
  assert.equal(purchase.accessLevel, "Purchase");
  assert.equal(purchase.isOwner, false);
});
