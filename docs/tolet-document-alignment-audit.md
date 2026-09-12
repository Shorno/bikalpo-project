# To-Let document alignment — 12 September 2026

This is an implementation audit, not a declaration that every PDF requirement is production-ready. Existing unrelated work was preserved. No commit, push, force push or deployment was performed in this pass.

## Sources and precedence

The 16 local To-Let documents were inventoried, text/comments extracted, duplicate versions compared, and the PDF layouts rendered for inspection. Evidence and source hashes are in `.impeccable/review/tolet-doc-audit/manifest.json`.

| Sources in Downloads | Scope checked |
| --- | --- |
| CONSUMER.docx, CONSUMER.pdf, tolet booking.docx | Consumer listing/booking details, Leave, Comment, rental visibility, Alert field order |
| all docs.docx; SERIES CREATION SYSTEM.docx; SERIES CREATION SYSTEM (1).docx; SERIES CREATION SYSTEM (2).docx | Consolidated property, unit, listing, booking and rental lifecycle developer notes |
| SERIES CREATION SYSTEM (1).pdf | Property account/registration overview |
| SERIES CREATION SYSTEM (2).pdf | Owner unit details, facilities, tenant and payment history |
| SERIES CREATION SYSTEM.pdf; SERIES CREATION SYSTEM (3).pdf; SERIES CREATION SYSTEM (8).pdf | Landing page sections and cards; duplicate/version differences |
| SERIES CREATION SYSTEM (4).pdf | Property registration, location, contact verification |
| SERIES CREATION SYSTEM (5).pdf | Owner property/QR presentation |
| SERIES CREATION SYSTEM (6).pdf | Create-post steps and data order |
| SERIES CREATION SYSTEM (7).pdf | Booking/contract/monthly-rent pipeline |

Latest explicit user decisions override older document examples: keep shared site navigation/footer; Alert matching uses category, location and minimum size only; advanced Maps and public-review activation remain deferred. A sample name, ID, price or phone is not production seed data.

The requested `grill-with-docs` skill points to `/grilling` and `/domain-modeling`, which are unavailable locally. The fallback is this source-to-code audit with explicit decisions, domain terms and open questions. Impeccable was used for existing-style, responsive and accessibility QA, not a new redesign.

## Changes implemented in this pass

| Area | Implementation and evidence |
| --- | --- |
| Categories | Shared backend/frontend rental types now include Family Sublet, Bachelor Sublet and Factory. Existing Sublet/Warehouse values remain compatible. Room-field capabilities use the same source. |
| Listing form | Step 1 places rent/charges before availability; Step 4 is Contact with separately named pre-contract price-visibility controls. Mobile step navigation has descriptive accessible labels. |
| Detail order | Owner Unit Information follows the documented paired fields, description, availability and listing status. Extra existing address/bedroom information remains in a secondary section, not removed. Consumer booking overview follows the document order. |
| Facilities | Availability and rent inclusion are separate. Available + Excluded is valid. Unavailable cannot be submitted as Included. Legacy missing inclusion is shown as Not recorded, not guessed. Public/owner details and new booking snapshots carry this data. |
| 360° tour | Optional hosted HTTP(S) tour link is saved with the listing and shown on relevant details. It is distinct from video. This is not a native panorama uploader or an embedded 360° renderer. |
| Alert / Leave | Dashboard and Leave use one shared form, preserving the PDF's Category/Floor, Division/District, Thana/Area, Size/Balcony, Bedrooms/Bathrooms order. Cascades clear stale child locations. Existing free-form locations remain supported. Leave succeeds separately before one alert save; no silently discarded second submission. |
| Property verification | Removed client-asserted six-digit verification. Server-bound, expiring, one-use proof; persistent attempts/resend limits; draft/phone-change safety. Different property contact does not change login identity. See the production blocker below. |
| Rent safety | Future move-in does not generate early rent; real calendar/month validation, persistent wrong-OTP cooldown, atomic Paid transition and replay protection. Completing an old contract cannot vacate a new tenancy/reservation. |
| Owner payment history | Owner-only unit-wide history across current/previous contracts, including uncharged vacancy gaps, six documented columns and 12-month pagination. History remains visible without a current contract. Tenant ID is the actual account ID; booking reference is separate. |

## Approved database change

Only these additions were explicitly approved and applied to the configured database:

- `tolet_unit_listing.facility_inclusions` — nullable JSONB.
- `tolet_unit_listing.tour_url` — nullable text.

Migration: `packages/db/src/migrations/0083_tolet_facility_inclusions_tour.sql`. The targeted script `packages/db/src/apply-tolet-facility-migration.ts` applied only that idempotent SQL and verified both columns. No existing rows were rewritten or deleted. The full pending migration chain was not run and no migration-history row was fabricated. The normal deployment runner can later execute this idempotent migration in sequence.

Public reviews SQL in `docs/pending/tolet-public-reviews.sql` was **not applied**. Booking snapshot additions use the existing JSONB field; OTP counters use the existing verification table. No additional schema change was approved or applied.

## Verification and its limits

- Focused combined tests: 58 passed; both production-only tests also passed in a separate production-environment run (60 total).
- Three PostgreSQL integration checks passed for property proof, rent safety and owner isolation. They use connection-private TEMP tables, with no real account/property/payment changes.
- Real UI components and local shared CSS were tested in isolated 1440px and 390px fixtures: Alert field order/cascades/validation/Leave single-save, OTP states, listing steps, distinct inclusion states and owner payment-table scrolling. These use mocked sessions and mutations, not real signed-in end-to-end writes.
- Local landing returned HTTP 200 at desktop/mobile sizes with no horizontal overflow or browser runtime errors. An isolated anonymous browser opening `/to-let/listings/LST-100003` reached `/login?redirect=%2Fto-let%2Flistings%2FLST-100003`; the detail source authenticates before fetching its full detail payload.
- Manual UI detector reported no findings on the root-edited form/detail surfaces. Full repository TypeScript checks are not green: existing shared React type conflicts and unrelated API/test errors remain. Changed-file diagnostics were reviewed separately.
- No physical-phone touch/SMS test, real tenant/owner production smoke test, or production scheduler verification is claimed.

## Still open — do not mark all PDFs done

1. **Production property OTP delivery:** the repository's auth callback logs/stores OTP but has no real SMS adapter. Property request, verification and proof consumption now fail closed outside explicit development. Therefore production property registration/edit cannot complete until a real provider is integrated and tested. Development codes explicitly state no SMS was sent. Shared development login-OTP retrieval is disabled outside development; normal login handlers were not rewritten.
2. **Public reviews:** schema activation and publication of real public reviews remain deferred by the user; existing private tenant comments are not made public.
3. **Advanced Maps:** radius/nearby/commute intelligence remains deferred. Do not represent UI-only controls as a backend calculation.
4. **Agreement image:** document mentions an agreement image, but private upload/storage, permitted readers, retention and another schema change need a defined decision. Not implemented under approval for the two listing fields only.
5. **Public versus QR-only:** documents conflict about publish visibility. Existing explicit Public / QR Only choice is preserved pending client confirmation.
6. **Tenant public code / Relevant Cart:** no stable `USR-*` public identity exists; actual owner-authorized account ID is shown. The document's Relevant Cart heading has no implementable interaction rules; no invented workflow was added.
7. **Deployment verification:** hourly rental reconciliation already exists in production server startup; an always-running process and month-boundary/two-account smoke test still need verification. Rent bookkeeping is not an online payment gateway; no fee/proration policy was invented.
8. **Privacy boundary:** sign-in is enforced on the full-details page. Existing public listing API/card fields remain public marketplace data; this page gate is not a promise that every listing field is secret.
9. **Shared site placeholders and device QA:** official social/app/contact values remain a shared-footer decision, and physical-device touch testing remains outstanding.

## Domain terms / decisions

- Property: owner's registered building and main address; Unit: separately rentable space, optionally with its own address.
- Listing: current rental offer, price visibility, facilities inclusion and tour link; booking snapshot: historical offer captured at request time, not overwritten by later edits.
- Available: facility exists; Included: its cost is included in rent; missing historical inclusion: unknown.
- Alert preference: saved search; notification: a matched listing. Only category, location and minimum size constrain matches at the user's request.
- Leave: tenant starts departure and may create a next-rental alert. Existing contract end date governs access; no new notice-period interpretation was invented.
- Pending/Paid: owner-confirmed monthly rent record, with tenant submission of the owner/month OTP. Vacant: no recorded rental contract, not a zero-priced paid receipt.

Detailed implementation notes: `tolet-property-phone-verification.md`, `tolet-rental-payment-safety.md`, `tolet-alert-notifications.md`.
