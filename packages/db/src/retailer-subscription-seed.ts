import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  provisionRetailerFreeSubscription,
  seedRetailerSubscriptionPlans,
} from "./retailer-subscription-provisioning";
import { retailerSubscriptionPlan, sellerApplication, user } from "./schema";
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
    .select({
      id: user.id,
      businessType: user.businessType,
      sellerStatus: user.sellerStatus,
    })
    .from(user)
    .where(eq(user.role, "shop_owner"));
  const subscriptions = {
    created: 0,
    existing: 0,
    ineligible: 0,
    missing_application: 0,
    ambiguous_application: 0,
  };
  const anomalies = {
    missingApplicationOwnerIds: [] as string[],
    ambiguousApplicationOwnerIds: [] as string[],
    mismatchedApprovalOwnerIds: [] as string[],
    unknownPreferenceOwnerIds: [] as string[],
  };
  const knownPreferences = new Set([
    "free",
    "free_trial",
    "starter",
    "growth",
    "monthly",
    "six_monthly",
    "yearly",
  ]);
  for (const owner of owners) {
    const applications = await db
      .select({
        status: sellerApplication.status,
        businessType: sellerApplication.businessType,
        preference: sellerApplication.selectedPlan,
      })
      .from(sellerApplication)
      .where(eq(sellerApplication.userId, owner.id));
    if (
      applications.some(
        (app) => app.preference && !knownPreferences.has(app.preference),
      )
    )
      anomalies.unknownPreferenceOwnerIds.push(owner.id);
    if (
      owner.businessType === "retail" &&
      (owner.sellerStatus === "approved") !==
        applications.some(
          (app) => app.status === "approved" && app.businessType === "retail",
        )
    )
      anomalies.mismatchedApprovalOwnerIds.push(owner.id);
    const result = await db.transaction((tx) =>
      provisionRetailerFreeSubscription(tx, owner.id, "backfill", dryRun),
    );
    subscriptions[result]++;
    if (result === "missing_application")
      anomalies.missingApplicationOwnerIds.push(owner.id);
    if (result === "ambiguous_application")
      anomalies.ambiguousApplicationOwnerIds.push(owner.id);
  }
  return { dryRun, plans, subscriptions, anomalies };
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
