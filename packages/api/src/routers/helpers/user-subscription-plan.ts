export type UserPlanCatalogEntry = {
  id: string;
  code: string;
  name: string;
  durationMonths: number | null;
  active: boolean;
};

type CurrentUserPlan = {
  planId: string;
  planCode: string;
  planName: string;
};

const legacyDurations = new Map<string, number>([
  ["monthly", 1],
  ["starter", 6],
  ["six_monthly", 6],
  ["growth", 12],
  ["yearly", 12],
]);

/** Resolve display names without assigning subscriptions or changing purchased terms. */
export function userSubscriptionPlanName(
  catalog: readonly UserPlanCatalogEntry[],
  account: {
    selectedPlan?: unknown;
    subscription?: CurrentUserPlan | null;
    trialFallback?: boolean;
  },
): string {
  const freeName =
    catalog.find((plan) => plan.code === "free" && plan.active)?.name || "Free";
  const fallback = account.trialFallback ? "Free Trial" : freeName;

  if (account.subscription) {
    const subscription = account.subscription;
    // Existing subscriptions retain their plan even after an offer is disabled.
    // Renaming that plan in admin is reflected here; the stored purchase stays intact.
    const plan =
      catalog.find((entry) => entry.id === subscription.planId) ??
      catalog.find((entry) => entry.code === subscription.planCode);
    return plan?.name || subscription.planName?.trim() || fallback;
  }

  const selected =
    typeof account.selectedPlan === "string" ? account.selectedPlan.trim() : "";
  const legacyCode = selected.toLowerCase().replace(/[\s-]+/g, "_");
  if (legacyCode === "free_trial") return "Free Trial";
  if (legacyCode === "free") return freeName;

  const selectedPlan = catalog.find(
    (plan) => plan.id === selected || plan.code === legacyCode,
  );
  // Starter and Growth are legacy names for the 6- and 12-month terms.
  // Resolve by duration so replacement offers and admin-renamed plans work too.
  const legacyDuration = legacyDurations.get(legacyCode);
  if (legacyDuration !== undefined) {
    return (
      catalog.find(
        (plan) => plan.active && plan.durationMonths === legacyDuration,
      )?.name || fallback
    );
  }
  if (selectedPlan?.active) return selectedPlan.name;
  if (selectedPlan) {
    return (
      catalog.find(
        (plan) =>
          plan.active && plan.durationMonths === selectedPlan.durationMonths,
      )?.name || fallback
    );
  }
  return fallback;
}
