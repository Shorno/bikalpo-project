# Retailer profile approval and KYC

Saving an approved retailer's registration profile must preserve the admin's
application status, reviewer and review date. Business category/nature, tax and
license numbers, contacts and location are editable profile fields; editing them
does not resubmit onboarding. Account approval and document verification are
separate states.

Previously, changing category/nature or tax/license fields reset the application
to `pending` and erased its review metadata, while the account stayed approved.
Even an ordinary contact save could trigger this when an empty optional field
normalized from `""` to `null`. Subscription eligibility required an approved
application and consequently returned “An approved retail shop owner account is
required.” The settings subscription query refreshes every minute, repeating the
error after the initial save.

For existing affected accounts, eligibility still requires an approved, unbanned
retail shop owner. A pending application with cleared review metadata is accepted
only when that registration predates an existing Free subscription provisioned
by approval or backfill. This historical term remains evidence after a paid
upgrade. This read does not approve applications or change stored review/KYC
records. Missing, rejected, ambiguous or newly submitted registrations and
unapproved/banned accounts remain ineligible.

Document comparison uses each document slot's URL, treating empty and missing
values consistently. Object key order is irrelevant. An actual document
addition, replacement or removal creates a pending KYC review; saving the same
documents again does not create another review.

The regression test exercises the real profile-save and subscription-read
handlers with database operations mocked, including the original error and
authorization exclusions:

```powershell
pnpm exec tsx --env-file=apps/server/.env --test packages/api/src/routers/retailer-profile-approval.test.ts
```
