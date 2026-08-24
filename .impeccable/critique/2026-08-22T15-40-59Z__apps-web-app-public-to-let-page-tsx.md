---
target: To-Let landing page versus SERIES CREATION SYSTEM (3).pdf
total_score: 18
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 3
timestamp: 2026-08-22T15-40-59Z
slug: apps-web-app-public-to-let-page-tsx
---
# To-Let landing page PDF compliance critique

Method: dual-agent (Assessment A: independent design review; Assessment B: deterministic scan and live browser verification).

## Design health

| Heuristic | Score | Finding |
|---|---:|---|
| Visibility of system status | 2/4 | Error messaging is clear, but zero metrics appear before the data failure is disclosed. |
| Match with the real world | 2/4 | Rental concepts are familiar; generic shop chrome and mixed-language jargon increase translation effort. |
| User control and freedom | 3/4 | URL-preserved search and filters work; unavailable state has no direct retry action. |
| Consistency and standards | 2/4 | Internally consistent components, but PDF, site chrome and To-Let product language diverge. |
| Error prevention | 2/4 | Booked listings can retain Call, contradicting the signed-off rule. |
| Recognition rather than recall | 3/4 | Labels are visible and icons are supported by text. |
| Aesthetic and minimalist design | 2/4 | Polished but long, card-heavy and repetitive; failed data leaves large dead areas. |
| Error recognition and recovery | 2/4 | Plain error copy exists, but no retry or fallback inventory path. |
| Flexibility and efficiency | n/a | Marketplace landing surface. |
| Help and documentation | n/a | Marketplace landing surface. |
| **Total** | **18/32** | **Acceptable, with significant client-spec and operational gaps.** |

## Design-specificity verdict

Content-authored, composition-template. Bangladesh rental categories, listing IDs, booking language and the property-account/QR model are Bikalpo-specific. The lifestyle hero, rounded cards, pills, shadows and alternating neutral sections remain transferable to a generic property marketplace. The global Bikalpo Shop header also makes To-Let feel embedded rather than purpose-built.

## What works

- The macro order closely follows all four PDF pages: hero, metrics, rental types, listings, location, journey, reviews, owner CTA and footer.
- Responsive fundamentals pass at 1440×900 and 390×844 with no global horizontal overflow.
- Search and rental-type filters preserve URL state; labels, alerts, focus states and map title provide a sound accessibility base.

## Priority issues

1. **P0 — live renter journey blocked:** the real PostgreSQL database is missing the `tolet_unit_listing` relation, so counts are zero, listings fail, and the map has no supply. Restore the data path only with explicit database approval, then add a useful zero/failure fallback.
2. **P1 — booked listings can expose Call:** gate owner contact and booking/contract actions on `!isBooked`; retain read-only details/status only.
3. **P1 — Location Intelligence is incomplete:** Search Area, Draw Zone, radius, POIs, smart distance, commute time and live availability are absent. Implement them or revise the authoritative brief.
4. **P1 — trust/content contract differs:** the PDF's public Community Reviews form/feed is replaced by private contract-linked feedback, and the four-column ecosystem footer is largely absent. Decide the approved data/privacy model, then make the UI and signed-off document agree.
5. **P2 — mobile and recovery polish:** several touch targets are below 44px, the nine-chip filter row has weak scroll affordance, and there is no route-local loading or direct retry action.

## Section-by-section result

- Header: partial — shared product search/navigation differs from the To-Let-specific PDF header.
- Hero: match — headline and promise match; search/actions are useful additions.
- Metrics: partial and live-blocked — safer dynamic definitions, but current data failure presents zeros.
- Rental types: content match; counts depend on the blocked data path.
- Curated listings: partial — “সক্রিয়” replaces “ভেরিফাইড”; cards and carousel are structurally implemented but cannot be validated live.
- Booked rule: missing — Call remains possible in code.
- Location Intelligence: split layout matches; advanced search/map intelligence is missing.
- Tenant Journey: mostly matches; map-search and monthly-rent context are omitted.
- Community Reviews: missing as specified; current authenticated workflow is safer but materially different.
- Owner CTA: partial — ID/QR/booking exists; Verified Listing, Social Media Share and Tenant Management are missing.
- Footer: missing/partial — ecosystem roles, coverage, social links, contact details/hours and powered-by line are absent.

## Persona red flags

- **Jordan, first-time renter:** two different search concepts compete, while four zeros and an unavailable alert read as an empty marketplace rather than a temporary failure.
- **Riley, stress tester:** booked contact exposure contradicts the PDF; error-state links can loop back to the same empty section; failed data and true zero inventory are indistinguishable.
- **Casey, distracted mobile user:** the roughly 9,086px page has no persistent renter CTA, filters clip into a horizontal rail, and the failed map becomes a tall dead block.

## Minor observations

- Deterministic detector: 0 findings; manual browser/PDF comparison caught the material behavioral and content issues.
- Many CTA and carousel controls are 20–36px tall; carousel dots are 8×8.
- No public sort control exists and no route-local `loading.tsx` provides pending feedback.
- Browser console reports the public ORPC failure and a global logo aspect-ratio warning.

## Questions

1. Is the PDF a strict functional contract for radius/Draw Zone/POIs/commute/reviews, or should unavailable concepts be removed from the approved UI?
2. Should reviews be an exact public PDF-style feed, or a moderated public presentation backed by verified contract-linked data?
3. Should the first implementation pass address the database blocker plus P1 behavior, or remain UI-only?
