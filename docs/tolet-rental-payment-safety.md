# To-Let rent payment and lifecycle safety

## Sources and preserved decisions

Reviewed CONSUMER.pdf pages 2–4 (Leave, Comment, rent visibility and payment
history notes), SERIES CREATION SYSTEM (7).pdf pages 2–3, and the Pipeline
section of SERIES CREATION SYSTEM (2).docx.

- This is owner-confirmed rent bookkeeping, not a payment gateway. The owner
  receives money separately and shares a contract/month-specific OTP.
- New contracts use the first day of each month as their rent due day. Existing
  contract due-day values are preserved. No proration or extra fee policy is added.
- A contract signed before its start date produces no payment rows until move-in.
  From move-in, the existing whole-month amount rule is preserved.
- Only the contract tenant can verify a pending payment; owners can see eligible
  pending OTPs but cannot mark their own receipt paid through the tenant endpoint.
- Only active/leaving contracts within their date window expose pending OTPs.
- Leave continues to use the existing contract end date in Asia/Dhaka. The
  document's ambiguous "current period" wording is not converted into a new
  notice-period rule. See `tolet-leave-comment.md`.
- Public community reviews and advanced Maps remain deferred separately.

## Fixes

1. Calendar-date validation rejects impossible dates and non-month-start cycles.
2. Future same-month move-in no longer generates rent rows early.
3. Payment verification locks the current contract and payment row, rechecks
   tenant/status/date eligibility, and conditionally writes Paid only once.
4. Five incorrect attempts lock that contract/month for a 15-minute cooldown.
   Counts persist in the existing shared `verification` table under a dedicated
   hashed namespace. No schema migration is required. The API transaction commits
   failures before returning a user-facing error, so rollback cannot erase attempts.
5. OTP comparison uses a timing-safe check; successful verification clears failures.
6. Completion locks the unit first, then rereads the current contract. An extension
   or a completed historical snapshot cannot vacate an unrelated current tenancy.
   Only an occupied unit without another active/leaving contract becomes vacant;
   booked/inactive owner states are preserved.
7. Rental details refresh the unit state after reconciliation so the response does
   not report the old occupied state after successful completion.

## Verification

- `bun test packages/api/src/services/tolet-rental-lifecycle.test.ts packages/api/src/services/tolet-rent-payment.test.ts packages/api/src/services/tolet-rental-completion.test.ts`: 23 passing tests.
- `TOLET_RENTAL_DB_TEST=1` enables `tolet-rental-safety.integration.test.ts`: one
  passing PostgreSQL integration test for actual query filtering, unrelated/owner
  denial, lockout, paid replay, receiver persistence and stale-contract completion.
- The integration test uses four connection-private TEMP tables and rolls back.
  It copies no application rows, calls no public identity sequences and applies no
  schema migrations. No actual tenant payment or unit status was changed.
- Full API TypeScript checking still reports existing errors in unrelated routers
  and integration tests; no errors were reported in these changed payment files.

## Deployment still to verify

The server already starts `processToLetRentalLifecycle` once at production startup
and repeats hourly (`apps/server/src/index.ts`). Local development intentionally
does not run the background writer against a potentially shared database.

The reconciler also runs on contract access, so eligible months are backfilled and
expired tenant access is denied without waiting for the timer. The production
deployment still needs a two-account smoke test, month-boundary/log verification,
and confirmation that an always-running server process owns the hourly timer.
This code audit does not claim a payment gateway, SMS OTP delivery, proration,
automatic fee invoicing, or deployed scheduler success.

## Glossary

- **Contract:** accepted booking linked to owner, tenant, unit, dates and rent terms.
- **Cycle month:** first-day date identifying one contractual monthly rent record.
- **Pending:** no successful tenant submission of the owner's monthly OTP.
- **Paid:** receiver reference and successful OTP verification time are recorded.
- **Leaving:** tenant requested departure but retains access through contract end.
- **Completed:** rental is historical; private tenant details access has ended.

## Owner unit-wide payment history

The owner Unit Details panel now reads a dedicated owner-only history endpoint.
It remains available without a current booking/contract and covers previous and
current contracts for the same unit and owner account. The table preserves the
document's column order: Month, Tenant ID, Tenant Name, Rent, OTP, Payment. Rows
are chronological within each 12-month page; older/newer pages remain accessible.

Tenant ID is the actual linked authentication-account ID. There is no public
`USR-*` consumer identifier in the present schema, so no identifier is fabricated
from a booking number. `BKG-*` remains a separate booking reference. Rental
agreement image upload is explicitly unavailable; its storage field was not added
under the separate facility/tour migration approval.

History begins with this owner's first started contract. Full-month gaps display
Vacant/no charge; the unfinished current month without a started contract displays
No current tenant. These descriptions reflect recorded contracts, not independently
verified physical occupancy. No vacancy charge, zero-valued invoice, proration,
or rental payment is written by the read-only endpoint. Missing due-cycle rows are
derived as Pending from existing contract terms and labeled Awaiting cycle record.
Persisted payment amount/reference/status always wins over that projection.

Both property ownership and the historical contract owner are checked. Tenants,
other owners, and users with only a property/unit URL cannot read historical tenant
data. Paid/completed/expired contracts do not expose a usable pending OTP. Client
query keys include the signed-in owner account to prevent cross-account cache reuse.

Focused history verification: six unit tests and one PostgreSQL TEMP-table test
cover prior/current tenants, vacancy gaps, actual IDs, PDF row order, pagination,
stored amounts, expired OTP redaction, tenant/other-owner denial, property-year
mismatch, and absence of writes from the read-only history endpoint.
