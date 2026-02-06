"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { deliveryRule } from "@/db/schema/delivery-rule";

export type UpdateDeliveryRuleInput = {
  id: number;
  name?: string;
  area?: string;
  minWeightKg?: string;
  maxWeightKg?: string;
  baseCost?: string;
  perKgCost?: string;
  isActive?: boolean;
  sortOrder?: number;
  note?: string;
};

export async function updateDeliveryRule(input: UpdateDeliveryRuleInput) {
  const { id, ...rest } = input;
  await db
    .update(deliveryRule)
    .set({
      ...rest,
      name: rest.name ?? null,
      area: rest.area ?? null,
      minWeightKg: rest.minWeightKg ?? null,
      maxWeightKg: rest.maxWeightKg ?? null,
      note: rest.note ?? null,
    })
    .where(eq(deliveryRule.id, id));

  revalidatePath("/dashboard/admin/delivery-rules");
}
