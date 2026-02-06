"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { deliveryRule } from "@/db/schema/delivery-rule";

export async function deleteDeliveryRule(id: number) {
  await db.delete(deliveryRule).where(eq(deliveryRule.id, id));
  revalidatePath("/dashboard/admin/delivery-rules");
}
