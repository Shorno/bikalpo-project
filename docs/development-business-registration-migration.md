# Development business registration migration

Existing development businesses predate the current registration form. Some have no application; others lack application numbers, Business Nature, Product Type, structured locations, or the separate application/KYC approval state. An approved account alone therefore does not satisfy the subscription eligibility check.

`pnpm db:migrate-business-registrations` previews a migration for every existing Shop Owner, Warehouse Owner, and account with a business application. Ordinary consumers, administrators, and staff are excluded. Multiple applications or conflicting portal roles stop the migration for explicit reconciliation.

The migration uses the current seller/warehouse input schemas, Business Nature routing, shared application field builder, Tolet location options, and retailer subscription eligibility/provisioning. It writes the approved registration and account projection together in one transaction. It does not replay referral rewards or subscription purchases.

## Commands

Run from the repository root with the development server environment available in `apps/server/.env`:

```powershell
pnpm db:migrate-business-registrations
pnpm db:migrate-business-registrations --rehearse
pnpm db:migrate-business-registrations --apply
pnpm db:migrate-business-registrations
```

Preview is read-only. Rehearsal runs the complete migration, validates the resulting records, then rolls the transaction back. Apply commits only after the same assertions pass. A final preview should report zero changes. Production mode is rejected.

The default development web origin is `http://bikalpo.localhost:3001`. Override it with `--web-origin=http://your-development-web-host:3001` when the local web server uses another host.

## Data handling

- Existing business identities, contact details, documents, slugs, and valid product-type selections are retained. Legacy category names map to active Product Types; otherwise existing inventory/catalog/category assignments supply evidence. An unmatched business receives an explicitly recorded development default.
- Missing applications receive unique current-format application numbers and the appropriate Shop Owner or Warehouse Owner path. Shop registration preferences become `free`; warehouse preferences become `free_trial`, matching the current form.
- Location names are normalized to the dropdown values, with missing thana/area inferred from the existing address and Tolet location data. Missing personal locations use the business location as a documented development sample. Missing business locations/coordinates use documented Dhaka test values.
- Missing required attachments reference `/dev-fixtures/registration-sample.svg`, visibly marked as development data and invalid for verification. Missing license numbers use `DEV-SAMPLE-...`. Missing registration phones use a non-dialable sample, without changing login phone numbers. Optional tax, banking, and demographic information is not invented.
- Registrations are approved, business account access is enabled, and KYC is marked verified for development testing with an explicit migration note. Existing review history is retained where already approved/verified. This is a development data operation, not a real identity/document verification.
- Existing account IDs, login identities, subscriptions, and commerce relationships are retained. Eligible retailers without a current subscription receive Free through the ordinary provisioning helper. Existing paid terms are asserted unchanged.

Before any writes, a snapshot is stored in the ignored `packages/api/.cache/registration-migration/` directory. It contains private business/contact data and must remain local. Migration notes record the source of sample fields; the snapshots preserve the original values for recovery.

The migration checks unchanged non-business users and login identities, one approved application per business, verified KYC, normal retailer subscription eligibility, preserved existing terms, and zero changes on an immediate second run. The subscription router keeps its normal approval checks; no exception for pending legacy registrations is needed.

## Applied development run — 2026-09-12

The rollback rehearsal and committed run both passed. The migration completed 23 registrations: 17 Shop Owners and 6 Warehouse Owners. It created 8 missing applications, approved 11 applications that were new/pending/rejected, completed 21 pending/missing development KYC records, and provisioned 7 missing Free subscriptions. A repeat preview reported zero changes.

Read-only calls through the real owner and admin routers verified all 23 approved registrations and verified KYC states, zero pending/rejected applications in the admin overview, and successful subscription reads for all 17 retailers. Shorno XYZ is `SELLER-2026-000001` with its existing Monthly plan and normal upgrade actions available. Original records and the verification report are retained in the local ignored snapshot directory.

The migration script has no TypeScript errors. The full API typecheck continues to report existing errors in other routers, tests, and schema files.
