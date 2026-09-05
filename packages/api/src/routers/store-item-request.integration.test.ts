import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";
import type { Context } from "../context";

dotenv.config({ path: "apps/server/.env" });

test(
  "store item requests enforce routing, ownership, validation and seller replies",
  { skip: process.env.RUN_STORE_ITEM_REQUEST_DB_TEST !== "1" },
  async () => {
    const [
      { db },
      { user, storeItemRequest },
      { inArray },
      { createRouterClient },
      { storeItemRequestRouter },
    ] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("@orpc/server"),
      import("./store-item-request"),
    ]);
    const suffix = randomUUID();
    const ids = [
      "buyer",
      "other-buyer",
      "shop",
      "other-shop",
      "unapproved",
    ].map((kind) => `request-${kind}-${suffix}`);
    const [buyer, otherBuyer, shop, otherShop, unapproved] = ids;
    const api = (id: string, role: string | null) =>
      createRouterClient(storeItemRequestRouter, {
        context: { session: { user: { id, role } } } as unknown as Context,
      });
    try {
      await db
        .insert(user)
        .values(
          ids.map((id, i) => ({
            id,
            name: "Request fixture",
            email: `${id}@example.test`,
            role: i < 2 ? "consumer" : "shop_owner",
            sellerStatus: i === 4 ? "pending" : "approved",
          })),
        );
      const customer = api(buyer, "consumer");
      const seller = api(shop, "shop_owner");
      const input = {
        shopId: shop,
        itemName: "Requested rice",
        quantity: 2,
        description: "Two small bags",
      };
      const request = await customer.create(input);
      assert.equal(request.shopId, shop);
      assert.equal(request.customerId, buyer);
      assert.equal((await seller.inbox({ page: 1 })).total, 1);
      assert.equal(
        (await api(otherShop, "shop_owner").inbox({ page: 1 })).total,
        0,
      );
      assert.equal(
        (await api(otherBuyer, "consumer").mine({ shopId: shop, page: 1 }))
          .total,
        0,
      );
      assert.equal(
        (await customer.mine({ shopId: otherShop, page: 1 })).total,
        0,
      );
      await assert.rejects(
        api(otherShop, "shop_owner").respond({
          id: request.id,
          status: "available",
          response: "Not my request",
        }),
      );
      await seller.respond({
        id: request.id,
        status: "available",
        response: "Available in small bags. Please contact the store.",
      });
      const updated = (await customer.mine({ shopId: shop, page: 1 }))
        .requests[0];
      assert.equal(updated.status, "available");
      assert.match(updated.response ?? "", /small bags/);
      await assert.rejects(customer.create({ ...input, quantity: 1.5 }));
      await assert.rejects(customer.create({ ...input, itemName: "  " }));
      await assert.rejects(customer.create({ ...input, shopId: unapproved }));
      await assert.rejects(seller.create(input));
      await assert.rejects(customer.inbox({ page: 1 }));
      await assert.rejects(
        customer.respond({
          id: request.id,
          status: "unavailable",
          response: "No",
        }),
      );
      const guest = createRouterClient(storeItemRequestRouter, {
        context: { session: null } as unknown as Context,
      });
      await assert.rejects(guest.create(input));
      await db
        .insert(storeItemRequest)
        .values(
          Array.from({ length: 20 }, () => ({ ...input, customerId: buyer })),
        );
      assert.equal(
        (await customer.mine({ shopId: shop, page: 1 })).requests.length,
        20,
      );
      assert.equal(
        (await customer.mine({ shopId: shop, page: 2 })).requests.length,
        1,
      );
    } finally {
      await db
        .delete(storeItemRequest)
        .where(inArray(storeItemRequest.customerId, [buyer, otherBuyer]));
      await db.delete(user).where(inArray(user.id, ids));
    }
  },
);
