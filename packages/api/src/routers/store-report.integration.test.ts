import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import dotenv from "dotenv";

dotenv.config({ path: "apps/server/.env" });

test(
  "a consumer store report reaches its shop and is readable by its creator",
  { skip: process.env.RUN_STORE_REPORT_DB_TEST !== "1" },
  async () => {
    const [
      { db },
      { user, supportTicket },
      { eq, inArray },
      { userTicketRouter },
    ] = await Promise.all([
      import("@bikalpo-project/db"),
      import("@bikalpo-project/db/schema"),
      import("drizzle-orm"),
      import("./user-ticket"),
    ]);
    const suffix = randomUUID();
    const consumerId = `report-consumer-${suffix}`;
    const shopId = `report-shop-${suffix}`;
    const context = { session: { user: { id: consumerId, role: "consumer" } } };
    type Procedure = {
      "~orpc": {
        handler(args: { context: unknown; input: unknown }): Promise<unknown>;
      };
    };
    const invoke = (procedure: unknown, input: unknown) =>
      (procedure as Procedure)["~orpc"].handler({ context, input });
    try {
      await db.insert(user).values([
        {
          id: consumerId,
          name: "Report test consumer",
          email: `${consumerId}@example.test`,
          role: "consumer",
        },
        {
          id: shopId,
          name: "Report test shop",
          email: `${shopId}@example.test`,
          role: "shop_owner",
          isSeller: true,
          sellerStatus: "approved",
        },
      ]);
      const ticket = (await invoke(userTicketRouter.create, {
        shopId,
        subject: "Test store issue",
        message: "Isolated test report for store support.",
        category: "other",
        priority: "medium",
      })) as { id: number; assignedToId: string; customerId: string };
      assert.equal(ticket.assignedToId, shopId);
      assert.equal(ticket.customerId, consumerId);
      const detail = await invoke(userTicketRouter.getById, { id: ticket.id });
      assert.ok(detail);
      await assert.rejects(
        invoke(userTicketRouter.create, {
          shopId: consumerId,
          subject: "Test store issue",
          message: "Isolated test report for store support.",
          category: "other",
          priority: "medium",
        }),
        /Invalid shop/,
      );
    } finally {
      await db
        .delete(supportTicket)
        .where(eq(supportTicket.customerId, consumerId));
      await db.delete(user).where(inArray(user.id, [consumerId, shopId]));
    }
  },
);
