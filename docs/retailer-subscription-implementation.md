# Retailer dummy subscriptions

Implemented from the subscription request and `retailer-dummy-subscription-research.md`. The research document records pre-implementation observations, not current behavior.

## MVP defaults

The implementation uses the defaults announced when implementation began: Free has no expiry; Monthly costs BDT 1,000, Six-monthly BDT 4,800 total (800/month), and Yearly BDT 7,200 total (600/month). These are editable dummy prices, not a real billing integration. Admins manage them under **Packages → Retailer Subscriptions**. Existing landing-page marketing packages remain separate.

Approved retail owners receive Free. Longer active terms can be purchased immediately; active same/shorter-term purchases are blocked. After expiry, any offered paid term can be renewed from confirmation time. Upgrades forfeit unused time without refund, credit or carryover; the modal discloses this before confirmation. Auto Renewal is Off and Next Billing Date is Not scheduled. There is no automatic downgrade, real charge, or feature gating.

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

The integration suite expects the four default offers to be seeded and active. Handler-level tests exercise fresh eligibility and transactional behavior; route access uses the existing owner/admin middleware. No payment credentials are collected or stored.

If rollback is needed, disable the new entry points and retain the subscription/purchase history tables. Do not drop paid history or rerun approval/referral effects to repair a missing subscription.
