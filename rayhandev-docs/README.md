# RayhanDev Quick Handoff

Last updated: 2026-08-06

## Current status

M1 Property/Unit management, M2 Listing publishing, M3 Booking Request, and the
M4 owner/tenant rental lifecycle are implemented locally.

Included now:

- Consumer-only property ownership; there is no separate Property Account login or admin approval.
- Four-step Property Registration with dependent Bangladesh location selection, local draft recovery, contact OTP, photos, direct building-video upload, facilities, review, and agreements.
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
| `apps/web/components/account/account-sidebar.tsx` | Keeps My Bookings in the Account menu; Property Registration/My Properties is intentionally not duplicated in the sidebar. |
| `apps/web/components/shop/account-overview-client.tsx` | Dashboard property card uses the same registration-aware destination and never links to Booking. |
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
| `apps/web/components/features/to-let/property/property-details-client.tsx` | Property, facilities, capacity, QR status, units view, and the document-aligned post-registration success/next-step panel. |
| `apps/web/components/features/to-let/property/property-edit-form.tsx` | Full property edit with phone re-verification and Included/Excluded facility controls. |
| `apps/web/components/features/to-let/property/property-phone-verification.tsx` | Shared registration/edit contact verification with the login-style six-box OTP UI. Local development sends a real Better Auth OTP and fills it from the protected dev helper; production keeps manual OTP entry. |
| `apps/web/components/features/to-let/property/property-qr-card.tsx` | Locally generated permanent QR, download, and open-page actions. |
| `apps/web/components/features/to-let/property/property-registration-wizard.tsx` | Document-aligned four-step registration with local Save & Continue recovery, manual facility decisions, GPS reverse-geocoding, complete Review/status sections, and first-invalid-step navigation. Step 1 keeps no duplicate photo input; Step 3 Front Image is also the cover. |
| `apps/web/components/features/to-let/property/property-location-fields.tsx` | Division and dependent District selects plus Barikoi-backed searchable Area/Upazila selection with manual fallback. |
| `apps/web/components/features/to-let/property/property-video-field.tsx` | Registration video source selector: direct verified upload or an optional public video link, with one source active at a time. |
| `apps/web/components/VideoUploader.tsx` | Direct signed Cloudinary MP4/WebM/MOV upload with 90-second/100MB client checks, progress, preview, replace, and removal. |
| `apps/web/constants/bangladesh-locations.ts` | Canonical eight Divisions, 64 Districts, and spelling normalization used by registration/GPS. |
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
| `apps/web/schema/to-let-property.schema.ts` | Client validation aligned with API URL, floor, and description limits; phone format is relaxed only in local development. |
| `apps/web/hooks/use-barikoi-autocomplete.ts` | Existing area search now accepts an optional District/city scope. |
| `apps/web/lib/public-data.ts` | Public Listing and QR data helpers. |
| `apps/web/lib/orpc/public-server.ts` | Supports no-store reads for immediate Listing publish/unpublish visibility. |
| `apps/web/package.json`, `pnpm-lock.yaml` | Adds `qrcode.react` for local QR generation. |

### API and database

| File | What changed |
| --- | --- |
| `packages/api/src/routers/tolet-property.ts` | Owner Property/Unit API; removing a Vacant Unit closes its Listing, rejects pending requests, preserves history, marks it inactive, and excludes it from active Unit lists/capacity. |
| `packages/api/src/routers/cloudinary.ts` | Adds fixed-folder signed direct video upload credentials, authoritative format/size/duration finalization, and video-aware deletion. Existing image upload behavior remains compatible. |
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
- Images and stored video URLs accept only HTTP/HTTPS. Property video files upload directly to Cloudinary and are verified server-side before the URL is accepted.
- Property removal is a soft archive, so permanent IDs, QR identity, and history cannot disappear through cascade deletion.
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
- Public cards use the document's **Book Now** discovery badge; the actual detail
  action remains **Request Booking** because the owner must approve it.
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
- Feed/category numbers are labelled as **shown** counts because the public API currently returns at most 300 rows; sample document numbers are not treated as facts.
- Active + Public + Vacant listings appear for 30 days from publication. A confirmed online Booking or offline **Mark Rented** starts a fresh 30-day public window in which the same Listing is labelled **Booked** and accepts no new Booking Requests.
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

- **Public Listing:** a `visibility = public` Listing on an active Property that is either within its 30-day available publication window or its 30-day confirmed-Booked window.
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
- The former local Property-phone auto-verify bypass was removed. Registration
  and Edit now show the same six-box OTP interaction used by Login; development
  fills the code for the developer, but verification still needs a deliberate
  **Verify OTP** click.
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

### Property registration removal (2026-08-05)

- Property Details now has an owner-only **Delete Property** action with a
  confirmation dialog.
- Deletion is a safe archive (`status = inactive`), not a physical database
  delete. The permanent Property ID, QR, uploaded media, and rental history are
  preserved.
- Vacant units are archived, open Listings are closed, and pending Booking
  Requests are rejected in one transaction. Booked/occupied properties and
  active rentals must be completed before deletion.
- Archived properties disappear from My Properties and public discovery. No
  database migration was added or run.

### Property registration video link (2026-08-05)

- Step 3 Building Video now lets the owner choose **Upload Video** or **Add
  Video Link**.
- Public YouTube, Facebook, Google Drive, and direct video URLs reuse the
  existing optional `videoUrl` field; no API, schema, or migration change was
  required.
- Only one source is active at a time. The current video/link must be removed
  before switching source, which prevents accidental replacement or orphaned
  uploads.

### PDF-aligned My To-Let owner view (2026-08-05)

- The Property Details page now follows the supplied **MY TO-LET** order:
  Property Photo + Property Information, My Property Listing cards, then the
  permanent QR poster.
- Property Information includes the permanent ID, owner/contact/location,
  floors, declared Units, Verified status, Edit Property, and context-aware
  Create Unit/Manage Units actions.
- Each owner card keeps the latest Listing photo/title/ID/rent/details/views.
  Active cards rotate Book Now with that Listing cycle's Booking Request count. Booked/rented
  cards keep their Listing summary but show Details only.
- Owner cards now use human floor labels (for example, `1st Floor` and
  `Ground Floor`), show the Listing ID beside the Unit identity, always show
  the Unit size in `sq ft`, and fall back to the reusable Unit description when
  the Listing description is empty.
- Offline **Mark Rented** closes the active Listing, rejects its pending
  requests, and marks the Unit Booked in one owner-scoped transaction. Safe
  Reactivate returns only an offline-booked Unit to Vacant, then **Re-List**
  creates a new Listing while preserving history.
- Booking Requests appear only inside Unit Details while the Listing is Active
  and the Unit is Vacant. Accepting or offline booking removes that section.
- The owner request inbox is scoped to the Unit's current Active Listing, so
  requests from an older Listing cycle do not appear after Re-List. When the
  Unit is Booked/Occupied, the same owner-only endpoint returns only the
  accepted current tenant record; inactive Units return no request data.
- Property/Unit Listings support **Public** and **QR Only**. Active Public
  Listings on an active Property with a Vacant Unit appear on `/to-let` and open
  through the bare Listing URL. QR Only Listings stay out of discovery and need
  the matching permanent Property QR token. Both authorized paths support
  Booking Requests and update the owner view count.
- Download QR creates a printable branded SVG poster with TO-LET, Property
  name/location, QR, permanent Property ID, and Bikalpo.com attribution.
- Existing Property and Listing video-link fields are reused as video/360-tour
  slides. There is no dedicated 360 media column yet.
- No database schema change or migration was added or run for this alignment.
- QA covers Public publish -> immediate `/to-let` discovery -> bare Listing
  Details -> Booking Request, plus QR Only hidden from discovery/bare URLs and
  available only through its token-bound QR flow.

The PDF landing/data alignment below supersedes only the temporary QR-only
restriction above. The legacy To-Let catalog remains a separate module.

### PDF-aligned To-Let landing + Public publish (2026-08-05)

- `/to-let` keeps the supplied PDF section order while matching Bikalpo's shared
  Navbar, Footer, spacing, colors, cards, and responsive behavior.
- Curated cards, rental-type counts, marketplace totals, location previews, and
  map data come from active Public Property -> Unit -> Listing records. The
  separate legacy catalog is not mixed into this PDF-aligned feed.
- A Public publish/unpublish is reflected immediately on landing, search, map,
  bare Listing Details, and Booking Request. QR Only remains excluded and uses
  the permanent token-bound Property QR path.
- The database already supported `public | qr_only`; this correction added no
  schema change and ran no migration.

### PDF-aligned Unit Details page (2026-08-05)

- A Unit card's **Details** button opens the owner route at
  `/account/to-let/properties/{propertyCode}/units/{unitCode}`.
- The page follows the supplied Unit Details layout: linked breadcrumb, image
  slider/thumbnails, ID/rent/status summary, Edit/Share actions, and one long
  scroll page with Unit Information, Facilities, Rent, Tenant, and Booking
  History jump buttons.
- Closed Listing details do not disappear after a Booking is accepted. The page
  uses the active Listing while Vacant, the accepted immutable offer snapshot
  while Booked/Occupied, and the latest Listing summary as the offline-booked
  fallback.
- Current Tenant uses the accepted Booking contact and real contract dates.
  `bookingCode` is shown honestly as the Tenant reference because no public
  `USR-*` identity exists. Monthly payment rows show only real payment data and
  owner-visible pending OTPs.
- Rental Agreement Image is shown as an empty state only; persistence is not
  implemented because there is no reviewed agreement-document field/API yet.
- No database schema change or migration was added or run.

### Public To-Let Listing Details refresh (2026-08-05)

- `/to-let/listings/{listingCode}` now uses a large 16:9 photo slider with
  auto-play/pause, previous/next controls, image count, keyboard/swipe support,
  and a scrollable thumbnail strip. It renders the Listing's existing photos
  and does not create separate media records.
- The page now shows the public-safe Listing, Unit, Property, facilities,
  pricing, availability, location, video, Call, WhatsApp, and Booking Request
  information already returned by the public API.
- On mobile the rent and Booking Request panel appears immediately after the
  gallery; on desktop it stays visible as a sticky side panel.
- Owner-only tenant identities, payment/OTP history, rental agreements, and
  private Booking Request lists were intentionally not exposed.
- No database schema, API route, or migration was added or run.

### Consumer My Bookings / My To-Let refresh (2026-08-05)

- `/account/to-let` remains the consumer page for Booking Requests, confirmed
  Units, current rentals, and rental history. The owner workflow remains under
  My Properties.
- Booking cards now rotate through the immutable photos captured with the
  Booking offer. Status comes from the Booking until a contract exists, then
  from the real rental state: Occupied, Leaving, or Completed.
- `View Details` opens `/account/to-let/bookings/{bookingCode}` with an
  interactive main image slider and thumbnails, then Overview, Facilities,
  Rent, Payment History, Leave/Alert, and Comments in one scroll page.
- An active contract is the final source for tenant-visible rent and status.
  Payment History is completely hidden before contract activation; after
  activation the tenant enters the payment receiver and owner-provided monthly
  OTP. The tenant never receives the current OTP from the API.
- Mobile Booking filters keep their visible labels in a horizontal strip, and
  the Account menu collapses above the page instead of pushing the content
  below the full sidebar. Loading states now announce themselves to assistive
  technology.
- Existing Booking -> offer snapshot -> Unit/Property -> rental contract data
  is reused. No database schema, API route, or migration was added or run.

### 30-day To-Let marketplace visibility (2026-08-05)

- An available Public Listing stays on `/to-let`, public search/map, and its
  bare Listing Details page for 30 days from `publishedAt`.
- Accepting an online Booking Request or using offline **Mark Rented** already
  closes the Listing with `closedAt`. That timestamp starts a fresh 30-day
  public window with a **Booked** badge.
- Booked cards keep **View Details** but show no booking conversion action. The
  Details page also removes **Request Booking**, and the API continues to reject
  requests unless the Listing is Active and its Unit is Vacant.
- At the exact 30-day boundary, request-time SQL filtering removes the Listing
  from normal public discovery and its bare Details URL. No history is deleted,
  and no cron job or write-on-read process is used.
- If the Unit becomes Vacant or a newer Listing cycle is created earlier, the
  old Booked card is suppressed immediately so stale cycles cannot reappear.
- Permanent Property QR discovery remains available-only. Existing
  `publishedAt` and `closedAt` fields were reused; no schema migration or
  database command was added or run.

### Functional To-Let landing controls (2026-08-06)

- Search now safely handles duplicate URL parameters and matches Listing,
  Property, and Unit IDs in addition to names and locations. Garage and Other
  are available in the same filter flow as the existing rental types.
- Listing totals, property/area/view totals, rental-type counts, listing cards,
  map results, area chips, and Tenant Journey links all use the current search
  results instead of showing unrelated records.
- **My Alerts** is a real signed-in saved-search manager. It stores the existing
  alert preferences and supports list, pause, and resume. Exact duplicates are
  reused, terminal alerts cannot be reopened, and each user is capped at 50
  saved records. Automated matching or notification delivery is still a later
  background-worker phase.
- The Google Maps section is interactive: selecting a result changes the map
  focus without opening the Listing, while **View details** remains a separate
  action. Empty filters no longer leave an unrelated Listing on the map.
- Landing Listing cards expose only **Call** and **View Details**, matching the
  supplied landing-page specification. Available and recently Booked cards use
  the same two-action layout; Booked Listings still do not accept new requests.
  The Booking journey deep-links to the Details page's request panel.
- An expired Public Listing cannot receive a normal stale Booking Request. A
  valid permanent Property QR can still open the active/vacant QR flow, and the
  owner gets **Renew visibility** after expiry; renewal resets `publishedAt` on
  the same Listing row, so IDs and history remain intact.
- Owner and tenant landing CTAs preserve their intended account destination.
  Verified rental feedback routes to the existing contract-linked My Bookings
  flow; private comments are not presented as public testimonials.
- Public API failures now render an unavailable state instead of pretending the
  marketplace has no listings. No database schema change, migration, or database
  command was added or run for these landing controls.

### Login-aligned To-Let contact OTP (2026-08-11)

- Property Registration and changed-number Property Edit reuse one phone
  verification component with one six-digit OTP field, resend cooldown, and an
  explicit **Verify OTP** action matching the approved Registration layout.
- In local development, Better Auth still creates the OTP and the protected
  development helper animates it into the boxes. If auto-fill is unavailable,
  manual entry continues to work. Production never calls the helper and keeps
  strict Bangladesh-number validation.
- Monthly rent/payment OTP is a separate owner-to-tenant proof flow and was not
  changed. No database schema, API route, migration, or database command was
  added or run.

### Registration-aware Consumer property navigation (2026-08-11)

- When the Consumer has no non-archived Property, the Dashboard card shows
  **Property Registration** and opens the registration form.
- After registration, the existing Property list query is invalidated and the
  Dashboard card switches to **My Properties**. The registration shortcut disappears;
  Property management remains separate from My Bookings and is not duplicated
  in the Account sidebar.
- Loading/API errors conservatively keep **My Properties** instead of assuming
  the Consumer has no Property. The shared query is consumer-gated, and no
  database schema, API route, migration, or database command was changed.

### One-click To-Let Booking Request (2026-08-12)

- **Request Booking** no longer opens a contact/date/message popup. A signed-in
  Consumer sends the request directly with the name and phone number already in
  the account session.
- The desired move-in date is selected automatically as the later of today's
  Dhaka date and the Listing's **Available From** date. This keeps future-dated
  availability enforcement intact without asking the Consumer to repeat data.
- Missing account name/phone, non-Consumer roles, duplicate pending requests,
  and unavailable Listings still stop safely with feedback. The button shows a
  sending state, and a successful request links to **My Bookings**.
- No database schema, migration, or database command was changed or run.

### Specification-aligned Property Registration (2026-08-12)

- The four Registration steps now follow the supplied field order and wording:
  **Basic**, **Property**, **Verify**, and **Review**.
- Step 1 contains the approved owner/contact, seven Property Type choices,
  Bangladesh Division/District/Area, address, landmark, and GPS capture fields.
  The earlier first-step image field is not used.
- Step 2 exposes Property Status, empty floor/unit inputs, and explicit **Yes / No**
  choices for every facility. Nothing is preselected; the owner must answer each
  facility before continuing.
- Step 3 uses the required front photo, optional Building Photo, real video upload
  with the 90-second limit, and the single-field OTP verification flow.
- Step 4 shows the exact Property summary, available facilities, photo/OTP checks,
  ready status, and the three required confirmations. The post-registration card
  shows the permanent Property ID, Verified status, and the approved next actions.
- Existing Property/API columns are reused. No database schema, migration, or
  database command was added or run.

## Later phases

- Optional media follow-up: a dedicated 360-tour upload/URL field instead of
  reusing the existing video links.
- Remaining lifecycle follow-up: scheduled background
  finalization/notifications and Alert matching notifications.
- Property Registration now supports direct verified video upload. Property Edit and Listing Edit still use optional public video URLs until the shared uploader is rolled out there.
