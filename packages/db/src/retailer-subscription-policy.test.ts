import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  isEligibleSubscriptionAccount,
  subscriptionAction,
  subscriptionExpiry,
  subscriptionNextBillingAt,
  subscriptionStatus,
  validateSubscriptionCatalog,
} from "./retailer-subscription-policy";

test("longer paid plans cost less per month even when an intermediate offer is disabled", () => {
  const catalog = DEFAULT_SUBSCRIPTION_PLANS.map((p) => ({
    ...p,
    active: true,
  }));
  assert.doesNotThrow(() => validateSubscriptionCatalog(catalog));
  assert.throws(
    () =>
      validateSubscriptionCatalog(
        catalog.map((p) =>
          p.code === "yearly" ? { ...p, amountMinor: 960000 } : p,
        ),
      ),
    /lower effective/,
  );
  assert.throws(
    () =>
      validateSubscriptionCatalog([
        { durationMonths: 1, amountMinor: 1000, active: true },
        { durationMonths: 12, amountMinor: 12000, active: true },
      ]),
    /lower effective/,
  );
  assert.throws(
    () =>
      validateSubscriptionCatalog([
        ...catalog,
        { durationMonths: 1, amountMinor: 999, active: true },
      ]),
    /one active/,
  );
});

test("expiry uses calendar months and Bangladesh local dates at month end", () => {
  for (const [start, months, expected] of [
    ["2026-01-31T04:00:00Z", 1, "2026-02-28T04:00:00.000Z"],
    ["2024-01-31T04:00:00Z", 1, "2024-02-29T04:00:00.000Z"],
    ["2024-02-29T04:00:00Z", 12, "2025-02-28T04:00:00.000Z"],
    ["2026-08-30T20:30:00Z", 6, "2027-02-27T20:30:00.000Z"],
    ["2026-01-30T20:30:00Z", 1, "2026-02-27T20:30:00.000Z"],
  ] as const)
    assert.equal(
      subscriptionExpiry(new Date(start), months).toISOString(),
      expected,
    );
});

test("only upgrades are offered during active terms and expiry permits manual renewal", () => {
  const startsAt = new Date("2026-01-01Z"),
    expiresAt = new Date("2026-02-01Z");
  const current = { startsAt, expiresAt, durationMonths: 1 };
  assert.equal(subscriptionAction(current, 1, startsAt), null);
  assert.equal(subscriptionAction(current, 6, startsAt), "Upgrade");
  assert.equal(subscriptionAction(current, null, expiresAt), null);
  assert.equal(subscriptionAction(current, 1, expiresAt), "Renew");
  assert.equal(subscriptionStatus(current, expiresAt), "Expired");
  assert.equal(subscriptionStatus({ ...current, expiresAt: null }), "Active");
  assert.equal(subscriptionAction(null, 1), null);
});

test("active paid terms bill at expiry while free and expired terms are unscheduled", () => {
  const now = new Date("2026-09-08T06:00:00.000Z");
  const expiry = new Date("2026-10-08T06:00:00.000Z");

  assert.equal(
    subscriptionNextBillingAt(
      { durationMonths: 1, startsAt: now, expiresAt: expiry },
      now,
    ),
    expiry,
  );
  assert.equal(
    subscriptionNextBillingAt(
      { durationMonths: null, startsAt: now, expiresAt: null },
      now,
    ),
    null,
  );
  assert.equal(
    subscriptionNextBillingAt(
      {
        durationMonths: 1,
        startsAt: new Date("2026-08-08T06:00:00.000Z"),
        expiresAt: now,
      },
      now,
    ),
    null,
  );
});

test("eligibility excludes staff, warehouses, restaurants and currently banned owners", () => {
  const owner = {
    role: "shop_owner",
    businessType: "retail",
    sellerStatus: "approved",
    banned: false,
    banExpires: null,
  };
  assert.equal(isEligibleSubscriptionAccount(owner), true);
  for (const override of [
    { role: "shop_staff" },
    { role: "warehouse" },
    { businessType: "restaurant" },
    { sellerStatus: "disabled" },
    { banned: true },
  ])
    assert.equal(
      isEligibleSubscriptionAccount({ ...owner, ...override }),
      false,
    );
  assert.equal(
    isEligibleSubscriptionAccount({
      ...owner,
      banned: true,
      banExpires: new Date("2020-01-01"),
    }),
    true,
  );
});
