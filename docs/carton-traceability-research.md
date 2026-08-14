# Warehouse Carton Traceability — Repository Research and Implementation Plan

**Scope:** pre-implementation research completed on 2026-08-14. This report uses only the client attachment and first-party repository source, schema, migrations, and tests. It does not authorize or include product-code changes.

## Executive decision

The requested page should be introduced as **Inventory → Traceability → Carton Traceability**, immediately after the existing Stock Control item. The current **Carton Tracking** page is a useful starting point, but it is an active-stock drill-down rather than a complete traceability view.

The safest implementation is two phases:

1. Build a truthful read-only traceability page from the existing single-variant carton records and their order links. Move the current tracking entry out of Stock Control, retain the existing Create Carton flow, and preserve old URLs with redirects.
2. Add an immutable carton-event ledger, auditable actor snapshots, optional manual assignment, and—only if the client confirms it—mixed-variant carton composition.

Do **not** implement the client's mixed composition table by fabricating rows from the current carton totals. The current contract deliberately creates one variant per carton: the schema says cartons are single-product and immutable, while the creation page replaces the selected item rather than accumulating items. Sources: [`carton.ts:36-45`](../packages/db/src/schema/carton.ts#L36), [`create/page.tsx:122-166`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/create/page.tsx#L122), [`create/page.tsx:186-195`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/create/page.tsx#L186).

## Client-required page

The client attachment is `C:\Users\Shorno\.codex\attachments\f884c133-de60-43e9-ad4e-1ff87c479126\pasted-text.txt`; line references below refer to that file.

| Area | Client requirement | Attachment lines |
|---|---|---:|
| Header | Carton Tracking; search by SKU, product name, or Carton ID | 2-4 |
| Controls | Quantity and Price dropdowns | 6-7 |
| KPI | Total Cartons, change versus yesterday, total count, and cartons created today | 9-20 |
| KPI | Assigned Cartons, change versus yesterday, assigned count, and waiting orders | 12-20 |
| Primary actions | Assign Carton and Create Carton | 22 |
| Main list | Row selection; SKU/ID, Product Name, Variants Available, Carton Weight, Total Qty, Action | 26-37 |
| Composition | Hovering the variant cell shows product, setup formula, variant/color/size quantities, and total quantity | 40-60 |
| Details | Carton ID, product and current carton stock, weight, delivery type/cost, setup, MOQ, price | 62-77 |
| Audit/status | Created date, created by, status, linked Order ID/View | 79-81 |
| Item details | Product ID, product, brand, variant, quantity, price, remove; Add Row and Clear All | 83-91 |
| Commercial summary | Notes, subtotal, discount, VAT/tax, delivery, shipping, commission, total | 93-104 |
| Detail actions | Assign order and Break Carton | 107-111 |

### Client-document issues that must not become silent implementation assumptions

- The requested navigation name is “Carton Traceability,” while the attachment title is “Carton Tracking.” Use **Carton Traceability** in navigation and the page title; “Track cartons from creation to fulfillment” can explain the function.
- The aggregate list shows hundreds of cartons per product but its View action opens one specific Carton ID. A product summary cannot identify which physical carton to open. The normalized UI should expand/open a product's physical-carton list, then open one Carton ID.
- The hover composition quantities add to 12 pieces, while the stated total is 10. The page must calculate totals from stored rows, never copy the mock numbers.
- “50 KG (5 × 10 PCS)” appears to mean ten 5-KG units, but this formula is not defined. Show `quantity × unit/reference weight = total weight` with the variant's actual operational unit.
- The KPI examples conflict: 150 total cartons but +250 created today, and 150 total equals 150 assigned. KPI scope needs a signed-off definition.
- The three example item prices do not reconcile to the subtotal, and the displayed charges sum to 3,710 rather than 5,000. Financial totals must come from authoritative carton/order/invoice records.
- The detail shows Sold while still offering assignment, row editing, and Break Carton. Actions must be status-gated rather than copied literally.
- The client does not define lifecycle transitions, whether assignment means reservation, how Assigned becomes Sold, whether a broken carton can be restored, or permissions.

## What already exists

### Navigation and routes

- Warehouse navigation currently places **Carton Tracking** inside **Stock Control**, alongside Low Stock, Empty Pack, Expired Products, Stock Adjustment, Unit/Carton Inventory, and Add Stock. Source: [`warehouse-sidebar.tsx:66-100`](../apps/web/components/dashboard/warehouse-sidebar.tsx#L66).
- Existing routes already provide a four-step hierarchy: product aggregate, product variants, physical-carton list, and physical-carton detail. The main page links product rows to the product breakdown; physical carton rows link to the individual detail. Sources: [`carton-tracking/page.tsx:250-336`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/page.tsx#L250), [`[variantId]/page.tsx:234-283`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/[productId]/[variantId]/page.tsx#L234).
- The creation route is separate and already supports direct inline composition and pricing without requiring a saved configuration. It submits one `variantId`, quantity, price, optional delivery cost, storage area, and note. Source: [`create/page.tsx:186-217`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/create/page.tsx#L186).

### Physical carton and inventory model

- A physical carton has a public `CTN-YYYY-NNNNNN` ID, warehouse, optional legacy configuration, one variant, quantity (`totalPacks`), total weight, current status, barcode/QR, storage area, note, price, delivery cost, and timestamps. Source: [`carton.ts:47-139`](../packages/db/src/schema/carton.ts#L47).
- Current statuses are `active`, `reserved`, `broken`, `dispatched`, and `sold`. Source: [`carton.ts:21-34`](../packages/db/src/schema/carton.ts#L21).
- Assignment is represented by `reservedForOrderItemId` plus `reservedAt`; that order item belongs to an order and carries price, quantity, movement snapshots, and SKU snapshots. Sources: [`carton.ts:81-89`](../packages/db/src/schema/carton.ts#L81), [`order.ts:209-303`](../packages/db/src/schema/order.ts#L209).
- Inventory tracks available, reserved, in-carton quantity, and active carton count. Creating a carton increases `inCartonQty` without reducing `availableQty`; the unpacked amount is derived as `availableQty - inCartonQty`. Sources: [`inventory.ts:46-67`](../packages/db/src/schema/inventory.ts#L46), [`warehouse.ts:10208-10258`](../packages/api/src/routers/warehouse.ts#L10208).
- Packaged/direct unit quantities are represented by `totalPacks`; loose variants fall back to carton weight. This legacy name is operationally broader than “pack.” Source: [`carton-units.ts:1-27`](../packages/api/src/routers/helpers/carton-units.ts#L1).

### Current list and details UI

- The main page already has a search field, four KPI cards, product aggregate rows, variant labels, total weight, carton count, View action, pagination, and Create Carton. Sources: [`carton-tracking/page.tsx:117-220`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/page.tsx#L117), [`carton-tracking/page.tsx:250-350`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/page.tsx#L250).
- Its KPI definitions do not match the client: they are Total Products, Total Cartons, Total Units, and Active Locations. Units are hard-coded as `pcs`. Source: [`carton-tracking/page.tsx:194-220`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/page.tsx#L194).
- Product rows omit SKU/ID and do not provide row selection or a hover composition. Variant display is a set of labels, and View enters a separate product drill-down. Source: [`carton-tracking/page.tsx:250-336`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/page.tsx#L250).
- The current detail shows identity, single-variant composition, weight, quantity, remaining, location, barcode, creation time, price, delivery cost, note, and break/transfer/mark-empty actions. It still hard-codes `pcs`, and “Remaining” simply repeats the original quantity. Source: [`[cartonId]/page.tsx:251-375`](../apps/web/app/warehouse/(management)/dashboard/carton-tracking/[productId]/[variantId]/[cartonId]/page.tsx#L251).

### Current APIs and lifecycle

- `getCartonTrackingProducts` reads **only active cartons**, groups them by product, and searches only product name and joined variant label. It cannot find SKU or Carton ID despite the UI placeholder. Its KPIs are calculated from that active-only in-memory set. Source: [`warehouse.ts:10467-10599`](../packages/api/src/routers/warehouse.ts#L10467).
- `getCartonTrackingVariants` also reads only active cartons. Source: [`warehouse.ts:10606-10633`](../packages/api/src/routers/warehouse.ts#L10606).
- `getCartons` can filter active, broken, dispatched, and sold, but its input omits the schema's `reserved` status. It returns variant/config/storage data, not the linked order. Source: [`warehouse.ts:10349-10427`](../packages/api/src/routers/warehouse.ts#L10349).
- `getCartonById` loads config, variant/product/brand, and storage area, but not creator, reserved order item/order, invoice, or lifecycle events. Source: [`warehouse.ts:10429-10459`](../packages/api/src/routers/warehouse.ts#L10429).
- At B2B approval, cartons are selected FIFO from active stock and atomically changed to `reserved` with the order-item link; aggregate inventory moves from available to reserved. Sources: [`b2b-inventory-movement.ts:250-280`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L250), [`b2b-inventory-movement.ts:324-345`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L324), [`b2b-inventory-movement.ts:356-458`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L356).
- Cancellation/release restores reserved cartons to active and clears their assignment. Dispatch changes reserved cartons to dispatched. Sources: [`b2b-inventory-movement.ts:461-530`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L461), [`b2b-inventory-movement.ts:582-600`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L582).
- Completed receipt consumes the stock reservation and changes linked reserved/dispatched cartons to sold. Source: [`b2b-conversion.ts:540-596`](../packages/api/src/routers/helpers/b2b-conversion.ts#L540).
- The FIFO quantity contract has a focused test proving that ordering two cartons reserves the exact contents of carton IDs 11 and 12 rather than assuming a shared template quantity. Source: [`b2b-inventory-movement.test.ts:21-35`](../packages/api/src/routers/helpers/b2b-inventory-movement.test.ts#L21).

## Gap analysis

| Client capability | Current state | Required change |
|---|---|---|
| Separate Traceability group | Tracking is under Stock Control | Move the entry; add Traceability parent and compatibility redirects |
| SKU/name/Carton ID search | Placeholder promises all three; API searches name/variant only | Database-backed search across carton ID, variant SKU snapshots/current SKU, and product name |
| Quantity/price controls | Hard-coded variant chips only | Define filter ranges and sort direction; keep status/assignment filters too |
| Total/Assigned KPI trends | Active-only counts; no trends | Define KPI scope; current counts can be queried, but historical as-of trends require events or snapshots |
| Waiting Orders | Not returned | Define as eligible carton order lines awaiting allocation/approval and query the order lifecycle |
| SKU/ID and row selection | Missing | Add SKU and selection only when a real bulk action exists |
| Hover composition | Missing | Phase 1 popover shows the true single variant; mixed rows require a new composition model |
| View a physical Carton ID | Requires three drill-down pages | Add an expandable physical-carton list and direct detail route by public carton ID |
| Created By | No creator column; warehouse ID is ownership, not necessarily actor | Add auditable actor ID/name snapshot and creation event |
| Assigned order link | Link exists in schema but detail API omits it | Load `reservedForOrderItem → order`; retain link after sold |
| Delivery type | Exists on invoice, not carton | Derive from the linked invoice when present; show “Not assigned” otherwise |
| MOQ | Product-level configuration exists, not carton | Display product MOQ with its actual order unit; do not store a duplicate carton value unless it is a required snapshot |
| Item rows | One variant is embedded on carton | Render one truthful row now; add `carton_item` only after mixed composition is confirmed |
| Financial breakdown | Carton has price/delivery only; order has subtotal/discount/shipping/total; invoice has subtotal/discount/delivery/tax/grand total; no carton commission source | Separate carton commercial values from linked order/invoice totals; do not invent or double-allocate charges |
| Assign Carton | Existing lifecycle auto-assigns FIFO at approval | Treat client action as review/override of the approval transaction, not an unrelated status update |
| Full trace history | Only current status, created/updated, reserved, and broken timestamps exist | Add immutable events; legacy history cannot be reconstructed exactly |
| Correct unit labels | Several pages hard-code `pcs`/`packs` | Reuse operational-unit formatting for cylinder, unit, pack, pair, etc. |
| Mark Empty semantics | Current mutation marks an active carton `sold` without an order | Remove from traceability actions or introduce a distinct auditable event/status; do not call it a sale |

The invoice is the primary source already capable of supplying fulfillment mode, subtotal, discount, delivery charge, tax, and grand total. Source: [`invoice.ts:84-113`](../packages/db/src/schema/invoice.ts#L84). Order-level fields supply subtotal, shipping, discount, and total. Source: [`order.ts:116-136`](../packages/db/src/schema/order.ts#L116). There is no authoritative commission field in these carton/order/invoice schemas.

## Recommended navigation and route design

In the existing `Inventory` navigation group, replace the Stock Control child `Carton Tracking` with a collapsible sibling immediately after Stock Control:

```text
Inventory
├── Stock Control
│   ├── Stock Overview
│   ├── Stock
│   └── ...
└── Traceability
    └── Carton Traceability
```

Recommended routes:

| Purpose | Route |
|---|---|
| Overview and aggregate list | `/warehouse/dashboard/traceability/cartons` |
| Physical carton detail | `/warehouse/dashboard/traceability/cartons/[cartonCode]` |
| Create physical carton | keep `/warehouse/dashboard/carton-tracking/create` during Phase 1 |
| Old tracking routes | redirect to the matching traceability view; never return 404 |

Using the public `CTN-...` code in the detail URL makes search results directly addressable and avoids exposing the internal database ID. The existing creation operation belongs to stock control and can remain stable while traceability is introduced.

## Recommended Phase 1 page

### Overview

1. Header: **Carton Traceability**, explanatory subtitle, Create Carton button.
2. Search: SKU, product name, or exact/partial Carton ID.
3. Filters: status, assigned/unassigned, quantity range, price range; a separate Sort control for newest, quantity, or price.
4. KPIs:
   - **Live Cartons:** active + reserved + dispatched.
   - **Assigned Cartons:** reserved + dispatched.
   - **Created Today:** cartons whose `createdAt` is today in the warehouse timezone.
   - **Waiting Orders:** carton-mode order lines eligible for allocation but not fully allocated. This definition must be confirmed against the warehouse order queue.
5. Product summary table: SKU(s), Product, Variants Available, Total Weight, Live Cartons, Assigned Cartons, View.
6. Accessible composition popover on hover **and keyboard focus**. In Phase 1 it shows the one actual brand/variant, operational-unit quantity, unit/reference weight, total weight, and physical Carton IDs in the group.
7. Expanding/View shows the physical cartons for that product with Carton ID, variant, quantity/unit, weight, location, status, assigned Order ID, created date, and View Detail.

### Detail

- Identity: Carton ID, barcode/QR, status, storage location.
- Composition: single variant row in Phase 1 with SKU, product, brand, variant, operational quantity, reference weight, and price snapshot.
- Commercial: carton selling price and delivery cost. If linked, show a clearly separate **Order/Invoice summary** rather than implying all order charges belong to this carton.
- Audit: created date/actor, assigned date/order, dispatched date, sold date, transfer/break events when available.
- Notes.
- Actions gated by status:
  - active: Transfer, Break, and eligible Assign/Approve flow;
  - reserved: View Order; optionally release only through order cancellation/review;
  - dispatched: View Order/Delivery only;
  - sold: read-only;
  - broken: read-only.

Do not expose Add Row, Clear All, or item deletion on a created carton. The existing schema explicitly treats cartons as immutable; corrections happen by breaking and recreating. Source: [`carton.ts:36-45`](../packages/db/src/schema/carton.ts#L36).

## API plan

### Read APIs

Add typed endpoints rather than extending the active-only endpoints with more `any`-shaped responses:

```ts
getCartonTraceabilityOverview({
  search,
  statuses,
  assignment,
  minQuantity,
  maxQuantity,
  minPrice,
  maxPrice,
  sortBy,
  sortDirection,
  page,
  pageSize,
})

getCartonTraceabilityProductCartons({
  productId,
  ...same filters,
  page,
  pageSize,
})

getCartonTraceabilityDetail({ cartonCode })
```

All queries must scope `carton.warehouseId` to the authenticated warehouse. Search and pagination should run in SQL, not after fetching the warehouse's entire carton history. Detail should load variant/product/brand, storage, creator, linked order item/order, linked invoice/fulfillment, and events.

### Assignment API

Do not add `assignCarton({cartonId, orderId})` as an isolated status mutation. Existing approval simultaneously reserves concrete FIFO cartons and moves aggregate inventory; bypassing it would desynchronize carton and inventory balances. Sources: [`b2b-inventory-movement.ts:324-345`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L324), [`b2b-inventory-movement.ts:425-457`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L425).

If manual assignment is approved, extend the existing approval helper to accept validated `preferredCartonIds` per order item. In one transaction it must verify warehouse, variant, active status, exact requested quantity, and current availability; reserve the selected cartons; persist order movement snapshots; and update aggregate inventory. Keep FIFO as the default when no preference is supplied.

## Data model plan

### Required for reliable traceability

Add `carton_event` as an append-only audit ledger:

| Field | Purpose |
|---|---|
| `id`, `cartonId`, `warehouseId` | identity and owner scope |
| `eventType` | created, reserved, released, transferred, dispatched, sold, broken, price_changed, legacy_snapshot |
| `fromStatus`, `toStatus` | explicit transition |
| `actorId`, `actorNameSnapshot` | who performed it, even if the account is later renamed/deleted |
| `orderId`, `orderItemId` | business cause |
| `fromStorageAreaId`, `toStorageAreaId` | location trace |
| `quantitySnapshot`, `unitSnapshot`, `weightKgSnapshot` | immutable operational context |
| `sourceKey` | idempotency for retried lifecycle operations |
| `metadata`, `createdAt` | event-specific context and time |

Add `createdById` and `createdByNameSnapshot` to `carton` for fast detail reads, while treating the event as the audit source. Add indexes on `(warehouseId, createdAt)`, `(cartonId, createdAt)`, `(orderItemId)`, and a unique non-null `sourceKey`.

Backfill existing cartons with one `legacy_snapshot` event at migration time containing the current status and known timestamps. Do not claim this is a reconstructed lifecycle: historical transfers, dispatch time, price changes, and manual status changes are not recoverable from the latest row.

### Conditional: mixed composition

Only if the client explicitly confirms that one carton may contain multiple variants/brands, add `carton_item(cartonId, variantId, quantity, operationalUnitSnapshot, unitPriceSnapshot, weightKgSnapshot)`. Migrate each existing carton to one item. Then update creation, break, reservation, receipt, and inventory movement atomically across all item rows.

This is a domain change, not merely a UI change. It conflicts with the current single-product rule and materially expands stock movement complexity. Phase 1 should render a one-row composition table from the existing carton variant.

## Lifecycle contract

The current effective lifecycle is:

```text
create → active
active → reserved       (B2B approval; order item linked)
reserved → active       (order cancellation/release)
reserved → dispatched   (delivery starts)
reserved/dispatched → sold (confirmed receipt)
active → broken         (return contents to unpacked stock)
active → sold           (current “Mark Empty”; should be removed or redefined)
```

Every transition should append an idempotent event in the same database transaction as the carton and inventory changes. The current row remains the fast current-state projection; the events become the trace.

## Phased implementation

### Phase 0 — decisions

Confirm four terms before coding: KPI scopes, Waiting Orders definition, whether mixed-variant cartons are genuinely required, and whether Assign Carton is a manual override or simply review of automatic allocation.

### Phase 1 — truthful page on existing data

- Add Traceability navigation and the new overview/detail routes.
- Retain and link the existing creation page.
- Add SQL-backed overview/detail APIs with all statuses, correct search, status/assignment/quantity/price filters, unit-aware labels, order links, and current-state KPIs.
- Render one truthful composition row per current carton.
- Remove edit controls from terminal cartons; remove/reword Mark Empty.
- Redirect old Carton Tracking URLs.
- No mixed-composition schema migration.

### Phase 2 — audit completeness and controlled assignment

- Add actor snapshots and `carton_event` with legacy backfill.
- Write events from create, reserve, release, transfer, dispatch, sell, break, and price update transactions.
- Add an event timeline to detail.
- Add manual preferred-carton selection inside the existing approval transaction if confirmed.
- Calculate accurate as-of-yesterday KPI trends from events.

### Phase 3 — mixed composition only if confirmed

- Add `carton_item`, migrate legacy cartons, update creation and all stock-movement paths, then enable multi-row composition editing before creation.
- Keep created cartons immutable; modification still means break and recreate.

## Verification plan

### Domain and API tests

- Search independently finds a carton by public Carton ID, current/source SKU, and product name, always owner-scoped.
- Each status filter includes `reserved`; pagination totals match filtered SQL rows.
- Direct products display cylinders/units, packaged products display packs, and no page hard-codes `pcs`.
- Current KPIs count the agreed live/assigned/waiting scopes; timezone boundaries for “Today” are tested for Asia/Dhaka.
- Detail exposes the correct linked order and never exposes another warehouse's carton/order.
- FIFO remains the default; preferred assignment, if added, reserves only selected active cartons of the exact variant.
- Concurrent assignment allows only one winner and leaves carton plus inventory balances consistent.
- Release, dispatch, receipt/sold, break, transfer, and price change append exactly one event per source key.
- Legacy snapshot rows are clearly labeled and do not invent missing history.

### UI tests

- Keyboard and pointer users can open/close the composition popover.
- Search, filters, sort, pagination, empty/error/loading states, and URL state work together.
- Aggregate View reveals physical Carton IDs; direct Carton ID links open the correct detail.
- Actions are visible only for allowed statuses and show confirmation/error outcomes.
- Linked Order opens the warehouse order detail.
- Old `/carton-tracking` bookmarks redirect without a 404.
- Responsive tables preserve identity, status, quantity/unit, and primary action on narrow screens.

### Regression tests

- Existing creation still moves the selected quantity into `inCartonQty` without changing the total available balance.
- Break returns the exact operational quantity.
- Approval continues to reserve exact FIFO carton contents; cancellation releases them; dispatch and receipt preserve the order link and end in sold.
- Existing direct-cylinder and variable-carton quantity tests remain green. Source: [`b2b-inventory-movement.test.ts:9-35`](../packages/api/src/routers/helpers/b2b-inventory-movement.test.ts#L9).

## Acceptance boundary for the first implementation

Phase 1 is complete when a warehouse user can open **Traceability → Carton Traceability**, search all physical cartons by SKU/name/Carton ID, filter and inspect all statuses including assigned and sold, view the true current single-variant composition, follow any linked order, and see only status-valid actions—without changing existing carton creation or B2B inventory invariants.
