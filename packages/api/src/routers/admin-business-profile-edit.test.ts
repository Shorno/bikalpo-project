import assert from "node:assert/strict";
import test from "node:test";
import { db } from "@bikalpo-project/db";
import {
  sellerApplication,
  user,
  warehouseApplication,
} from "@bikalpo-project/db/schema";
import { adminUserManagementRouter } from "./admin-user-management";

for (const role of ["shop_owner", "warehouse"] as const) {
  test(`admin edits the displayed ${role} business contact without changing sign-in identity`, async (t) => {
    const writes: { table: unknown; values: Record<string, unknown> }[] = [];
    const account = {
      id: "business-user",
      email: "owner@example.com",
      phoneNumber: "+8801700000000",
      role,
    };
    const update = (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          writes.push({ table, values });
        },
      }),
    });
    t.mock.method(db.query.user, "findFirst", async () => account);
    // Mock all write seams so the test cannot modify configured database data.
    t.mock.method(db, "update", update);
    t.mock.method(db, "transaction", async (work) =>
      work({
        update,
        query: {
          sellerApplication: {
            findFirst: async () => ({ id: "latest-seller-application" }),
          },
          warehouseApplication: {
            findFirst: async () => ({ id: "latest-warehouse-application" }),
          },
        },
      }),
    );
    await adminUserManagementRouter.updateInfo["~orpc"].handler!({
      context: {},
      input: {
        userId: account.id,
        ownerName: "Updated owner",
        businessPhoneNumber: "01800000000",
        businessEmail: "updated@example.com",
      },
    } as never);
    const profileWrite = writes.find(
      ({ table }) =>
        table ===
        (role === "shop_owner" ? sellerApplication : warehouseApplication),
    );
    assert.ok(
      profileWrite,
      "Missing update to the displayed business registration contact",
    );
    assert.deepEqual(profileWrite.values, {
      ownerName: "Updated owner",
      phoneNumber: "+8801800000000",
      email: "updated@example.com",
    });
    const accountWrite = writes.find(({ table }) => table === user);
    assert.deepEqual(accountWrite?.values, { ownerName: "Updated owner" });
    assert.ok(
      writes.every(
        ({ values }) =>
          !("businessPhoneNumber" in values) && !("businessEmail" in values),
      ),
    );
  });
}
