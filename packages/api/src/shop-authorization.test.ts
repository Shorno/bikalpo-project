import assert from "node:assert/strict";
import test from "node:test";

import {
  requireShopPermission,
  resolveShopAuthorization,
  type ShopRoleGrantRepository,
} from "./shop-authorization";

const staffUser = {
  id: "staff-1",
  role: "shop_staff",
  shopId: "shop-1",
  shopFunction: "sales_agent",
};

test("an assigned named role is evaluated by Better Auth", async () => {
  const repository: ShopRoleGrantRepository = {
    findAssignedRole: async () => ({
      id: 42,
      name: "Counter cashier",
      permissions: { shop_pos: ["view", "create"] },
    }),
  };

  const access = await resolveShopAuthorization(staffUser, repository);

  assert.equal(access.shopId, "shop-1");
  assert.equal(access.role?.name, "Counter cashier");
  assert.equal(access.can("shop_pos", "create"), true);
  assert.equal(access.can("shop_pos", "delete"), false);
  assert.equal(access.can("shop_stock", "view"), false);
});

test("existing staff keep their legacy template until backfill assigns a role", async () => {
  const repository: ShopRoleGrantRepository = {
    findAssignedRole: async () => null,
  };

  const access = await resolveShopAuthorization(staffUser, repository);

  assert.equal(access.source, "legacy");
  assert.equal(access.can("shop_pos", "view"), true);
  assert.equal(access.can("shop_stock", "view"), false);
});

test("shop owners retain full access without a stored assignment", async () => {
  const repository: ShopRoleGrantRepository = {
    findAssignedRole: async () => {
      throw new Error("owner access must not query staff assignments");
    },
  };

  const access = await resolveShopAuthorization(
    { id: "shop-1", role: "shop_owner", shopId: null, shopFunction: null },
    repository,
  );

  assert.equal(access.source, "owner");
  assert.equal(access.can("shop_staff", "manage"), true);
});

test("the authorization seam returns the parent shop and rejects missing grants", async () => {
  const repository: ShopRoleGrantRepository = {
    findAssignedRole: async () => ({
      id: 43,
      name: "Stock viewer",
      permissions: { shop_stock: ["view"] },
    }),
  };

  const allowed = await requireShopPermission(
    staffUser,
    "shop_stock",
    "view",
    repository,
  );
  assert.equal(allowed.shopId, "shop-1");

  await assert.rejects(
    requireShopPermission(staffUser, "shop_stock", "update", repository),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Shop stock update access required",
  );
});
