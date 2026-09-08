# Warehouse POS customer entry — feedback interpretation

Date: 2026-09-08. Status: implemented; authenticated browser verification pending. The observations and line references below describe the pre-change code.

## Accepted implementation

The user approved the search-first flow. Inline search is provided in Order details and Complete Order, with matching customers after typing and an Add customer action only for successful no-match searches. Creation prefills name/phone and collects location as the existing address field. Saving selects the customer. Walk-In behavior and existing required-field rules are retained. “Unlock” is interpreted as adding a customer; no verification or account-unlocking behavior is introduced.

The selected customer's outstanding balance is refreshed through an active exact-ID lookup after checkout. The existing search endpoint accepts an optional customer ID while retaining its warehouse ownership restriction. No accounting posting rules or database schema were changed.

## Implementation verification

- Customer search-state and catalog tests: 5 passed. The database integration test includes exact-ID balance and cross-warehouse isolation assertions but was skipped because its opt-in database flag was not enabled.
- Full suite: 298 passed, 15 skipped, 9 failed due to environment configuration or Node incompatibility with Bun test imports.
- Web typecheck reports React type conflicts in existing calendar, field, and skeleton components; no diagnostics in the changed files. Frontend formatting/lint and whitespace checks passed.
- Standards and specification review completed; the stale selected-customer due finding was fixed and re-reviewed.
- Interactive warehouse verification remains pending: the local POS route redirected the browser session to the storefront.

## What the client is asking for

The latest client feedback asks for a search-first customer entry flow at the customer selection point. The cashier types a customer's name or phone number, sees matching existing customers, and proceeds to adding a customer when no match exists. The client rejects the current placement of the add-customer option and mentions name, phone number, and location as information for the adding process. Source: the client feedback quoted in the user message on 2026-09-08.

## Current implementation and gap

- The Order details area shows a customer card and a separate **Change** action; name/phone entry is inside a second **Select customer** dialog. Move the search entry to the customer point to avoid requiring this separate selection step. [POS page](../apps/web/app/warehouse/(management)/dashboard/pos/page.tsx:1077), [current search dialog](../apps/web/app/warehouse/(management)/dashboard/pos/page.tsx:1183).
- **New customer** is always available in the search dialog footer, regardless of whether a search has occurred or found a match. The proposed flow offers creation in the no-matching-customer state instead. [Current creation action](../apps/web/app/warehouse/(management)/dashboard/pos/page.tsx:1256).
- Search by name or phone already exists, is limited to the signed-in warehouse's POS customers, and returns name, phone, address, and outstanding due. This can support the requested matching behavior without introducing another customer directory. [Search API](../packages/api/src/routers/warehouse-pos.ts:511).
- The existing creation form already captures name, phone, and address; creation already selects the new customer for the order. Name is currently required, while phone and address are optional at creation. The feedback does not establish new required-field rules. [Form](../apps/web/app/warehouse/(management)/dashboard/pos/page.tsx:1269), [creation and selection](../apps/web/app/warehouse/(management)/dashboard/pos/page.tsx:559), [creation validation](../packages/api/src/routers/warehouse-pos.ts:570).
- The current requirements explicitly prescribe a `+` action that opens search/selection/creation. This older rule needs replacing with the clarified search-first flow if accepted. [Existing requirements](warehouse-pos-reference-gap-analysis.md:56).

## Proposed UX, distinguished from explicit feedback

1. Put a **Customer name or phone** input directly in Order details where the customer is identified.
2. After typing, show matching customers with enough details to distinguish them; choosing a result attaches that customer to the order.
3. When a completed search has no match, show **No customer found — Add customer** at that same point.
4. Open the customer creation form with name, phone, and location/address. Prefill the appropriate field from the search text, save, and select the new customer.

Steps 1–3 express the client's stated search-first intent. Result presentation, prefilling, and automatically selecting the saved customer are practical UX interpretations, not additional explicit client instructions. Auto-selection already exists in the current implementation.

## Original ambiguities (resolved by the accepted assumptions above)

- **“Customer's unlock process”** is unclear. The likely interpretation is adding/registering a customer, but it could refer to a separate unlocking or verification flow. Do not introduce OTP, approval, or account unlocking based on this phrase alone.
- **“Customer type/Entry”** appears to mean *typing/entering* a name or phone number, rather than adding a Retail/Wholesale customer-type selector. The surrounding sentence describes text entry and matches; the existing approved scope also excludes the Retail/Wholesale switch. [Scope decisions](warehouse-pos-reference-gap-analysis.md:10).
- **Location** can likely use the existing address field. A map, GPS location, structured area hierarchy, and mandatory phone/location fields are not established by the feedback.
- The message does not explicitly remove Walk-In Customer or define an empty-input behavior. Existing Walk-In and due-customer rules remain the baseline pending further direction. [Current customer rules](warehouse-pos-reference-gap-analysis.md:58), [due validation requirement](warehouse-pos-reference-gap-analysis.md:83).

No implementation should infer customer matching across all platform users; the current warehouse-scoped customer search is the relevant existing behavior.
