import { order } from "@bikalpo-project/db/schema";
import { gt } from "drizzle-orm";

type OpenOrderDeadlineColumn =
  | typeof order.broadcastExpiresAt
  | typeof order.selectionExpiresAt;

export function isOpenOrderDeadlineAfter(
  column: OpenOrderDeadlineColumn,
  now: Date,
) {
  return gt(column, now);
}
