# To-Let landing completion — 2026-09-12

## Local section-order and responsive follow-up

- Preserved the requested order on every breakpoint: shared header, hero/search, statistics, rental types, listings, existing map, tenant journey, reviews, property registration CTA, shared footer.
- Mobile retains two-column stats/categories/listings, with the remaining rental categories available through the existing disclosure. Inputs use 16px text; carousel controls no longer require hover on touch devices.
- Landing and all-listings now use the same paginated search endpoint; identity search includes listing, unit and property IDs and effective unit address fields. See-all links and header searches preserve query/type.
- Landing result counts use the full paginated query total. Summary/category sampling is still capped at 300 and explicitly disclosed; listed properties is no longer labelled all registered properties. Summary failures show an unavailable state instead of zero.
- Disabled reviews no longer invite submission. Google Maps enhancement, migration, official footer information and physical-phone testing remain deferred/pending.
- Browser checks at 360, 390, 768 and 1440px found the expected section order, no horizontal overflow and no page errors. Listing ID search and filtered see-all navigation matched between routes. Five marketplace helper tests passed.
- No production deploy, commit, push, migration or business-record submission performed.

## Decisions and pending approval

- User deferred Google Maps enhancements: no new radius, nearby or commute backend work now. Existing map stays unchanged.
- User deferred the public-review database migration. Do NOT apply it or enable public reviews yet.
- Proposed SQL is retained outside the migration runner in `docs/pending/tolet-public-reviews.sql`; it is not registered in the migration journal.
- `TOLET_PUBLIC_REVIEWS_ENABLED` must remain unset/false until explicit approval, schema deployment, and verification. No environment setting was enabled in this task.
- Existing rental comments remain private. The existing schema and private-comment queries do not require the proposed column. Disabled public endpoints return an explicit disabled state without querying that column.
- Once approved: register the migration following current project migration conventions, add the boolean to the Drizzle schema and its partial index, apply the additive migration, then enable the flag. Test public consent, tenant eligibility and private comment isolation before deployment.
- Official social URLs, app-store URLs and contact phone were not provided. Shared footer configuration remains pending; do not invent official details.
- Physical phone touch testing remains pending. Browser tests are not equivalent to real-device tests.

## Implemented code awaiting verification/activation

- Real paginated public review endpoint and all-reviews route; explicit user consent for public name, rating and comment. Existing private comments are not automatically published.
- Direct landing review submission for current authenticated tenants, rather than redirecting the form to a booking page. Public submission is blocked while the feature is disabled.
- Dedicated all-listings route with database pagination, search, stable ordering and previous/next navigation. Landing shows eight recent matches; existing stats/map catalog sampling is unchanged.
- To-Let route loading skeleton and recoverable error UI.

## Glossary

## Verification

- Local `/to-let/listings` and `/to-let/reviews` returned HTTP 200.
- Headless Chrome at 390×844 confirmed the public-review disabled notice, no horizontal overflow, and no page errors after fixing initial session hydration.
- No migration, public review submission, commit, or push performed.
- Repository API typecheck is not clean: existing unrelated router/test/schema errors remain. Full end-to-end review persistence is intentionally untested until migration approval.

## Domain terms

- Private rental comment: feedback within an authorized rental contract, not a public testimonial.
- Public review: tenant feedback explicitly opted into publication, with author name and rating.
- Migration: a database-structure change, not a rewrite or deletion of existing comments.
- Feature flag: a server switch that keeps unfinished/deferred functionality unavailable safely.

## Skill fallback

The requested grill-with-docs skill references grilling and domain-modeling, which were unavailable. Requirements, open questions and decisions are recorded here instead; this does not claim the missing skills were executed.
