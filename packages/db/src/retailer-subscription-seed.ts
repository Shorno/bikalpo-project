import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  provisionRetailerFreeSubscription,
  seedRetailerSubscriptionPlans,
} from "./retailer-subscription-provisioning";
import { retailerSubscriptionPlan, user } from "./schema";
import { DEFAULT_SUBSCRIPTION_PLANS } from "./retailer-subscription-policy";

export async function seedRetailerSubscriptions(dryRun = false) {
  const existingPlans = await db
    .select({ code: retailerSubscriptionPlan.code })
    .from(retailerSubscriptionPlan);
  const existingCount = DEFAULT_SUBSCRIPTION_PLANS.filter((plan) =>
    existingPlans.some((saved) => saved.code === plan.code),
  ).length;
  const plans = dryRun
    ? {
        created: DEFAULT_SUBSCRIPTION_PLANS.length - existingCount,
        existing: existingCount,
      }
    : await db.transaction(seedRetailerSubscriptionPlans);
  const owners = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "shop_owner"));
  const subscriptions = {
    created: 0,
    existing: 0,
    ineligible: 0,
    missing_application: 0,
  };
  for (const owner of owners) {
    const result = await db.transaction((tx) =>
      provisionRetailerFreeSubscription(tx, owner.id, "backfill", dryRun),
    );
    subscriptions[result]++;
  }
  return { dryRun, plans, subscriptions };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      JSON.stringify(
        await seedRetailerSubscriptions(process.argv.includes("--dry-run")),
      ),
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Subscription seed failed",
    );
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}
