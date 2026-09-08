import { and, eq, sql } from "drizzle-orm";
import type { db } from "./index";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  isEligibleSubscriptionAccount,
  validateSubscriptionCatalog,
} from "./retailer-subscription-policy";
import {
  retailerSubscription,
  retailerSubscriptionPlan,
  sellerApplication,
  user,
} from "./schema";

export type SubscriptionTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function lockSubscriptionCatalog(tx: SubscriptionTransaction) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(781079, 1)`);
}

export async function seedRetailerSubscriptionPlans(
  tx: SubscriptionTransaction,
) {
  await lockSubscriptionCatalog(tx);
  let created = 0;
  for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
    const existing = await tx.query.retailerSubscriptionPlan.findFirst({
      where: eq(retailerSubscriptionPlan.code, plan.code),
    });
    if (existing) continue;
    const [inserted] = await tx
      .insert(retailerSubscriptionPlan)
      .values({ ...plan })
      .returning();
    if (inserted) created++;
  }
  validateSubscriptionCatalog(await tx.select().from(retailerSubscriptionPlan));
  return { created, existing: DEFAULT_SUBSCRIPTION_PLANS.length - created };
}

/** Shared account/application eligibility; writers request the per-owner row lock. */
export async function retailerSubscriptionEligibility(
  tx: SubscriptionTransaction,
  shopId: string,
  lock = false,
) {
  const query = tx.select().from(user).where(eq(user.id, shopId));
  const [owner] = lock ? await query.for("update") : await query;
  if (!owner || !isEligibleSubscriptionAccount(owner))
    return "ineligible" as const;
  const applications = await tx.query.sellerApplication.findMany({
    where: and(
      eq(sellerApplication.userId, shopId),
      eq(sellerApplication.status, "approved"),
      eq(sellerApplication.businessType, "retail"),
    ),
    limit: 2,
  });
  if (applications.length === 0) return "missing_application" as const;
  if (applications.length > 1) return "ambiguous_application" as const;
  return "eligible" as const;
}

/** Provisioning and purchase writers share the same per-owner transaction lock. */
export async function provisionRetailerFreeSubscription(
  tx: SubscriptionTransaction,
  shopId: string,
  source: "approval" | "backfill",
  dryRun = false,
) {
  const eligibility = await retailerSubscriptionEligibility(tx, shopId, true);
  if (eligibility !== "eligible") return eligibility;
  const current = await tx.query.retailerSubscription.findFirst({
    where: and(
      eq(retailerSubscription.shopId, shopId),
      eq(retailerSubscription.isCurrent, true),
    ),
  });
  if (current) return "existing" as const;
  if (dryRun) return "created" as const;
  const plan = await tx.query.retailerSubscriptionPlan.findFirst({
    where: eq(retailerSubscriptionPlan.code, "free"),
  });
  if (!plan || !plan.active)
    throw new Error(
      "Seed the Free subscription plan before approving retailers.",
    );
  await tx.insert(retailerSubscription).values({
    shopId,
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    durationMonths: null,
    amountMinor: 0,
    startsAt: new Date(),
    source,
  });
  return "created" as const;
}
