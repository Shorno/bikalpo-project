import assert from "node:assert/strict";
import test from "node:test";
import {
  type UserPlanCatalogEntry,
  userSubscriptionPlanName,
} from "./user-subscription-plan";

const catalog: UserPlanCatalogEntry[] = [
  {
    id: "free-id",
    code: "free",
    name: "Free",
    durationMonths: null,
    active: true,
  },
  {
    id: "monthly-id",
    code: "monthly",
    name: "Monthly",
    durationMonths: 1,
    active: true,
  },
  {
    id: "six-id",
    code: "six_monthly",
    name: "Six-monthly",
    durationMonths: 6,
    active: true,
  },
  {
    id: "yearly-id",
    code: "yearly",
    name: "Yearly",
    durationMonths: 12,
    active: true,
  },
];

test("legacy plans use the admin catalog's current names and requested durations", () => {
  for (const [selectedPlan, expected] of [
    ["free_trial", "Free Trial"],
    ["free", "Free"],
    ["monthly", "Monthly"],
    ["starter", "Six-monthly"],
    ["growth", "Yearly"],
    ["six_monthly", "Six-monthly"],
    ["yearly", "Yearly"],
    [" Starter ", "Six-monthly"],
    ["Free Trial", "Free Trial"],
  ]) {
    assert.equal(userSubscriptionPlanName(catalog, { selectedPlan }), expected);
  }
  const renamed = catalog.map((plan) => ({
    ...plan,
    name: `${plan.name} renamed`,
  }));
  assert.equal(
    userSubscriptionPlanName(renamed, { selectedPlan: "starter" }),
    "Six-monthly renamed",
  );
  assert.equal(
    userSubscriptionPlanName(renamed, { selectedPlan: "growth" }),
    "Yearly renamed",
  );
});

test("an existing subscription takes priority over a legacy application preference", () => {
  assert.equal(
    userSubscriptionPlanName(catalog, {
      selectedPlan: "growth",
      subscription: {
        planId: "monthly-id",
        planCode: "monthly",
        planName: "Old monthly name",
      },
    }),
    "Monthly",
  );
  assert.equal(
    userSubscriptionPlanName(catalog, {
      selectedPlan: "starter",
      trialFallback: true,
      subscription: {
        planId: "free-id",
        planCode: "free",
        planName: "Old free name",
      },
    }),
    "Free",
  );
});

test("legacy selections use the active replacement offer while existing subscriptions retain their plan", () => {
  const replacement = [
    ...catalog.map((plan) =>
      plan.durationMonths === 6 ? { ...plan, active: false } : plan,
    ),
    {
      id: "offer-id",
      code: "six_month_offer",
      name: "Six Month Offer",
      durationMonths: 6,
      active: true,
    },
  ];
  assert.equal(
    userSubscriptionPlanName(replacement, { selectedPlan: "starter" }),
    "Six Month Offer",
  );
  assert.equal(
    userSubscriptionPlanName(replacement, { selectedPlan: "six-id" }),
    "Six Month Offer",
  );
  assert.equal(
    userSubscriptionPlanName(replacement, { selectedPlan: "six_month_offer" }),
    "Six Month Offer",
  );
  assert.equal(
    userSubscriptionPlanName(replacement, {
      subscription: {
        planId: "six-id",
        planCode: "six_monthly",
        planName: "Six-monthly",
      },
    }),
    "Six-monthly",
  );
});

test("missing, blank, malformed and unrecognized selections fall back to free or trial", () => {
  for (const selectedPlan of [
    undefined,
    null,
    "",
    " ",
    "unknown",
    {},
    "constructor",
  ]) {
    assert.equal(userSubscriptionPlanName(catalog, { selectedPlan }), "Free");
    assert.equal(
      userSubscriptionPlanName(catalog, { selectedPlan, trialFallback: true }),
      "Free Trial",
    );
  }
  const renamed = catalog.map((plan) =>
    plan.code === "free" ? { ...plan, name: "Community Free" } : plan,
  );
  assert.equal(userSubscriptionPlanName(renamed, {}), "Community Free");
  assert.equal(userSubscriptionPlanName([], {}), "Free");
  assert.equal(
    userSubscriptionPlanName([], {
      selectedPlan: "starter",
      trialFallback: true,
    }),
    "Free Trial",
  );
});

test("a saved subscription name survives missing catalog metadata", () => {
  assert.equal(
    userSubscriptionPlanName([], {
      subscription: {
        planId: "legacy-id",
        planCode: "legacy",
        planName: "Legacy Annual",
      },
    }),
    "Legacy Annual",
  );
});
