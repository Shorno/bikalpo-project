import { and, eq, sql } from "drizzle-orm";
import type { db } from "./index";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  isEligibleRetailer,
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

/** Caller transaction owns the shop lock, so provisioning and purchases cannot race. */
export async function provisionRetailerFreeSubscription(
  tx: SubscriptionTransaction,
  shopId: string,
  source: "approval" | "backfill",
  dryRun = false,
) {
  const [owner] = await tx
    .select()
    .from(user)
    .where(eq(user.id, shopId))
    .for("update");
  if (!owner || !isEligibleRetailer(owner)) return "ineligible" as const;
  const application = await tx.query.sellerApplication.findFirst({
    where: and(
      eq(sellerApplication.userId, shopId),
      eq(sellerApplication.status, "approved"),
      eq(sellerApplication.businessType, "retail"),
    ),
  });
  if (!application) return "missing_application" as const;
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
  await tx
    .insert(retailerSubscription)
    .values({
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
