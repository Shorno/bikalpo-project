"use server";

import { asc } from "drizzle-orm";
import { db } from "@/db/config";
import { deliveryRule } from "@/db/schema/delivery-rule";

export async function listDeliveryRules() {
  return await db.query.deliveryRule.findMany({
    orderBy: [asc(deliveryRule.sortOrder), asc(deliveryRule.id)],
  });
}
