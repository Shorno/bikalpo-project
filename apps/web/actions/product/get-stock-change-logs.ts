"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/config";
import { stockChangeLog } from "@/db/schema/stock-change-log";

export async function getStockChangeLogs(productId: number, limit = 50) {
  return await db.query.stockChangeLog.findMany({
    where: eq(stockChangeLog.productId, productId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit,
    columns: {
      id: true,
      changeType: true,
      quantity: true,
      reason: true,
      createdAt: true,
      createdById: true,
    },
    with: {
      createdBy: {
        columns: { name: true },
      },
    },
  });
}
