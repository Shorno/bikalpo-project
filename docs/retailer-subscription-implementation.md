# Retailer dummy subscriptions

Implemented from the subscription request and `retailer-dummy-subscription-research.md`. The research document records pre-implementation observations, not current behavior.

## MVP defaults

The implementation uses the defaults announced when implementation began: Free has no expiry; Monthly costs BDT 1,000, Six-monthly BDT 4,800 total (800/month), and Yearly BDT 7,200 total (600/month). These are editable dummy prices, not a real billing integration. Admins manage them under **Packages → Retailer Subscriptions**. Existing landing-page marketing packages remain separate.

Approved retail owners receive Free. Longer active terms can be purchased immediately; active same/shorter-term purchases are blocked. After expiry, any offered paid term can be renewed from confirmation time. Upgrades forfeit unused time without refund, credit or carryover; the modal discloses this before confirmation. Auto Renewal is Off. For an active paid term, Next Billing Date is its expiry/renewal date; Free and expired terms are not scheduled. There is no automatic downgrade, real charge, or feature gating.

The profile and subscription modal retain exactly: Current Plan, Subscription Status, Plan Start Date, Expiry Date, Auto Renewal, Next Billing Date, Payment Status. The action is **View Subscription**. The shop banner and retailer-specific admin counts read persisted subscriptions. Admin user details show the purchased term rather than a registration preference.

## Deployment

Run from the repository root, with the existing server environment configured:

```powershell
pnpm --filter @bikalpo-project/db db:migrate
pnpm --filter @bikalpo-project/db db:seed-subscriptions --dry-run
pnpm --filter @bikalpo-project/db db:seed-subscriptions
```

Migration `0079_retailer_subscriptions` is additive. Dry-run `created` counts mean would-create. Seeding inserts missing stable plan codes and preserves existing admin edits. Backfill skips existing subscriptions, ineligible owners and accounts missing an owner-linked approved retail application. Free starts at provisioning time, not a fabricated registration date. The seed must run before new retailer approvals are accepted. No historical registration preference is converted into a paid purchase.

The development database migration and seed were applied during implementation: four plans and ten Free subscriptions created, six ineligible owners skipped. No paid subscriptions were fabricated for existing users. Subsequent runs should create nothing unless new eligible owners or missing default plans are present.

## Verification

Pure tests cover monthly discount ordering, calendar-month clamping in Bangladesh time, expiry boundaries, allowed upgrades and eligibility. Opt-in database integration exercises provisioning races, seed preservation and rollback, isolated purchase fixtures, payment retry, concurrent upgrades, stale quotes, bans, tenant isolation, renewals and admin edits. Temporary test records are deleted after each run.

```powershell
pnpm exec tsx --test packages/db/src/retailer-subscription-policy.test.ts
$env:RUN_RETAILER_SUBSCRIPTION_DB_TEST='1'
pnpm exec tsx --env-file=apps/server/.env --test packages/api/src/routers/retailer-subscription.integration.test.ts
```

The integration suite expects the four default offers to be seeded and active. Tests exercise fresh eligibility, transaction rollback, the owner/admin middleware and explicit read routing. No payment credentials are collected or stored. Backfill reports missing/ambiguous application owners, mismatched approval states and unknown registration preferences for review; ambiguous owners are skipped.

Implementation verification: 356 Node tests and 3 Bun tests passed; 16 opt-in database tests were skipped by the ordinary suite. The subscription database test passed separately against isolated fixtures. Web type checking reports only the existing React ref-type conflicts in `calendar.tsx`, `field.tsx` and `skeleton.tsx`. Browser verification was limited: the signed-in Test User lacks Settings access, so the modal was not visually verified.

If rollback is needed, disable the new entry points and retain the subscription/purchase history tables. Do not drop paid history or rerun approval/referral effects to repair a missing subscription.

## Standards

Parallel review of the feature against baseline `9476f9b8043a6b38dde5f52c8e85045dfd7ee483` found no hard documented-standard violations. Two heuristic findings were addressed: duplicated account/application eligibility checks now share `retailerSubscriptionEligibility`; the generic `isEligibleRetailer` predicate was renamed `isEligibleSubscriptionAccount` to avoid conflicting with the order-eligibility terminology in CONTEXT.md. The standards reviewer verified both fixes: **0 unresolved findings**.

## Spec

Three findings were addressed: backfill now reports anomalous application/preference records and rejects ambiguous owners; reads have explicit GET routing; stale-offer conflicts and dialog reopening refresh the current plan/options while preserving retry keys for ambiguous network failures. The spec reviewer verified all three fixes and found no unrequested scope: **0 unresolved findings**.

Review summary: Standards 2 observations resolved, no remaining issue; Spec 3 findings resolved, no remaining issue. Unrelated concurrent warehouse POS edits were excluded from the reviews and feature commits.
