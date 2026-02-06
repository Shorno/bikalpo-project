"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/config";
import { deliveryRule } from "@/db/schema/delivery-rule";

export type CreateDeliveryRuleInput = {
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

export async function createDeliveryRule(input: CreateDeliveryRuleInput) {
  const [created] = await db
    .insert(deliveryRule)
    .values({
      name: input.name ?? null,
      area: input.area ?? null,
      minWeightKg: input.minWeightKg ?? null,
      maxWeightKg: input.maxWeightKg ?? null,
      baseCost: input.baseCost ?? "0",
      perKgCost: input.perKgCost ?? "0",
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      note: input.note ?? null,
    })
    .returning();

  revalidatePath("/dashboard/admin/delivery-rules");
  return created;
}
