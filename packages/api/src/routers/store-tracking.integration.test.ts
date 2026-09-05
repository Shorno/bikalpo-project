import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";

dotenv.config({ path: "apps/server/.env" });

test(
  "store tracking isolates customers and stores, excludes terminal/open orders, and paginates",
  { skip: process.env.RUN_STORE_TRACKING_DB_TEST !== "1" },
  async () => {
    const [{ db }, { user, order }, { inArray }, { customerRouter }] =
      await Promise.all([
        import("@bikalpo-project/db"),
        import("@bikalpo-project/db/schema"),
        import("drizzle-orm"),
        import("./customer"),
      ]);
    const suffix = randomUUID();
    const ids = ["consumer", "other", "shop", "other-shop"].map(
      (role) => `tracking-${role}-${suffix}`,
    );
    const [consumerId, otherId, shopId, otherShopId] = ids;
    type Result = { total: number; orders: { orderNumber: string }[] };
    type Procedure = {
      "~orpc": {
        handler(args: { context: unknown; input: unknown }): Promise<Result>;
      };
    };
    const load = (page = 1) =>
      (customerRouter.getStoreActiveOrders as unknown as Procedure)[
        "~orpc"
      ].handler({
        context: { session: { user: { id: consumerId } } },
        input: { shopId, page },
      });
    const base = {
      userId: consumerId,
      shopId,
      subtotal: "100",
      total: "100",
      shippingName: "Tracking test",
      shippingPhone: "00000000000",
      shippingAddress: "Test address",
      shippingCity: "Test city",
    };
    try {
      await db.insert(user).values(
        ids.map((id, i) => ({
          id,
          name: "Tracking fixture",
          email: `${id}@example.test`,
          role: i < 2 ? "consumer" : "shop_owner",
        })),
      );
      await db.insert(order).values([
        ...(["delivered", "cancelled", "returned"] as const).map((status) => ({
          ...base,
          orderNumber: `${suffix}-${status}`,
          status,
        })),
        { ...base, orderNumber: `${suffix}-open`, isOpenOrder: true },
        { ...base, orderNumber: `${suffix}-other-user`, userId: otherId },
        { ...base, orderNumber: `${suffix}-other-shop`, shopId: otherShopId },
        { ...base, orderNumber: `${suffix}-b2b`, orderType: "b2b" },
      ]);
      assert.equal((await load()).total, 0);
      await db
        .insert(order)
        .values({ ...base, orderNumber: `${suffix}-single` });
      assert.deepEqual(
        (await load()).orders.map((item) => item.orderNumber),
        [`${suffix}-single`],
      );
      const detail = (
        orderNumber: string,
        scopedShopId: string | undefined = shopId,
      ) =>
        (
          customerRouter.getOrderByNumber as unknown as {
            "~orpc": {
              handler(
                args: unknown,
              ): Promise<{ order: { orderNumber: string } }>;
            };
          }
        )["~orpc"].handler({
          context: { session: { user: { id: consumerId } } },
          input: { orderNumber, shopId: scopedShopId },
        });
      assert.equal(
        (await detail(`${suffix}-single`)).order.orderNumber,
        `${suffix}-single`,
      );
      assert.equal(
        (await detail(`${suffix}-delivered`)).order.orderNumber,
        `${suffix}-delivered`,
      );
      for (const excluded of [
        "other-user",
        "other-shop",
        "open",
        "b2b",
        "missing",
      ]) {
        await assert.rejects(
          detail(`${suffix}-${excluded}`),
          /Order not found/,
        );
      }
      await assert.rejects(
        detail(`${suffix}-single`, otherShopId),
        /Order not found/,
      );
      await db.insert(order).values(
        Array.from({ length: 20 }, (_, i) => ({
          ...base,
          orderNumber: `${suffix}-active-${i}`,
        })),
      );
      const first = await load();
      const second = await load(2);
      assert.equal(first.total, 21);
      assert.equal(first.orders.length, 20);
      assert.equal(second.orders.length, 1);
      assert.equal(
        new Set(
          [...first.orders, ...second.orders].map((item) => item.orderNumber),
        ).size,
        21,
      );
      assert.equal((await load(3)).orders.length, 0);
    } finally {
      await db
        .delete(order)
        .where(inArray(order.userId, [consumerId, otherId]));
      await db.delete(user).where(inArray(user.id, ids));
    }
  },
);
