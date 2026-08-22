# Admin Buy X Get Y Offer Templates: Primary-Source Research

**Scope.** This report reconciles the detailed **BUY X GET Y OFFER Template** brief supplied in the current task with the attached client document and the current repository implementation. No application code was changed, and no web sources were used.

## Source hierarchy and evidence limitation

1. The detailed task brief is the controlling source for the Buy X/Get Y creation form because the user explicitly asked for that structure and content to be matched as closely as possible.
2. The attached client document defines the surrounding management and consumption lifecycle: a global template system, created by Admin, selected and activated by business owners, with no direct execution (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:2-4`, `:30-39`, `:139-166`).
3. Repository source describes the existing implementation baseline, not the new feature contract.

The detailed Buy X/Get Y form text is present in the conversation but **not** in the attached `pasted-text.txt`; that file contains only the broader Offer Structure Management specification. Consequently, exact Buy X/Get Y field labels below are attributed to **Task brief — “BUY X GET Y OFFER Template”** rather than pretending they have a local line reference. All claims about the broader lifecycle and current implementation have local file-and-line citations.

## Conclusion

This feature is an **Admin-controlled global offer-template system**, not a directly executable homepage promotion. Admin defines a reusable structure; a Shop Owner or Warehouse Owner later selects it, customizes store-specific pricing, and activates an owner-scoped offer. The client document explicitly says the template itself does not apply a discount and users must activate it in their own store (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:38-39`, `:148-166`).

The current `/dashboard/admin/offers` feature does not implement this model. It manages directly public homepage offers, stores product names as text, and has only a boolean active flag (`apps/web/components/admin/offers/offer-management.tsx:109-128`, `apps/web/components/admin/offers/offer-form.tsx:57-92`, `packages/db/src/schema/offer.ts:12-33`). Active rows are exposed directly to customers on the homepage and public offer pages (`packages/api/src/routers/customer.ts:3167-3214`, `apps/web/app/(public)/offers/page.tsx:14-39`). The owner-side entry points are placeholders: Warehouse **Discount Offers** and Shop **Promotions** both say “Coming Soon” (`apps/web/app/warehouse/(management)/dashboard/discount-offers/page.tsx:3-17`, `apps/web/app/shop/(management)/dashboard/promotions/page.tsx:3-17`).

Therefore, matching the documentation requires a new template-oriented UI and domain contract, not merely relabeling the current offer dialog.

## Required lifecycle and ownership

### Admin responsibilities

- Admin creates and manages a global offer **structure/template**. It must not directly apply discounts to a store or customer (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:2-4`, `:148-157`).
- Admin chooses the template's benefit logic, applicable scope, target user groups, usage rules, validity, and template status (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:41-108`).
- The system must expose template-level usage metrics, at least **Used By** (stores) and **Active Offers Created** (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:139-145`).

### Business-owner responsibilities

- A business owner selects an Admin template, customizes pricing, and activates the resulting offer in its own store (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:150-163`).
- In repository terminology, the portal roles are **Shop Owner** and **Warehouse Owner**. “Retail Shop” and “Wholesaler” are onboarding business natures, not authorization roles (`CONTEXT.md:7-17`). UI copy may follow the client's “Retailer / Wholesaler” wording, but authorization and persisted ownership should use the actual portal roles.
- An owner controls its own configuration, pricing, and inventory, and an Owner Variant is distinct from the shared catalog identity (`CONTEXT.md:3`, `:29-39`, `:61-67`). Therefore, an Admin template should reference stable shared product identity, while an activated owner offer must resolve to owner-scoped sellable products/prices. This last sentence is a domain-model inference from the repository terminology, not an explicit client rule.

## Exact Buy X/Get Y creation-page content

The creation experience should be a full, sectioned template editor in the order below. Labels and examples in this section come from **Task brief — “BUY X GET Y OFFER Template.”**

### 1. Basic identity

- Page/title: **BUY X GET Y OFFER Template**.
- **Offer Name**, with the supplied example/default text `[ BUY X GET Y OFFER Template ]`.
- **Offer Description**, multiline.

### 2. Buy Product

- Section title: **BUY PRODUCT (Customer must buy these products)**.
- An **Add Buy Product Slot** card containing:
  - **Product Search** with placeholder **Search Product**.
  - A **Selected Product** summary showing **Product Name**, **Category**, and **Regular Price**.
  - **Buy Quantity**, phrased **Customer must buy [___] Quantity**.
  - Example: **Buy 2**.
- Action: **+ Add Another Buy Product**. The plural/repeat action means the Buy side must support one or more product slots, not one comma-separated text field.

### 3. Get Product

- Section title: **GET PRODUCT (Customer receives these products)**.
- An **Add Get Product Slot** card containing the same search and selected-product summary fields: **Product Name**, **Category**, and **Regular Price**.
- **Get Quantity**, phrased **Customer receives [___] Quantity**.
- Example: **Get 1**.
- The brief does not include **Add Another Get Product**. The exact documented minimum is therefore one Get-product slot; repeatable Get slots are unresolved.

### 4. Discount Type

- Mutually exclusive options:
  - **Free Product**
  - **Percentage Discount on Free Product**
  - **Fixed Price on Free Product**
- Examples:
  - **Buy 2 → Get 1 Free**
  - **Buy 3 → Get 1 at 50% Discount**
- The brief omits the value input needed by the percentage and fixed-price options. A conditional percentage/amount field is functionally necessary, but its label, currency behavior, and validation require a product decision.

### 5. Offer Validity

- **Start Date**.
- **End Date**.

The broader client document also models validity as a start/end range (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:83-95`).

### 6. Apply Location

- Mutually exclusive options:
  - **All Stores**
  - **Selected Stores**
  - **Warehouse**
  - **Online Store**
- If **Selected Stores** is usable, a store selector is functionally required, but the brief does not define its placement or selection behavior.

### 7. Limitations

- **Maximum Offer Use Per Order**.
- **Maximum Offer Use Per Customer**.

These are specific to the Buy X/Get Y brief. The broader document additionally has **Min Order Amount**, **Max Usage Per User**, and optional **Total Usage Limit** (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:83-95`). Do not silently substitute those broader fields for the two specific limitations.

### 8. Status

- Mutually exclusive options: **Draft**, **Scheduled**, **Active**.
- Actions: **Cancel**, **Save Offer**, **Activate Offer**.

The broader management document uses **Active**, **Draft**, and **Disabled** for template status and filtering (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:12-15`, `:98-108`). The combined lifecycle therefore needs all four meaningful states or an explicit mapping; see “Specification conflicts” below.

## Required Admin management page

The client document defines a management surface around the creation form:

- Search by **Offer Name / Code** (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:7-10`).
- Filter by **Type** (All / Discount / Combo / Cashback) and **Status** (All / Active / Draft / Disabled) (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:12-15`).
- KPI cards for **Total Templates**, **Active**, **Draft**, and **Disabled** (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:17-27`).
- A list with columns **#**, **Offer Name**, **Type**, **Benefit**, **Scope**, **Status**, and **Action**, where the documented action is **View** (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:30-39`).
- A template-detail view showing Offer Name, Type, Benefit, Scope, Target Users, Usage Rules, Validity, **Used By**, and **Active Offers Created**, plus the no-direct-execution note (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:111-151`).
- Empty state copy **No offer templates found** and action **Create First Template** (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:169-173`).

For this feature, **Buy X Get Y** is the specific Combo rule. The broader generic creation form also describes Discount, Cashback, and Combo templates, product/category/full-store scope, and Retailer/Wholesaler target checkboxes (`C:/Users/Shorno/.codex/attachments/2353a814-3cb8-466e-b1f1-5291c28d3cc1/pasted-text.txt:41-81`). Those other template types belong in the management taxonomy, but their full editors are outside this task unless explicitly requested.

## Current implementation inventory

### What can be reused

- The Admin route and navigation entry already exist at `/dashboard/admin/offers` (`apps/web/app/(dashboard)/dashboard/admin/offers/page.tsx:1-5`, `apps/web/components/dashboard/admin-sidebar.tsx:182-186`).
- The page already fetches Admin offers and performs create/update, activate/deactivate, and delete mutations (`apps/web/components/admin/offers/offer-management.tsx:41-74`, `:89-107`; `packages/api/src/routers/admin-offer.ts:75-207`).
- Existing shared UI primitives include cards, tables, dialogs, inputs, selects, switches, textareas, and pagination in the current management/form files (`apps/web/components/admin/offers/offer-management.tsx:16-35`, `apps/web/components/admin/offers/offer-form.tsx:11-38`).
- A product query hook already returns full Product relations through `client.product.getAll()` (`apps/web/hooks/use-admin-data.ts:4-12`; `packages/api/src/routers/product.ts:1407-1446`). Product rows include a category relation, and the Product schema has a decimal `price` field (`packages/api/src/routers/product.ts:1420-1442`, `packages/db/src/schema/product.ts:62-84`).
- A more precise Admin consumer-reference-price query already supports search and returns product name, category, variant, and `consumerPrice` (`packages/api/src/routers/product.ts:140-180`, `:196-247`, `:266-320`). This may be the better source for the brief's “Regular Price,” but choosing product-level price versus variant-level consumer reference price is unresolved.

### What must change

- Current page purpose/copy is **Offers — Manage homepage offers and promotions**, not template structure management (`apps/web/components/admin/offers/offer-management.tsx:109-128`).
- Current KPIs are Total Offers, average discount, and Active Offers, rather than Total Templates / Active / Draft / Disabled (`apps/web/components/admin/offers/offer-management.tsx:131-176`).
- Current page has no documented search or type/status filters; it renders a paginated table directly from all fetched rows (`apps/web/components/admin/offers/offer-management.tsx:47-82`, `:179-259`).
- Current columns are Title, Type, Discount, Badge, Priority, Status, Created, and edit/toggle/delete actions, not the documented management columns and View action (`apps/web/components/admin/offers/offer-columns.tsx:45-163`).
- Current empty state is **No offers yet. Create one to get started!**, not the specified template empty state and CTA (`apps/web/components/admin/offers/offer-management.tsx:185-193`).
- Current form is a small generic dialog for title/description, four merchandising categories, prices, a percentage, comma-separated product names, badge/banner/priority/dates, and a homepage Active switch (`apps/web/components/admin/offers/offer-form.tsx:200-288`, `:290-455`, `:457-547`). It has none of the structured Buy/Get slots, quantities, discount modes, locations, limitations, or multi-state status.
- Current persistence has one row with a text `products` field and boolean `active`; it cannot represent multiple Buy slots with quantities, a separate Get side, location scope, per-order/customer limits, or Draft/Scheduled/Disabled (`packages/db/src/schema/offer.ts:12-33`).
- Current API validates merchandising types such as Weekly Offers / Combo Deals and clamps a single percentage; it has no template lifecycle or usage tracking (`packages/api/src/routers/admin-offer.ts:8-73`).
- Current customer APIs expose every active Admin offer directly and the public UI displays it, which contradicts the client rule that an Admin template has no direct execution (`packages/api/src/routers/customer.ts:3167-3214`, `apps/web/app/(public)/offers/page.tsx:14-39`).
- No owner-facing flow currently selects a template, customizes it, or creates an owner-scoped offer; both relevant owner pages remain placeholders (`apps/web/app/warehouse/(management)/dashboard/discount-offers/page.tsx:3-17`, `apps/web/app/shop/(management)/dashboard/promotions/page.tsx:3-17`).

## Minimum domain/API capabilities implied by the documents

The final names and schema shape are implementation choices, but the system must be able to persist and query all of the following:

| Capability | Required data/behavior | Evidence |
|---|---|---|
| Template identity | stable ID/code, name, description, type | Client search/list/create fields (`pasted-text.txt:7-15`, `:30-52`) and task brief |
| Buy side | one or more product references, quantity per slot, display snapshot | Task brief |
| Get side | at least one product reference and quantity | Task brief |
| Benefit | Free / percentage / fixed-price mode and conditional numeric value | Task brief; numeric value is an identified omission |
| Validity | start and end timestamps | Task brief; `pasted-text.txt:83-95` |
| Location scope | all stores / selected stores / warehouse / online store, plus selected IDs where applicable | Task brief |
| Limitations | max uses per order and max uses per customer | Task brief |
| Lifecycle | draft, scheduled, active, disabled, with explicit activate/disable transitions | Task brief; `pasted-text.txt:12-15`, `:98-108` |
| Target owner roles | Shop Owner and/or Warehouse Owner authorization targets | `pasted-text.txt:77-81`; repository role mapping in `CONTEXT.md:7-17` |
| Owner instance | template ID, owner/store ID, resolved owner products, customized pricing, activation state | `pasted-text.txt:148-163`; owner product/pricing separation in `CONTEXT.md:29-39`, `:61-67` |
| Usage analytics | distinct stores using template and count of active derived offers | `pasted-text.txt:139-145` |

Structured product references must be stored by stable ID, not only copied display text. The existing `offer.products` column is explicitly a text/JSON-like compatibility field and is insufficient for per-product quantity and Buy/Get roles (`packages/db/src/schema/offer.ts:22-23`; `packages/db/migrations/add_offer_types.sql:16-29`). Names, category, and regular price may be returned as current product data and/or saved as snapshots for historical display, but the documentation does not define snapshot/update semantics.

## Specification conflicts and questions that should not be guessed

1. **Status vocabulary.** The Buy X/Get Y brief says Draft / Scheduled / Active; the broader management document says Draft / Active / Disabled. The safest domain supports all four, with Scheduled derived from or validated against a future start date. Product confirmation is needed if Disabled should instead be an action/state overlay.
2. **Discount value.** Percentage and fixed-price modes have no value field in the detailed form even though the example needs 50%. A conditional value input is required for a functioning editor, but its exact label and validation are unspecified.
3. **Get-side cardinality.** The brief explicitly provides “Add Another Buy Product” but no equivalent Get action. Implement one Get slot to match the document unless multiple Get products are confirmed.
4. **Selected Stores.** The location option exists, but the store-picker UI and whether selection means target/eligible stores are unspecified.
5. **Product identity and regular price.** The brief shows Product Name / Category / Regular Price but does not say product versus variant. Repository pricing is variant-aware, and Admin consumer reference prices are available (`packages/api/src/routers/product.ts:196-247`, `:266-320`). This must be decided before persistence is finalized.
6. **Admin-selected versus owner-selected products.** The detailed Admin form searches products, while the lifecycle says owners select a template and customize pricing. It is unclear whether owners may replace products or only map Admin-selected shared identities to their Owner Variants.
7. **Target Users versus Apply Location.** The broader form targets Retailer and Wholesaler, while the specific form uses All Stores / Selected Stores / Warehouse / Online Store. These are different dimensions and should not be collapsed without confirmation.
8. **Template activation versus owner activation.** An Admin “Activate Offer” action should make a template available for selection; it must not publish a discount directly. Owner activation is a separate transition (`pasted-text.txt:148-163`).

## Acceptance checklist for the Admin work

- `/dashboard/admin/offers` clearly identifies the feature as **Offer Structure/Template Management**, never as a directly applied homepage promotion.
- Search, type/status filters, four KPI cards, specified list columns, View detail, and the documented empty state are present.
- Creating Buy X/Get Y follows the task-brief section order and label wording.
- Buy-product slots are repeatable and each slot stores a product reference plus positive integer quantity.
- The Get side has at least one product reference plus positive integer quantity.
- Product selection displays Product Name, Category, and Regular Price from real catalog data.
- Discount mode is exclusive; Free requires no value, while Percentage and Fixed Price cannot save without a valid value once the missing-field decision is resolved.
- Start/end dates, location, max per order, max per customer, and lifecycle status are saved and restored when viewing/editing.
- Save and Activate are distinct; Admin activation only makes the template available to owners.
- Detail view exposes structure, scope, target users, usage rules, validity, Used By, and Active Offers Created.
- Existing owner-specific offer execution is not faked by publishing the Admin template through the current customer homepage endpoint.
- Empty/loading/error states and create/update/activation feedback are explicit.

## Recommended implementation boundary

For the requested Admin-panel work, implement the management surface, Buy X/Get Y editor, detail view, and template-oriented persistence/API contract. Do not claim end-to-end completion of “other users use this template” until Shop Owner and Warehouse Owner selection/customization/activation flows and owner-scoped offer execution exist; the current repository has no such implementation (`apps/web/app/warehouse/(management)/dashboard/discount-offers/page.tsx:3-17`, `apps/web/app/shop/(management)/dashboard/promotions/page.tsx:3-17`).
