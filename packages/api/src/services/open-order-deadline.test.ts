import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";
import { db } from "@bikalpo-project/db";
import { order } from "@bikalpo-project/db/schema";
import { isOpenOrderDeadlineAfter } from "./open-order-deadline";

test("open-order deadlines encode Date values through the timestamp column", () => {
  const now = new Date("2026-07-30T09:42:47.928Z");
  const query = db
    .select({ id: order.id })
    .from(order)
    .where(isOpenOrderDeadlineAfter(order.selectionExpiresAt, now))
    .toSQL();

  assert.equal(typeof query.params[0], "string");
  assert.equal(query.params[0], now.toISOString());
});
