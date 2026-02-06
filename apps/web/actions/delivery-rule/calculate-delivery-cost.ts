"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/config";
import { deliveryRule } from "@/db/schema/delivery-rule";

/**
 * Calculate delivery cost from rules: by area (optional) and order total weight (kg).
 * Picks the first matching active rule (area match or area null, weight in band).
 * Cost = baseCost + (perKgCost * totalWeightKg).
 */
export async function calculateDeliveryCost(
  totalWeightKg: number,
  area?: string | null,
): Promise<number> {
  const rules = await db.query.deliveryRule.findMany({
    where: eq(deliveryRule.isActive, true),
    orderBy: (r, { asc }) => [asc(r.sortOrder), asc(r.id)],
  });

  for (const rule of rules) {
    const areaMatch =
      rule.area == null ||
      rule.area === "" ||
      (area != null &&
        area !== "" &&
        rule.area.toLowerCase() === area.toLowerCase());
    if (!areaMatch) continue;

    const minKg = rule.minWeightKg != null ? Number(rule.minWeightKg) : 0;
    const maxKg =
      rule.maxWeightKg != null
        ? Number(rule.maxWeightKg)
        : Number.MAX_SAFE_INTEGER;
    if (totalWeightKg < minKg || totalWeightKg > maxKg) continue;

    const base = Number(rule.baseCost) || 0;
    const perKg = Number(rule.perKgCost) || 0;
    return Math.max(0, base + perKg * totalWeightKg);
  }

  return 0;
}
