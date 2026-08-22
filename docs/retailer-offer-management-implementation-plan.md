# Retailer Offer Management: Primary-Source Implementation Plan

## Scope and source hierarchy

This plan covers the retailer-first implementation of the two screens supplied in the current task:

- **[R1]** User-supplied specification: **MY OFFERS (STORE / WAREHOUSE)**, including the list, detail view, KPIs, filters, actions, and alerts.
- **[R2]** User-supplied specification: **CREATE OFFER (FROM TEMPLATE)**, including its seven steps, preview, actions, and system rules.
- **Repository source** is the implementation baseline. It does not override [R1] or [R2].

No web sources were used. This document does not add product ideas beyond [R1] and [R2]. Where the supplied specification is ambiguous or conflicts with the current Admin template contract, the decision is called out instead of being guessed.

The first implementation target is the authenticated **Shop Owner** portal. In repository terminology, that is the retailer portal authorization role; the role guard is `shop_owner` (`packages/api/src/index.ts:97-113`, `CONTEXT.md:11-13`). The existing retailer navigation entry is **Promotions** at `/dashboard/promotions`, and its page is currently a “Coming Soon” placeholder (`apps/web/components/dashboard/shop-owner-sidebar.tsx:246-259`, `apps/web/app/shop/(management)/dashboard/promotions/page.tsx:3-17`). The supplied heading still says **STORE / WAREHOUSE**, but warehouse delivery is outside the retailer-first implementation requested here.

## Exact required retailer content

This section restates the supplied contract without adding UI content.

### Screen 1: My Offers

The page header contains:

- **MY OFFERS (STORE / WAREHOUSE)**
- **Store:** the current store name, shown as “Ratul Store” in the example
- **Showing:** “All Offers” in the example [R1]

The **SEARCH & FILTER** area contains exactly:

- Search input: **Offer Name / Product**
- Status options: **All**, **Active**, **Scheduled**, **Expired**, **Draft**
- Type options: **All**, **Discount %**, **Flat Discount**, **Buy X Get Y**
- Date Range options: **Today**, **This Week**, **This Month**
- **Create Offer** action [R1]

The **KPI OVERVIEW** contains exactly four values:

- **Total Offers**
- **Active**
- **Scheduled**
- **Expired** [R1]

The **OFFER LIST** contains exactly these columns:

| Column | Required content |
|---|---|
| Offer ID | Generated offer identifier, such as `OFF-101` |
| Offer Name | Retailer-entered offer name |
| Product | Selected product, category/all-products label, or template-derived product summary |
| Type | `% Discount`, `Flat Discount`, or `Buy X Get Y` as shown by [R1] |
| Discount | Display summary such as `10% OFF`, `৳ 50 OFF`, or `Buy 10 Get 1` |
| Validity | Start and end date summary |
| Status | Active, Scheduled, Expired, or Draft |
| Action | **View** |

The **OFFER DETAILS** view contains exactly:

- **Offer Name**
- **Product**
- **Type**
- **Discount**
- **VALIDITY:** Start Date and End Date
- **TARGET:** Applicable To and Minimum Qty
- **PERFORMANCE SNAPSHOT:** Orders Applied, Total Discount, and Sales Generated
- **ACTIONS:** Edit Offer, Pause, and Deactivate [R1]

The **ALERTS** area contains the three documented alert categories:

- Offers expiring today
- Low-performance offers
- Scheduled offers starting tomorrow [R1]

### Screen 2: Create Offer From Template

The page header contains:

- **CREATE OFFER (FROM TEMPLATE)**
- **Store:** the current store name
- **Mode:** **Template Based Offer Creation** [R2]

#### Step 1 — Select Offer Template

The template chooser contains exactly these columns:

- **Template Name**
- **Type**
- **Description**
- **Action**, with **Select** [R2]

The supplied examples are `% Discount Template`, `Flat Discount`, `Buy X Get Y`, and `Bulk Discount`, followed by a **Selected:** summary [R2]. The data must come from Admin-created templates rather than hard-coded example rows.

#### Step 2 — Select Product / Category

**Apply Offer To** contains:

- Specific Product
- Category
- All Products
- **Select Product**
- **Variant**, shown as optional in [R2], with the example `5KG / 25KG`

#### Step 3 — Configure Offer Details

The step contains exactly:

- **Offer Name**
- **Discount Type**
- **Discount Value**
- **Minimum Quantity**
- **Maximum Limit (Optional)** [R2]

#### Step 4 — Set Validity

The step contains exactly:

- **Start Date**
- **End Date**
- **Time (Optional):** All Day / Custom Time [R2]

#### Step 5 — Target Settings

**Apply To** contains:

- All Customers
- Specific Customers
- Area Based
- **Area (if selected)** [R2]

#### Step 6 — Preview

The auto-generated preview contains exactly:

- **Offer Summary:** product and discount, minimum purchase, and validity
- **Estimated Impact:** Avg Discount and Expected Orders [R2]

#### Step 7 — Activate Offer

The status choices and actions are exactly:

- Activate Now
- Save as Draft
- **Save Offer**
- **Preview**
- **Cancel** [R2]

The implementation must enforce the supplied **SYSTEM RULES**:

- Template structure cannot be changed.
- Only allowed fields are editable.
- The offer automatically applies in POS / Orders.
- Expired offers automatically deactivate. [R2]

## Current repository capability inventory

### Admin template foundation: reusable

The current Admin template model already persists code, name, description, type, combo rule, Buy/Get products, benefit type/value, product/category/full-store scope, retailer/wholesaler targeting, location, minimum order, max per customer, total limit, validity, status, and two usage counters (`packages/db/src/schema/offer-template.ts:14-83`). Admin template statuses are exactly **active**, **draft**, and **disabled** at the API boundary (`packages/api/src/routers/admin-offer-template.ts:21-60`, `:210-235`).

The existing template table was added by `packages/db/migrations/add_offer_template_system.sql:1-36`, while Drizzle is configured to run migrations from `packages/db/src/migrations` (`packages/db/drizzle.config.ts:8-14`). The current Drizzle journal ends at `0054_product_review_multiple_entries` (`packages/db/src/migrations/meta/_journal.json:380`) and does not register the standalone offer-template SQL. A fresh environment therefore cannot rely on the normal migration runner to create this foundation yet.

The Admin API can list, create, update, and change the status of templates, but all of those endpoints use `adminProcedure`; there is no Shop Owner template-list endpoint (`packages/api/src/routers/admin-offer-template.ts:144-235`; repository-wide `offerTemplate` references are limited to this router and its Admin UI).

The Admin UI already supplies real templates, search by name/code, type/status filters, status KPIs, a View action, and template details (`apps/web/components/admin/offers/offer-management.tsx:153-225`, `:240-286`, `:289-431`, `:445-538`). These Admin components can supply display-formatting ideas, but they are not owner-scoped offer management.

The Admin template form already distinguishes Discount, Cashback, and Combo; supports product/category/full-store scope; has retailer/wholesaler targeting; and stores the documented validity and usage rules (`apps/web/components/admin/offers/offer-template-form.tsx:478-514`, `:516-687`, `:690-845`).

### Retailer offer ownership and management: missing

There is no retailer/store offer schema, no Shop Owner offer router, and no retailer offer application/audit record. Repository-wide `offerTemplate` usage is confined to Admin code, and `/dashboard/promotions` is still a placeholder (`apps/web/app/shop/(management)/dashboard/promotions/page.tsx:3-17`).

The existing `offer` and `combo_offer` tables are not a suitable owner-offer implementation: neither has a `shopId`/owner key, their product selections are text, and they use a simple boolean `active` rather than the retailer lifecycle in [R1] (`packages/db/src/schema/offer.ts:12-33`, `packages/db/src/schema/combo-offer.ts:11-28`). The existing `offer` API is also an Admin homepage-promotion system, and active rows are returned directly for homepage display (`packages/api/src/routers/customer.ts:3167-3214`). Reusing that model would violate both store isolation and the Admin-template “structure only” contract (`packages/db/src/schema/offer-template.ts:26-29`).

### Product and variant selection: partially reusable

The domain already separates a shared Core Product Identity from owner-specific Brand Products and Owner Variants (`CONTEXT.md:29-39`, `:61-67`). A product row carries creator ownership, while a Product Variant carries SKU, brand, packaging/unit fields, price, ordering rules, active state, and an optional shared `catalogVariantId` (`packages/db/src/schema/product.ts:173-217`, `packages/db/src/schema/product-variant.ts:72-102`, `:120-168`, `:212-230`).

The Admin template editor already requires a sellable variant for every Buy/Get product and stores variant ID, name, brand, SKU, price, and quantity (`apps/web/components/admin/offers/offer-template-form.tsx:294-325`, `:1170-1225`, `:1246-1335`). However, the stored `variantId` is the Admin-side Owner Variant ID; `OfferTemplateProduct` does not store `catalogVariantId` (`packages/db/src/schema/offer-template.ts:14-24`). It therefore cannot safely identify the equivalent retailer-owned variant without an explicit shared-identity mapping.

The retailer POS catalog already returns in-stock, owner-scoped variants and filters them by product, core product, brand, pack, and SKU (`packages/api/src/routers/retailer-pos.ts:175-264`). Its backing catalog resolves retailer inventory, retailer price, active variant details, and global/local SKU data (`packages/api/src/services/owner-pos-store.ts:18-41`, `:180-220`). This is the correct baseline for the Step 2 product/variant picker because it represents items the store can actually sell.

### Store scope, customers, and areas: reusable with limits

`shopOwnerProcedure` enforces the Shop Owner role, and owner APIs use the authenticated session user ID as the shop boundary (`packages/api/src/index.ts:97-113`). The retailer POS profile already returns the current shop ID and display name needed by both page headers (`packages/api/src/routers/retailer-pos.ts:150-172`).

The retailer customer search combines shop-owned POS Customers with consumers who have ordered from that shop, preserving a local customer ID and an optional linked consumer user ID (`packages/api/src/routers/retailer-pos.ts:266-342`). This can populate **Specific Customers**, but the specification does not define usage identity for anonymous walk-ins or the same person across POS and online orders.

The Shop Owner API already returns the active areas assigned to the current retailer (`packages/api/src/routers/shop-owner.ts:1726-1763`). This can populate **Area Based** targeting. The area model supports active hierarchical/geographic areas and seller-area mappings (`packages/db/src/schema/area.ts:14-69`).

### POS and online order execution: transaction foundations exist; offer application is missing

Retailer POS sales are store-scoped and persist customer, variant-level sale items, subtotal, discount, total, and timestamps (`packages/db/src/schema/warehouse-pos.ts:159-229`, `:231-257`). The checkout API currently accepts a manual fixed/percentage adjustment, calculates it, decrements stock, and writes the sale atomically (`packages/api/src/routers/retailer-pos.ts:609-762`). It does not look up or record a retailer offer ID.

Online retailer orders are store-scoped, variant-aware, and persist subtotal, discount, total, items, and timestamps (`packages/db/src/schema/order.ts:71-120`, `:159-206`, `:209-230`). Current direct checkout explicitly writes `discount: "0"`, so there is no active-offer evaluation in online order placement (`packages/api/src/routers/customer.ts:4926-4967`).

Because neither POS sales nor online orders record which retailer offer was evaluated/applied, the repository cannot currently enforce per-user/total limits or calculate **Orders Applied**, **Total Discount**, and **Sales Generated** for one offer.

### Metrics, alerts, scheduling, and expiry: missing

The Admin template has `usedByCount` and `activeOffersCreated` columns, but no retailer-offer records currently update them (`packages/db/src/schema/offer-template.ts:82-83`; `packages/api/src/routers/admin-offer-template.ts:119-142`). There is no retailer KPI/alert endpoint, offer scheduler, auto-expiry worker, performance calculation, or low-performance rule in the current source.

## Gaps and decisions that must be resolved

These decisions are required by [R1]/[R2] but cannot be inferred safely from the supplied text or repository.

1. **Retailer status actions do not map to the documented statuses.** [R1] exposes Active, Scheduled, Expired, and Draft, but the detail actions also include **Pause** and **Deactivate**. The specification does not say which of the four visible states those two actions produce. Do not add Paused/Disabled statuses or invent a mapping without a decision.
2. **Scheduled status behavior is undefined.** [R2] only offers Activate Now or Save as Draft. It does not say whether a future start date automatically produces Scheduled, or whether Scheduled is explicitly selectable elsewhere.
3. **Expired versus deactivated is undefined.** [R2] says expired offers auto-deactivate, while [R1] displays Expired. The persistence transition and whether expired offers can be edited/reactivated are unspecified.
4. **Template type vocabulary conflicts.** Admin templates support Discount, Cashback, and Combo (`packages/api/src/routers/admin-offer-template.ts:26-36`). [R1] filters `% Discount`, `Flat Discount`, and `Buy X Get Y`; [R2] additionally shows a `Bulk Discount` template. Cashback has no retailer screen treatment, and Bulk Discount has no My Offers type filter.
5. **Variant optionality conflicts with sellability.** [R2] labels Variant as optional, but the established product requirement and current Admin editor treat the variant as the sellable item and require it (`apps/web/components/admin/offers/offer-template-form.tsx:319-325`). A decision is needed for Specific Product. Category and All Products also need a rule for whether the offer applies to every eligible owner variant or to selected variants.
6. **Admin and retailer variant IDs are not interchangeable.** The template stores an Admin Owner Variant ID but not the shared `catalogVariantId`. The instantiation rule must define how a template-selected identity maps to one of the retailer's stocked Owner Variants.
7. **“Template structure cannot be changed” conflicts with Steps 2–5.** The Admin template already contains scope, benefit, usage, and validity fields, while [R2] lets the retailer configure product/category, discount value, quantity/limit, validity/time, and targets. Each field needs an explicit classification: immutable, editable, or initialized/constrained by the template. The UI itself identifies likely editable fields, but it does not define whether Admin values are defaults or hard limits.
8. **Template changes after instantiation are undefined.** To keep an instantiated structure immutable, the system must know whether an Admin edit affects existing retailer offers or only future creations.
9. **Maximum Limit is undefined.** [R2] does not say whether it means uses per customer, total uses, maximum quantity, or another cap. The Admin template separately has max per customer and total usage limit (`packages/db/src/schema/offer-template.ts:74-76`).
10. **Custom Time is incomplete.** [R2] offers All Day / Custom Time but supplies no start-time/end-time fields, timezone rule, overnight behavior, or date-boundary semantics.
11. **Date Range filter semantics are undefined.** [R1] does not say whether Today/This Week/This Month filters by validity overlap, start date, end date, or creation date.
12. **Target identity is incomplete.** “Specific Customers” does not define whether targets are linked consumer users, shop POS Customer records, or both. Max usage for a Walk-in Customer is also undefined.
13. **Area application is undefined at POS.** Online orders have consumer area data, but a POS sale does not inherently have an area. The rule for an Area Based offer at the counter is not specified.
14. **Performance formulas are undefined.** Orders Applied can be counted from application records, but [R1] does not define whether Sales Generated is gross subtotal, net paid total, or only qualifying-item sales. It also does not define treatment of voided/cancelled transactions.
15. **Estimated Impact has no formula.** [R2] requires Avg Discount and Expected Orders but does not define the historical period, dataset, or prediction method.
16. **Low performance has no threshold.** The corresponding alert cannot be calculated until its measurement and cutoff are defined.
17. **Offer ID format is only exemplified.** [R1] shows `OFF-101` but does not define sequence scope, padding, or collision behavior.

## Phased implementation plan

### Phase 0 — Lock only the unresolved contract

Before schema work, record decisions for the 17 items above. This is not a feature-expansion phase; it prevents adding undocumented status values, filters, formulas, or editable fields.

Acceptance criteria:

- Every status action maps to one of the approved retailer statuses.
- The supported retailer template types match both the template chooser and My Offers filter.
- Variant selection/mapping and the exact editable field allowlist are explicit.
- Maximum Limit, custom time, date filtering, customer/area identity, performance, impact, and low-performance formulas are defined.

### Phase 1 — Data model and migration

Add an owner-scoped retailer offer model rather than modifying the existing public homepage `offer` table.

Required persisted capabilities:

- A generated Offer ID, `shopId`, source `offerTemplateId`, name, documented retailer type/status, and validity/time settings.
- An immutable copy/version of the selected template's structural rule so later owner edits cannot change the structure.
- Only the fields approved as retailer-editable in Phase 0: target product/category/all-products selection, mapped retailer variant where required, discount value, minimum quantity/unit, optional Maximum Limit, validity, target setting, and activation choice.
- Specific-customer and area selections when those target modes are used.
- An offer-application record linking one retailer offer to a POS sale or online order, with customer identity, applied discount, sales amount, and application timestamp. This record is the source for usage limits and the three performance values.
- Store/status/validity/template indexes and ownership/FK constraints needed by My Offers and checkout lookups.

Migration tasks:

1. Add the new schema exports and a normal numbered Drizzle migration after the current migration head.
2. Include or reconcile the existing `offer_template` definition in the journaled migration path so fresh databases and the already-migrated database converge safely.
3. Add constraints preventing cross-shop target/application references and duplicate application of the same offer to one transaction.
4. Add the shared variant identity required by the approved mapping rule; if `catalogVariantId` is chosen, persist it in the template product structure or a normalized template target.
5. Do not backfill the legacy public `offer` or `combo_offer` tables into retailer offers; they have no reliable shop ownership or structured target identity.
6. Replace Admin template usage counters with derived counts or update them transactionally from retailer offers so **Used By** and **Active Offers Created** become real.

Acceptance criteria:

- Two shops can create offers from the same template without reading or mutating each other's rows.
- Every Specific Product offer resolves to an approved sellable retailer variant.
- Every application is attributable to exactly one owner offer and one POS sale or online order.
- The schema represents only fields shown by [R1]/[R2] plus internal keys/audit data required to enforce them.

### Phase 2 — Retailer Offer API

Add a Shop Owner router using `shopOwnerProcedure` with endpoints supporting exactly the two screens:

- List active Admin templates that target retailers for Step 1, returning Template Name, Type, Description, and Select identity.
- Return the current shop name for the page headers.
- Search the current shop's sellable catalog variants and categories for Step 2.
- Return current-shop customers and assigned areas for Step 5.
- Preview/validate the Step 6 summary and the approved Estimated Impact calculations.
- Create a Draft or activate/schedule the offer from a template while rejecting changes to immutable template structure.
- List the current shop's offers with the documented search/status/type/date filters and KPI counts.
- Return the documented Offer Details and Performance Snapshot.
- Edit only approved fields; execute Pause and Deactivate according to the Phase 0 status mapping.
- Return the three documented alert counts/items.

All reads and writes must derive `shopId` from the authenticated session, never accept another shop ID as owner input (`packages/api/src/index.ts:97-113`).

Acceptance criteria:

- Draft/disabled Admin templates and templates not targeting retailers cannot be selected.
- Search and filter results, KPI counts, detail data, and alerts are scoped to the signed-in shop.
- Attempts to change an immutable structural field are rejected server-side, not merely disabled in the UI.
- Server validation enforces dates, quantity/value bounds, targets, usage limits, status transitions, and variant ownership.

### Phase 3 — Retailer UI

Replace the existing `/dashboard/promotions` placeholder with the exact [R1] My Offers page and add the [R2] Create Offer From Template flow.

My Offers tasks:

- Render the Store/Showing header, exact search/filter controls, four KPI values, exact table columns, View action, detail content/actions, and three alert categories from [R1].
- Keep type/status labels and actions exactly as documented after Phase 0 resolves their semantics.

Create Offer tasks:

- Render the seven steps in the supplied order and with the exact labels/options/content from [R2].
- Load templates from Admin data and shop product/category/variant data from owner-scoped APIs.
- Lock structural fields and permit edits only for the approved allowlist.
- Generate the required Offer Summary and Estimated Impact preview from server-validated data.
- Implement Save Offer, Preview, and Cancel, with Activate Now / Save as Draft as the only status choices shown in Step 7.

Acceptance criteria:

- No placeholder/example offer, KPI, performance, alert, or impact number is presented as real data.
- No UI sections, filters, option descriptions, help panels, or actions beyond [R1]/[R2] are added.
- The page displays the authenticated store name and never another store's offers/products/customers/areas.
- The saved offer reopens with the same allowed values and unchanged template structure.

### Phase 4 — POS/order application, lifecycle, and metrics

Create one shared offer-evaluation service and call it from both checkout paths:

- Retailer POS before totals are finalized (`packages/api/src/routers/retailer-pos.ts:646-734`).
- Direct online retailer order placement before `discount` and `total` are persisted (`packages/api/src/routers/customer.ts:4926-4967`).

The service must evaluate only the current shop's eligible offers, validity/time, target, minimum quantity, and usage limits; calculate the approved discount/Buy X Get Y result; and write the application record in the same transaction as the sale/order. It must not use the Admin template as an executable offer.

Add the approved lifecycle mechanism that moves future offers to Scheduled/Active as defined and automatically makes ended offers Expired/deactivated. Derive KPI, performance, and alerts from retailer offers and application records.

Acceptance criteria:

- The same qualifying basket receives the same documented offer result in retailer POS and direct online Orders.
- A non-qualifying, out-of-window, over-limit, wrong-customer, wrong-area, or wrong-shop transaction receives no offer.
- Application and usage counts are atomic and idempotent under concurrent checkout.
- Orders Applied, Total Discount, and Sales Generated reconcile to application records under the approved formulas.
- Offers ending at the approved boundary become Expired/deactivated automatically and no longer apply.

### Phase 5 — Tests and release verification

Add tests at the same layers used by the existing retailer checkout code, including router integration tests alongside `packages/api/src/routers/retailer-pos.integration.test.ts` and helper/service tests alongside `packages/api/src/services/owner-pos.test.ts`.

Required coverage:

- Migration/schema constraints, uniqueness, FKs, and indexes.
- Shop isolation for every endpoint and mutation.
- Admin template visibility by Active status and Retailer target.
- Immutable template structure and allowed field edits.
- Each documented type, status, target mode, validity/time mode, and usage limit.
- Product/category/all-products selection and required owner-variant mapping.
- Draft, activation/scheduling, expiry, Pause, and Deactivate transitions exactly as decided.
- POS and online order application, non-application, concurrency, and idempotence.
- KPI/filter/search/detail/performance/alert calculations.
- Exact seven-step UI content, My Offers content, and absence of extra content.

Release acceptance criteria:

- A Shop Owner can select an eligible Admin template, configure only permitted fields, preview it, save Draft or activate it, and then find it through the exact My Offers filters.
- View shows the exact [R1] detail and real performance values.
- Edit, Pause, and Deactivate follow the approved status contract.
- A qualifying offer applies automatically in both retailer POS and direct online Orders, then appears once in usage/performance totals.
- Expired offers automatically stop applying and appear as Expired.
- No owner can access another store's offer, targets, applications, performance, or alerts.
- The retailer screens contain exactly the supplied feature content and no extra product UI.

## Recommended implementation boundary

The retailer-first deliverable is `/dashboard/promotions`, its owner-scoped API/data model, and automatic application to that retailer's POS and direct online Orders. The existing Warehouse **Discount Offers** placeholder (`apps/web/app/warehouse/(management)/dashboard/discount-offers/page.tsx:3-17`) should remain outside this phase; [R1]'s shared Store/Warehouse wording does not supply enough warehouse-specific behavior to broaden the first implementation safely.
