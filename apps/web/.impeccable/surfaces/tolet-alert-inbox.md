---
version: 1
slug: "tolet-alert-inbox"
primary_target: "apps/web/components/features/to-let/alerts/my-alerts-client.tsx"
related_targets: ["apps/web/components/features/to-let/alerts/to-let-alert-inbox.tsx", "apps/web/components/features/to-let/alerts/to-let-alert-manager.tsx", "apps/web/components/account/account-sidebar.tsx"]
---

# To-Let alert inbox

- Scope and mode: Operate; consumer rental-search inbox at `/account/to-let/alerts`, extending the existing account shell without redesigning it.
- Primary task: Scan matching rentals, open a property's details, and manage saved-search preferences.
- Hierarchy: A prominent header `Create Alert` button toggles the inline preferences form above `All Alerts`; the form is hidden by default. Closing returns focus to the header button.
- Visual authority: Preserve incumbent white surfaces, thin neutral borders, rounded cards, restrained primary-blue actions and unread indicators; retain the existing emerald header icon.
- Responsive layout: Results are full-width horizontal booking-style cards with a 13rem image column from the medium breakpoint; they stack on mobile. Preference fields become two columns from the small breakpoint. The account menu remains a mobile disclosure.
- Card anatomy: Received date and read-state heading, availability and top-right `View Details`; image carousel with photo count on the left, category/title/property/unit, right-aligned rent, location, room/size facts, facilities, available date and read controls on the right. Do not imply a booking with fake booking IDs, Pending or Cancel request actions.
- Matching contract: Category, location, and minimum size alone determine matches. Other saved preferences do not block notifications; any-category and any-location values include all options.
- Read state: Results and read status persist through the database-backed API. `View Details` requests marking that notification read; `Mark shown as read` affects only unread notifications on the current page.
- Navigation: The My Alert sidebar item shows the unread count, capped visually at `99+`; the collapsed To-Let group carries the same badge. Zero-count badges are hidden.
- States and controls: Loading, retryable inbox error, no matches, missing photo, unavailable listing, and pagination (12 per page); saved searches support pause/resume with pending controls disabled.
- Accessibility and review: Preserve labeled sections, image alternatives, contextual action labels and visible keyboard focus. Scoped frontend desktop/mobile review was completed by the implementation reviewer; this brief adds no separate runtime-verification claim.
- Guardrail: This is surface-specific documentation only; do not alter global `DESIGN.md`, the global sidecar, or unrelated design-document drift.
