# RayhanDev Quick Handoff

Last updated: 2026-07-22

## Current status

M1 Property/Unit management, M2 Listing publishing, M3 Booking Request, and the
M4 owner/tenant rental lifecycle are implemented locally.

Included now:

- Consumer-only property ownership; there is no separate Property Account login or admin approval.
- Four-step Property Registration with contact OTP, photos, building details, facilities, review, and agreements.
- My Properties list, property details, and property edit.
- Reusable physical Units: create, view, edit, and archive while vacant.
- Permanent public IDs such as `PR-2026-100001` and `UNT-100001`.
- Permanent private `qrToken` stored for the later public QR flow.
- Owner isolation on every API query and mutation.
- A blocked property keeps its ID/history but cannot be edited or receive unit changes.
- A Vacant Unit can create one open Listing, save a draft, publish, edit,
  unpublish, and publish again.
- Listing visibility can be `Public` or `QR Only`.
- The permanent Property QR is real and downloadable. It always opens the
  Property QR page.
- Public listings appear immediately on `/to-let`; QR Only listings are hidden
  there and only appear through the Property QR page.
- Visitors can Call or WhatsApp the verified Property contact.
- A signed-in Consumer can send a real Request Booking from an active Public
  Listing.
- Consumers can track Pending, Accepted, Rejected, and Cancelled requests in My
  Booking To-lets and cancel a Pending request.
- The Property owner can review, Accept, or Reject requests from the Unit
  Details page.
- Accept runs atomically: the request becomes Accepted, the Unit becomes
  `BOOKED`, the Listing becomes `CLOSED`, and competing Pending requests are
  rejected.
- The owner can activate an accepted rental Contract, which links the tenant and
  changes the Unit to `OCCUPIED`.
- Owners control which Listing price fields visitors see before Contract
  activation. Contract participants see the full agreed price snapshot.
- Monthly rent OTP, payment confirmation, Leave + saved Alert, and verified
  rental comments are connected to real local API/database records.

The existing legacy public `/to-let` feature was not replaced or changed.

## Routes

| Route | Purpose | Status |
| --- | --- | --- |
| `/to-let` | Legacy listings plus active owner-published Public listings | M2 complete |
| `/to-let/listings/[listingCode]` | Active Public Unit details and Request Booking | M3 complete |
| `/to-let/qr/[qrToken]` | Permanent Property QR page; Public and QR Only listings | M2 complete |
| `/account/to-let` | Booking/rental history, status tabs, and saved Alert form | M4 complete |
| `/account/to-let/bookings/[bookingCode]` | Contract, payments, Leave/Alert, and comments | M4 complete |
| `/account/to-let/properties` | Owned property list | M1 complete |
| `/account/to-let/properties/new` | Four-step property registration | M1 complete |
| `/account/to-let/properties/[propertyCode]` | Property details and units | M1 complete |
| `/account/to-let/properties/[propertyCode]/edit` | Edit property | M1 complete |
| `/account/to-let/properties/[propertyCode]/units/new` | Create physical unit | M1 complete |
| `/account/to-let/properties/[propertyCode]/units/[unitCode]` | Unit details/archive | M1 complete |
| `/account/to-let/properties/[propertyCode]/units/[unitCode]/edit` | Edit physical unit | M1 complete |
| `/account/to-let/properties/[propertyCode]/units/[unitCode]/listing` | Create/manage/publish Unit listing | M2 complete |

All `/account` routes require login.

## File log

### Navigation and account entry points

| File | What changed |
| --- | --- |
| `apps/web/components/layout/navbar.tsx` | Existing desktop To-Let navigation entry. |
| `apps/web/components/layout/mobile-menu.tsx` | Existing mobile To-Let navigation entry. |
| `apps/web/components/account/account-sidebar.tsx` | Keeps Booking exact-matched and adds a separate My Properties item. |
| `apps/web/components/shop/account-overview-client.tsx` | Dashboard card links directly to My Properties, not Booking. |
| `apps/web/app/(public)/account/to-let/page.tsx` | Real My Booking To-lets route; remains separate from property management. |
| `apps/web/app/(auth)/login/client.tsx` | Safely returns Consumers to the requested same-origin page after login. |

### Property and unit pages

| File | What changed |
| --- | --- |
| `apps/web/app/(public)/account/to-let/properties/page.tsx` | Property list route. |
| `apps/web/app/(public)/account/to-let/properties/new/page.tsx` | Registration route. |
| `apps/web/app/(public)/account/to-let/properties/[propertyCode]/page.tsx` | Property details route. |
| `apps/web/app/(public)/account/to-let/properties/[propertyCode]/edit/page.tsx` | Property edit route. |
| `apps/web/app/(public)/account/to-let/properties/[propertyCode]/units/new/page.tsx` | Unit create route. |
| `apps/web/app/(public)/account/to-let/properties/[propertyCode]/units/[unitCode]/page.tsx` | Unit details route. |
| `apps/web/app/(public)/account/to-let/properties/[propertyCode]/units/[unitCode]/edit/page.tsx` | Unit edit route. |
| `apps/web/app/(public)/account/to-let/properties/[propertyCode]/units/[unitCode]/listing/page.tsx` | Unit listing create/manage route. |
| `apps/web/app/(public)/to-let/page.tsx` | Public To-Let landing: hero search, real feed snapshot, rental types, filters, listing discovery, location preview, journey, review roadmap, and owner CTA. |
| `apps/web/app/(public)/to-let/listings/[listingCode]/page.tsx` | Public listing details, pricing, Request Booking, Call, and WhatsApp. |
| `apps/web/app/(public)/to-let/qr/[qrToken]/page.tsx` | No-index Property QR page with active Public and QR Only listings. |

### Property and unit UI

| File | What changed |
| --- | --- |
| `apps/web/components/features/to-let/property/my-properties-client.tsx` | Loads list/empty/error states. |
| `apps/web/components/features/to-let/property/property-card.tsx` | Property summary card. |
| `apps/web/components/features/to-let/property/property-details-client.tsx` | Property, facilities, capacity, QR status, and units view. |
| `apps/web/components/features/to-let/property/property-edit-form.tsx` | Full property edit with phone re-verification and Included/Excluded facility controls. |
| `apps/web/components/features/to-let/property/property-phone-verification.tsx` | Local development automatically verifies temporary/test numbers without an OTP round-trip; production keeps strict Bangladesh-number validation and manual Better Auth OTP. |
| `apps/web/components/features/to-let/property/property-qr-card.tsx` | Locally generated permanent QR, download, and open-page actions. |
| `apps/web/components/features/to-let/property/property-registration-wizard.tsx` | Four registration steps. Step 1 has no image upload; Step 2 uses Included/Excluded facility controls; Step 3 keeps media and phone verification. Front Image is also saved as the cover. |
| `apps/web/components/features/to-let/property/property-ui.tsx` | Shared headers, status badges, loading, and error UI. |
| `apps/web/components/features/to-let/property/types.ts` | Client view types and labels. |
| `apps/web/components/features/to-let/property/unit-card.tsx` | Unit summary card with direct safe Remove Unit confirmation for Vacant Units. |
| `apps/web/components/features/to-let/property/unit-details-client.tsx` | Owner Unit Details uses the client-approved full-page layout: image slider and full Unit summary in one hero, all actions together, then every details section rendered vertically. The top section buttons smooth-scroll to Unit Information, Facilities, Rent, Tenant, and Booking History and follow the active section. The older divided Listing-summary/gallery cards and hidden tab panels were removed. |
| `apps/web/components/features/to-let/property/unit-form.tsx` | Create/edit Unit; size input shows an `sq ft` suffix while keeping a numeric value, Furnished uses Included/Excluded, `0` means ground, and negatives mean basement. |
| `apps/web/components/features/to-let/property/listing-form.tsx` | Document-aligned five-step Create/Manage Listing wizard: Unit identity/pricing, physical details, facilities/media, verified contact/visibility, review/publish, and post-publish actions. |
| `apps/web/components/features/to-let/property/included-excluded-buttons.tsx` | Reusable compact two-state Included/Excluded control. |
| `apps/web/components/features/to-let/listing-image-carousel.tsx` | Accessible 1–5 photo carousel with reduced-motion support and pause/resume control. |
| `apps/web/components/features/to-let/public-unit-listing-card.tsx` | Shared Public/QR Listing card with availability, relevant Unit facts, rent, Call, Details, and WhatsApp fallback. |
| `apps/web/components/features/to-let/booking/request-booking-dialog.tsx` | Login-aware Request Booking form with contact, move-in date, message, and idempotent submit. |
| `apps/web/components/features/to-let/booking/my-bookings-client.tsx` | Real request/rental cards, status tabs, cancellation, and standalone saved Alert form. |
| `apps/web/components/features/to-let/booking/booking-details-client.tsx` | Contract-aware rental details, OTP payment verification, Leave/Alert, and verified comments. |
| `apps/web/hooks/use-to-let-booking-api.ts` | Consumer and owner Booking queries/mutations plus scoped cache invalidation. |
| `apps/web/hooks/use-to-let-rental-api.ts` | Contract, payment OTP, Leave/Alert, and comment queries/mutations. |
| `apps/web/hooks/use-to-let-property-api.ts` | Property, Unit, and Listing queries/mutations with cache invalidation. |
| `apps/web/schema/to-let-listing.schema.ts` | Draft/publish validation and Listing options. |
| `apps/web/schema/to-let-property.schema.ts` | Client validation aligned with the API; phone format is relaxed only in local development. |
| `apps/web/lib/public-data.ts` | Public Listing and QR data helpers. |
| `apps/web/lib/orpc/public-server.ts` | Supports no-store reads for immediate Listing publish/unpublish visibility. |
| `apps/web/package.json`, `pnpm-lock.yaml` | Adds `qrcode.react` for local QR generation. |

### API and database

| File | What changed |
| --- | --- |
| `packages/api/src/routers/tolet-property.ts` | Owner Property/Unit API; removing a Vacant Unit closes its Listing, rejects pending requests, preserves history, marks it inactive, and excludes it from active Unit lists/capacity. |
| `packages/api/src/routers/tolet-unit-listing.ts` | Owner Listing lifecycle plus filtered Public and permanent-QR reads. |
| `packages/api/src/routers/tolet-booking.ts` | Idempotent create/list/cancel plus owner list/accept/reject with ownership and availability checks. |
| `packages/api/src/routers/tolet-rental.ts` | Contract activation, rent-cycle OTP verification, Leave/Alert, and verified comments. |
| `packages/api/src/routers/index.ts` | Registers Property, Unit Listing, Booking, and Rental routers; legacy `toLet` remains untouched. |
| `packages/db/src/schema/tolet-booking.ts` | Additive Booking Request schema, immutable offer snapshot, status guards, and uniqueness constraints. |
| `packages/db/src/schema/tolet-property.ts` | Additive Property, Unit, and Unit Listing schema with relations and guards. |
| `packages/db/src/schema/tolet-rental.ts` | Rental Contract, monthly Rent Payment, Alert, and Comment schemas. |
| `packages/db/src/schema/index.ts` | Exports the new schema. |
| `packages/db/src/migrations/0039_tolet_property_foundation.sql` | Additive M1 SQL migration. |
| `packages/db/src/migrations/0040_tolet_unit_listing.sql` | Additive M2 Unit Listing migration. |
| `packages/db/src/migrations/0041_tolet_booking_request.sql` | Additive M3 Booking Request migration. |
| `packages/db/src/migrations/0042_tolet_rental_lifecycle.sql` | Additive owner/tenant rental lifecycle migration. |
| `packages/db/src/migrations/meta/_journal.json` | Registers migrations 0039–0042. |

## Important behavior

- A user only sees and changes their own properties and units.
- Another authenticated user receives `404` for an owner-only Property ID.
- Production requires the Property contact phone to be verified and match the
  authenticated account. Local development auto-verifies the entered number.
- Images and video URLs accept only HTTP/HTTPS.
- Property owner deletion is restricted once a property exists, so permanent IDs and QR identity cannot disappear through cascade deletion.
- Admin approval is not part of this flow. A future complaint/ban flow may set `status = blocked`.
- Unit status starts as `VACANT`; Booking acceptance changes it to `BOOKED`, and Contract activation changes it to `OCCUPIED`.
- Only an active Property with a Vacant Unit can publish.
- Publish requires at least one Listing photo; Unit photos are reused initially.
- One Unit can have only one open (`draft`, `active`, or `paused`) Listing.
- Public discovery returns only active + Public + Vacant + active-Property rows.
- QR discovery returns active + Vacant rows for that Property and includes both
  Public and QR Only visibility.
- Property/Unit/contact data stay derived from the source records; the Listing
  does not duplicate owner contact or structural Unit data.
- Booking can only be requested for an active Public Listing whose Property is
  active and Unit is Vacant. A Consumer cannot book their own Property.
- A Consumer can have only one Pending request per Listing. An idempotency key
  prevents a retry/double-click from creating a second request.
- Booking stores an immutable, versioned snapshot of the advertised rent,
  charges, availability, Property/Unit labels, and public contact. Later Listing
  edits cannot silently change an existing request.
- Only a Pending request can be Cancelled, Accepted, or Rejected.
- Accepted means **Unit booked / Listing closed**. It does not mean Contract
  active, Tenant linked, or Unit occupied.

## Booking request decision record (ADR)

- The first supplied wireframe is an **owner Unit Details** screen. Its base
  Unit/Listing UI now uses the document's five-tab structure: Unit Information,
  Facilities, Rent, Tenant, and Booking History.
- The client rejected the divided-card presentation. The Unit image, summary,
  status, and actions now share one hero, while all five tabs render inside one
  continuous bordered surface without a second Listing summary card. Every
  section remains visible on the full page; the tab-style buttons are scroll
  navigation, not content-hiding tabs.
- The tabs reuse the existing Property, Unit, Listing, Booking, Contract, and
  payment data. No duplicate table, fake tenant state, or database migration was
  added for this UI restructuring.
- Unit Information also shows the document's views, monthly rent, status, last
  publish date, last update date, image gallery, optional Property video, and
  owner Share action using existing fields.
- `Rental Agreement image` is intentionally not faked: the current schema has no
  agreement media field. Persisting it later needs a separately reviewed storage
  and authorization design.
- The public action is named **Request Booking**, not Book Now, because the owner
  must approve it.
- Request lifecycle is `Pending -> Accepted | Rejected | Cancelled`.
- Owner acceptance is one locked database transaction so two requests cannot
  book the same Unit.
- In the initial Booking Request phase, Contract, Occupied, Leave, Comments,
  Alerts, and monthly rent OTP were deliberately not represented by fake UI or
  statuses. They are now implemented by the later lifecycle section below.
- The second supplied wireframe is treated as the long-term My Bookings/Rental
  area. This phase implements only the truthful request-history portion.

Booking glossary:

- **Booking Request:** a Consumer's request for an advertised Unit; not a rental
  contract.
- **Offer Snapshot:** the immutable advertised terms captured when the request
  is sent.
- **Accepted:** the owner approved the request and the Unit is reserved as
  `BOOKED`; contract activation is still pending.
- **Rejected:** the owner declined the request, or another request won the Unit.
- **Cancelled:** the Consumer withdrew a still-Pending request.

### My Bookings and Rental Details UI (2026-07-22)

- `/account/to-let` now follows the supplied My Bookings card structure: booking date/code, captured property media and offer details, normalized request status, and a real View Details route.
- `/account/to-let/bookings/[bookingCode]` follows the supplied order: booking summary, Overview, Facilities, Rent Information, Payment History, Create To-Let Alert, and verified Comments.
- The ambiguous document state `Accepted/Active/Occupied` is not collapsed into one status. The UI shows `Booked · Contract pending` after acceptance; the owner must activate the Contract before the Unit becomes `OCCUPIED`.
- Duplicate Balcony inputs were clarified as physical balcony count versus future alert preference.
- New Booking offer snapshots preserve optional Unit features and Property facilities inside the existing JSON snapshot. This is backward compatible with older rows and required no database migration.
- Leave, monthly OTP payment, and Comments become available only when a real Contract exists. A general To-Let Alert can also be saved directly from My Bookings.

### Rental lifecycle and owner controls (2026-07-22)

- The Create/Manage Listing UI follows the supplied five-step wireframe without
  duplicating permanent Property or Unit data. Identity and physical fields are
  read-only; only advertisement terms are saved to the Listing.
- Review shows Property, Unit, category, location, facilities, media, pricing,
  contact and visibility. An Active Listing shows View Listing, Edit Listing,
  Share QR Code and Create Another Listing actions.
- Owner Listing create/edit now has an independent `Show to visitors before contract` switch for Monthly Rent, Advance, Security Deposit, Service Charge, Parking Fee, and Utility Bill.
- Public Listing APIs return `null` for a hidden amount, so hidden prices are not transmitted to visitors. Owners still receive the full amount. Booking offer snapshots preserve the visibility decision.
- An accepted Booking now supports Owner Contract activation with start/end dates and a rent due day. Activation links owner/tenant, snapshots the accepted offer prices, changes the Unit from `BOOKED` to `OCCUPIED`, and starts rent cycles.
- Monthly rent cycles are generated from Contract dates. OTP is deterministically derived with the server secret and Contract/cycle identity, is exposed only to the Property Owner, and is never stored as plaintext. Tenant OTP verification records the receiver reference and changes the cycle from `PENDING` to `PAID`.
- Tenant Leave changes the Contract to `LEAVING`, preserves Unit occupancy/access through the Contract end date, and saves the prefilled To-Let Alert. Expired leaving contracts are finalized to `COMPLETED` and the Unit becomes `VACANT` on the next lifecycle read.
- Comments are restricted to linked rental participants; the tenant can view and submit verified Contract-linked feedback.
- Additive migration `0042_tolet_rental_lifecycle.sql` creates Contract, Rent Payment, Rental Alert, and Rental Comment tables plus six Listing price-visibility columns.
- The normal Drizzle runner still encounters the repository's older migration-history mismatch before reaching 0042. Only the idempotent 0042 SQL was applied directly inside a transaction to local `127.0.0.1:55432/bikalpo_full_m1`; production/remote was not contacted.

## Public landing decision log

- `/to-let` is public discovery; `/account/to-let` remains the private Booking area.
- Shared Navbar and Footer are reused, so the landing does not duplicate global navigation.
- Search and rental-type filters use the current Public Listing feed and URL parameters (`q`, `type`).
- Feed/category numbers are labelled as **shown** counts because the public API currently returns at most 60 rows; sample document numbers are not treated as facts.
- Only active + Public + Vacant listings appear. Public cards therefore say Available/Available from; they do not display fake Booked or Book Now states.
- Radius/nearby search and public reviews remain later phases. Saved Alerts and Booking Requests use real local APIs; the location section uses an interactive Google Maps embed.
- Legacy To-Let rows remain separate from Property/Unit listings because they do not have the same category, facility, or identity data.
- Owner CTAs follow the client landing wireframe wording while routing to the existing direct Property registration and Property management flow; no admin-approved Property Account is introduced.

### Landing UI alignment (2026-07-22)

- `/to-let` now follows the client DOCX section order: hero/search, truthful marketplace snapshot, rental types, curated listings, location intelligence, tenant journey, community feedback, and owner CTA.
- Hero, filters, listing cards, section spacing, colors, borders, and buttons continue to use the shared Bikalpo Navbar/Footer and design tokens.
- The hero no longer borrows the first Listing photo. It uses the dedicated `apps/web/public/images/to-let-hero.png` asset so test/user Listing media cannot change the landing-page identity.
- Rental types now use the supplied compact six-card desktop row (responsive two-column mobile layout), instead of the earlier oversized split layout.
- The Community Reviews area matches the supplied two-column UI (feedback form on the left, recent review cards on the right) but is explicitly marked as a preview until verified review data exists.
- Sample counts and testimonials from the wireframe were not presented as facts; statistics come from the current public feed and review content is labelled as preview.
- Developer-facing phrases such as “document”, “next phase”, and “Public/Vacant feed” were removed from customer-visible copy.
- Desktop and mobile browser checks passed with no horizontal overflow. `/to-let` returns `200` after the update.
- Smart Rental Map now renders Google Maps using each published Property's existing latitude/longitude. If coordinates are missing, it falls back to the public area/address. Area chips and the Open in Google Maps action open Google Maps search; no database migration or new map table was added.
- Full web TypeScript still reports unrelated Warehouse/Product/shared React diagnostics; no diagnostic points to `app/(public)/to-let/page.tsx`.

Landing glossary:

- **Public Listing:** an active Listing with `visibility = public`, an active Property, and a Vacant Unit.
- **Shown count:** a count derived only from the current public feed, not a platform-wide total.
- **QR Only:** a Listing visible through the permanent Property QR page but excluded from public discovery.
- **Google rental map:** an interactive Google Maps embed centered on an existing Listing coordinate or public address fallback; smart radius/POI search is not live yet.
- **Next phase:** visible product direction without an enabled API action or invented result.

## Local development now

- Web: `http://bikalpo.localhost:3001`
- API: `http://api.bikalpo.localhost:3000`
- Docker container: `bikalpo-tolet-dev-db`
- Local PostgreSQL port: `127.0.0.1:55432`
- Active local database: `bikalpo_full_m1`

The active local database was made from a **schema-only** copy of the configured database. No remote rows/client data were copied. Migrations 0039 through 0042 and all test records were applied only to the local database. The configured remote database was not migrated or mutated.

Local test records:

- Property: `PR-2026-100001`
- Unit: `UNT-100001` (`VACANT`, ground floor)
- Listings: `LST-100001` and `LST-100002` (`ACTIVE`, `PUBLIC`, local development data)

## Verification completed

- Full local schema loads without the previous missing Cart/Product table errors.
- Property create API returned `200`.
- Ground-floor Unit create API returned `200`.
- Cross-owner property read returned `404`.
- Blocked-state UI preserved the property while disabling edit/unit actions; the test record was restored to `active`.
- Browser verified property list, details, registration, and unit forms.
- Public `/to-let` and a filtered landing URL return `200`; hero, curated listings, and live local data render in the server response.
- Landing page, Listing card, and carousel pass targeted Biome; targeted TypeScript reports no diagnostics.
- Next production compilation succeeds, then the full build stops on the pre-existing unrelated Warehouse `receiveWarehouseSupplierShipment` type error.
- Browser verified a single Unit photo keeps its full 16:9 height on desktop instead of collapsing into a thin strip.
- Browser verified Create → Publish → Public page, Public ↔ QR Only privacy,
  Unpublish → Publish Again, Call/WhatsApp links, permanent QR page, and
  immediate `/to-let` discovery.
- A clean final Public Listing page load produced no browser errors.
- Cart, product catalog, property list, and property details requests return `200` on the full local schema.
- No TypeScript error points to an M1/M2 file.
- M1/M2 target files pass Biome after formatting.
- Migration 0041 created the local Booking table with seven indexes and six
  constraints; the remote database was not contacted.
- A temporary local Consumer passed Booking Create -> List Mine -> Cancel. The
  temporary request/user were deleted afterward, counts returned to zero, and
  the Booking ID sequence was restored.
- Booking REST auth guard returns `401` without a session; `/account/to-let`
  redirects unauthenticated visitors to login.
- The seven targeted Booking web files pass Biome. Full web TypeScript reports
  zero diagnostics in the Booking files; existing unrelated diagnostics remain.
- Browser verified that changing a local Property phone to a temporary value
  auto-verifies immediately, keeps Save enabled, and renders no OTP input. The
  unsaved browser test value was discarded afterward.
- Migration 0042 was verified locally with four lifecycle tables and six
  Listing price-visibility columns. The remote database was not contacted.
- Rental API and To-Let web target TypeScript checks pass; lifecycle target
  files pass Biome.
- Browser verified the My Bookings saved Alert form renders and is interactive
  without runtime errors.
- Full-repo typecheck still has unrelated pre-existing warehouse/product/shared React type errors.

## Do not do yet

- Do not run migrations 0039/0040/0041/0042 on production/remote without a backup and explicit review.
- Do not run `db:generate` until the older Drizzle journal/snapshot history is reconciled; it may include unrelated changes.
- The development OTP helper now returns `404` outside development. A real SMS
  provider is still required before enabling production phone verification.

## Later phases

- Optional M2 follow-up: printable branded QR poster, map view, and Listing search/filter.
- Remaining lifecycle follow-up: offline Mark as Booked, scheduled background
  finalization/notifications, Alert matching notifications, and guided Re-list.
- Direct video upload is not built yet; M1 accepts an optional public video URL.
