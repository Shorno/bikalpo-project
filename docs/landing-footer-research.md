# Landing footer contents and route research

Research date: 2026-09-05. Sources are the user's written request, the supplied footer reference image, and repository source code. The written request controls the implementation; text in the image is design reference data, not separate instructions.

## Content decisions

- Use **Bikalpo** and **Multi-channel digital e-commerce**, as explicitly requested. The reference image's Bikalpo name and older slogan do not override that request.
- Manufacturer, Importer, Distributor, Wholesaler, Retailer, and Property Owner are descriptive labels in the reference. They do not imply navigation destinations.
- Facebook, Instagram, Android, and Apple are placeholders until the user provides destinations. Render recognizable, accessible icons without invented external links.
- Contact details and informational copy are provisional per the request. The existing contact page already uses static information: `apps/web/app/(public)/contact/page.tsx`.
- The image's retailer totals (for example Dhaka 320+) have no verified source in this task. Show location names without invented counts. The public API returns genuine `pagination.totalCount` for a filtered directory: `packages/api/src/routers/customer.ts`, `getShops`.

## Route inventory

| Footer content | Destination | Baseline evidence |
| --- | --- | --- |
| About Us | `/about` | Existing placeholder: `apps/web/app/(public)/about/page.tsx` |
| Privacy Policy | `/privacy` | Existing placeholder: `apps/web/app/(public)/privacy/page.tsx` |
| Terms & Conditions | `/terms` | Existing placeholder: `apps/web/app/(public)/terms/page.tsx` |
| Contact Us | `/contact` | Existing placeholder: `apps/web/app/(public)/contact/page.tsx` |
| Our Ecosystem | `/ecosystem` | No public route at inspection; create static page |
| Trust & Safety | `/trust-safety` | No public route at inspection; create static page |
| Help Center | `/help-center` | No public route at inspection; create static page; warehouse dashboard help is unrelated |
| Retailers by location | `/stores?location=Dhaka` and equivalent encoded values | Directory: `apps/web/app/(public)/stores/page.tsx`; retailer discovery API: `packages/api/src/routers/customer.ts`, `getShops` |

## Retailer directory implementation

The baseline directory supports name search and numeric area IDs only in component state. It did not read URL filters, and its API name search matches `shopName`/`name`, not addresses. Simply linking to `/stores?search=Dhaka` would not provide a working location destination. See `apps/web/app/(public)/stores/page.tsx` and `packages/api/src/routers/customer.ts`, `getShops`.

This task adds `location` as an explicit URL/API filter using case-insensitive substring matching on the retailer's stored `shopAddress`. It works with approved retailers that have public slugs and preserves existing pagination. The visible directory heading and removable filter identify the selected location. Explicit location links suppress automatic nearby discovery; choosing Use my location clears that explicit filter. Both directory clear actions remove the URL filter. Sources: changed `apps/web/app/(public)/stores/page.tsx` and `packages/api/src/routers/customer.ts`.

Limit: address matching depends on the spelling and language in existing store records. It is not a geographic boundary or delivery coverage query. The existing area model uses configured `areaId` values rather than a fixed city mapping; no authoritative city-to-area IDs were provided. Keep the reference's city links but do not claim complete location coverage.

## Integration boundary

The public layout renders the shared `Footer`: `apps/web/app/(public)/layout.tsx`. The repository also contains a separate landing footer component and a B2B footer: `apps/web/components/features/landing/landing-footer.tsx`, `apps/web/components/features/landing/b2b/b2b-footer.tsx`. The main public landing change must be wired through the shared footer's appropriate variant; editing an unused component alone would not update the page.

Existing documentation convention is Markdown research files directly under `docs`, for example `docs/retailer-store-design-research.md`; this report follows that convention. No applicable `AGENTS.md` was found in the repository or its direct ancestors.


Brand update: The user confirmed the platform name is `Bikalpo` and supplied the current logo, saved unchanged at `apps/web/public/logos/bikalpo-logo.jpg`. The footer now uses this image beside the platform name. Earlier screenshot artifacts predate this correction.


## Live seller directory update

The current footer replaces the original fixed retailer locations with `sellerDirectory.locations`. The API derives locations from the latest approved business registration for each current shop-owner or warehouse account. All business natures are included; admin, consumer, staff, banned, and unapproved seller accounts are excluded. Only business map coordinates and resolved district/division fields are used; personal addresses and free-text address guessing are never used. Accounts with unresolved or invalid Bangladesh business coordinates are omitted until their location is completed.

Counts and `/sellers?district=…&division=…` use the same SQL eligibility and grouping source. District/division aliases normalize Bangla, English, and older spellings without inventing locations. The UI refreshes coverage every minute, supports loading/error/empty states, and displays exact counts. Seller listings paginate in SQL and link warehouses to `/w/[slug]` and shops to `/stores/[slug]`.

Sources: `packages/api/src/routers/helpers/seller-directory.ts`, `business-location-names.ts`, `packages/api/src/routers/seller-directory.ts`, and `apps/web/components/features/landing/seller-directory.tsx`. Integration coverage uses temporary PostgreSQL tables and rollback to verify all seller types, excluded roles, duplicates, invalid coordinates, bilingual locations, pagination, and moved registrations. A read-only check at implementation time returned Dhaka: 11; this value is not embedded in UI code.
