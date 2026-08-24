# Warehouse Damage Management: Primary-Source Research

**Scope.** This report uses only the supplied client brief (`C:\Users\Shorno\.codex\attachments\eac6ed5d-af27-41cc-b8dc-421fc34a3f3f\pasted-text.txt`) and repository source. No product code was changed.

## Recommendation

Build a dedicated warehouse damage workflow at:

- `/warehouse/dashboard/damage` — list, filters, unit-aware summaries
- `/warehouse/dashboard/damage/create` — draft/create and post
- `/warehouse/dashboard/damage/[entryId]` — immutable posted detail, proof, and reversal history

Add **Damage** inside the warehouse sidebar's existing **Stock Control** submenu, preferably beside **Expired Products** and **Stock Adjustment**. The route base is already `/warehouse/dashboard`, and Stock Control contains those adjacent workflows but no Damage item (`apps/web/components/dashboard/warehouse-sidebar.tsx:53-53`, `apps/web/components/dashboard/warehouse-sidebar.tsx:84-98`).

Do not implement warehouse damage as a UI wrapper that creates both a damage entry and a submitted stock adjustment. Both existing flows can deduct inventory: Shop Owner damage does so inside its transaction (`packages/api/src/routers/shop-owner.ts:9839-9878`), while warehouse stock adjustment does so when created as submitted and when a draft is submitted (`packages/api/src/routers/stock-adjustment.ts:336-385`, `packages/api/src/routers/stock-adjustment.ts:483-558`). A single atomic warehouse damage-posting service must own the damage record, stock/carton transitions, valuation snapshots, and audit event exactly once.

## Current-state findings

### Navigation and available workflows

- Warehouse navigation has no Damage destination; it exposes **Expired Products** and **Stock Adjustment** under Stock Control (`apps/web/components/dashboard/warehouse-sidebar.tsx:84-98`). Warehouse stock adjustment already accepts both `damage` and `loss` adjustment types and `damage`/`expired` reasons (`packages/api/src/routers/stock-adjustment.ts:205-219`).
- The Shop Owner portal has a complete three-page surface: list with KPI queries and create link (`apps/web/app/shop/(management)/dashboard/damage/page.tsx:106-162`), create/submit (`apps/web/app/shop/(management)/dashboard/damage/create/page.tsx:148-183`), and detail with a multi-line product breakdown (`apps/web/app/shop/(management)/dashboard/damage/[id]/page.tsx:159-227`). Its sidebar exposes Damage directly (`apps/web/components/dashboard/shop-owner-sidebar.tsx:89-95`). These pages are useful UI references, not a warehouse-ready domain implementation.

### Retail damage is shop-only and lacks warehouse traceability

- `damage_entry` has a required `shopId`; its header has type, description, proof, totals, staff/date, status, and creator, but no owner type or warehouse ID (`packages/db/src/schema/damage-entry.ts:32-89`). The API is a `shopOwnerProcedure`, validates `ownerType = "shop"` and `ownerId = userId`, and scopes entry numbers to `shopId` (`packages/api/src/routers/shop-owner.ts:9746-9785`, `packages/api/src/routers/shop-owner.ts:9809-9818`). List and detail are also scoped by `shopId` (`packages/api/src/routers/shop-owner.ts:9893-9950`, `packages/api/src/routers/shop-owner.ts:9952-9997`).
- A damage line has only inventory/variant IDs, integer `qty`, unit price/value, and note. There is no entry mode, operational-unit field, `stockEntry`/batch link, or physical-carton link (`packages/db/src/schema/damage-entry.ts:94-128`). The API likewise requires integer quantity (`packages/api/src/routers/shop-owner.ts:9749-9766`).
- Loss is valued from a caller-supplied price or, by default, the shop inventory retail price and then the variant base price (`packages/api/src/routers/shop-owner.ts:9801-9807`, `packages/api/src/routers/shop-owner.ts:9820-9837`). Those are selling-price inputs, not warehouse acquisition cost.

### Warehouse inventory has carton-aware state that current adjustments ignore

- Inventory is owner-scoped and supports `warehouse`; it stores decimal `availableQty`, plus `inCartonQty` and `activeCartonCount`. The schema explicitly defines loose stock as `availableQty - inCartonQty` (`packages/db/src/schema/inventory.ts:15-24`, `packages/db/src/schema/inventory.ts:30-72`).
- A physical carton belongs to a warehouse, contains exactly one variant, records pack count and weight, and has `active`, `reserved`, `broken`, `dispatched`, or `sold` status. Existing comments describe cartons as immutable and define their stock transitions (`packages/db/src/schema/carton.ts:21-46`, `packages/db/src/schema/carton.ts:47-82`).
- Warehouse stock adjustment reads and updates only `availableQty`; its item model is variant/quantity based (`packages/api/src/routers/stock-adjustment.ts:223-231`, `packages/api/src/routers/stock-adjustment.ts:281-304`). Both immediate posting and draft submission update only `availableQty`, without changing `inCartonQty`, `activeCartonCount`, or carton status (`packages/api/src/routers/stock-adjustment.ts:363-385`, `packages/api/src/routers/stock-adjustment.ts:510-532`). It is therefore unsafe as the posting mechanism for carton damage.
- The warehouse expired-products page is batch-oriented: its server reads `stockEntry` rows with an expiry date and returns their entry ID, batch number, quantities, acquisition price, and total cost (`packages/api/src/routers/warehouse.ts:11245-11300`, `packages/api/src/routers/warehouse.ts:11309-11340`, `packages/api/src/routers/warehouse.ts:11380-11411`). The row and bulk **Mark Damaged** actions only show “available soon” toasts (`apps/web/app/warehouse/(management)/dashboard/stock/expired/page.tsx:267-277`, `apps/web/app/warehouse/(management)/dashboard/stock/expired/page.tsx:857-868`).

## Client brief contradictions to resolve before build

| Conflict | Primary evidence | Required decision |
|---|---|---|
| Damage “Mode” is **Carton/Product**, but entry mode is **Loose/Pack/Carton**. | Client brief lines 13 and 65-68. | Use one canonical posting mode vocabulary. Recommended: `loose`, `pack`, `carton`, and `direct`, with “Product” as a UI grouping rather than a stored unit. |
| “Total Damage” is one aggregate number labelled **Units**, although rows mix cartons, raw counts, KG, and products. | Client brief lines 20-23, 28-34, and 69-72. | Do not sum heterogeneous operational units. Show totals grouped by unit (for example cartons, packs, kg, pieces) plus entry count and monetary loss. |
| The list models one singular **Product Name** per entry, while detail contains multiple product rows. | Client brief lines 26-34 and 61-73. | Treat an entry as a header with many lines; list “Products” as a count plus representative names, not a single product identity. |
| The sample carton arithmetic does not reconcile. DMG-2001 is 10 × 25 KG = 250 KG, while its detail shows 100 KG rice plus 80 KG sugar = 180 KG, yet says it matches; a 2 KG pack also cannot evenly compose a 25 KG carton. | Client brief lines 28-34, 53-54, and 63-76. | Never accept/display a claimed match. Derive totals from selected physical cartons or validated carton configuration and reject inconsistent conversions. |
| The brief offers **Submit Damage Entry**, then **Edit Entry** and **Delete Entry** without defining lifecycle boundaries. | Client brief lines 97-100 and 113-117. | Drafts may be edited/deleted. Posted entries must be immutable; corrections use an authorized, audited reversal/compensating entry. |

## Target domain and posting contract

1. **Ownership.** Either generalize damage headers to `ownerType + ownerId`, matching inventory, or add an explicit required `warehouseId` with a database constraint that exactly one owner kind is set. Every query and mutation must enforce the authenticated owner.
2. **Lines and units.** Store variant/inventory IDs, canonical operational quantity as a decimal, operational unit snapshot, posting mode, and conversion snapshot. Reuse the existing variant operational-unit rules rather than assuming integer “units”; stock adjustment already derives `operationalUnit` and enforces whole quantities only where the variant disallows decimals (`packages/api/src/routers/stock-adjustment.ts:248-279`, `packages/api/src/routers/stock-adjustment.ts:317-328`). Include direct-count products: stock entry already defines `direct`, and warehouse receiving persists direct entries in their configured operational unit (`packages/db/src/schema/stock-entry.ts:21-40`, `packages/api/src/routers/warehouse.ts:8415-8429`, `packages/api/src/routers/warehouse.ts:8472-8489`).
3. **Traceability.** Add optional/conditional `stockEntryId` for a batch/lot and physical `cartonId` links for carton mode. Expired posting should preselect its source batch. Because `stockEntry` is documented as a stock-in audit event and carries purchase and batch data (`packages/db/src/schema/stock-entry.ts:37-40`, `packages/db/src/schema/stock-entry.ts:89-114`), implementation must also establish the remaining lot balance/allocation instead of assuming the original received quantity is still on hand.
4. **Acquisition-cost snapshots.** At posting, snapshot acquisition unit cost, extended loss, currency, and costing method/source. Prefer the selected stock-entry cost for batch-linked damage; define FIFO/weighted-average allocation when no batch is selected. `stockEntry` already stores purchase price and total cost (`packages/db/src/schema/stock-entry.ts:93-100`), and the expiry query already exposes them (`packages/api/src/routers/warehouse.ts:11380-11410`). Do not reuse the Shop Owner flow's retail/base-price fallback.
5. **One atomic post.** In one transaction: lock/revalidate owner inventory and selected lots/cartons; insert header/lines/proofs/cost snapshots; apply the inventory transition; update carton states/counters; write the audit event; mark the draft posted. Use an idempotency key or draft-status compare-and-set to prevent retries/concurrent requests from double posting. For carton damage, decrement `availableQty` and `inCartonQty` by the selected cartons' packs, decrement `activeCartonCount`, and move those cartons to a dedicated terminal damage state (or an equivalent immutable disposition record). Loose damage must not consume `inCartonQty`.
6. **Lifecycle.** Drafts are mutable. Posted entries are read-only. Reversal creates a linked compensating movement with actor, timestamp, reason, and approval metadata; it never deletes the original evidence.

## Recommended page and API shape

### List page

- Header: **Damage Management**, scope subtitle, and **Add Damage Entry**.
- Search by Entry ID, SKU, product name, physical Carton ID, or batch number.
- Filters: posting mode (`loose`, `pack`, `carton`, `direct`), damage type (`physical`, `expired`, `lost`), status, and date range. Keep mode and damage type as separate concepts.
- KPIs: damaged quantities grouped by operational unit, acquisition-cost loss value, and total posted entries. KPI queries must honor the selected date/type/mode filters or clearly state when they are lifetime totals.
- Table: Entry ID, representative Products/SKU count, Damage Type, Mode, grouped Quantity, Loss Value, Entry By, Date, Status, and View. A multi-line entry should show “3 products,” not pretend it has one product name.
- Empty state: **No damage records found** with **Add First Entry** when there are no active filters; filtered empty results should instead offer **Clear Filters**.

### Create page

- Basic information: damage type, one posting mode for the entry, occurrence date, authenticated actor, and optional description/reference.
- Source picker changes by mode: unpacked warehouse inventory for loose/pack/direct; exact eligible physical Carton IDs for carton; expired batches can arrive preselected from Expired Products.
- Selected-line table: SKU, Product, Brand/Variant, source batch/carton, quantity with operational unit, conversion/derived total, acquisition unit cost, line loss, note, and remove.
- Proof gallery supports multiple images because the schema and client detail both describe uploaded images; the current shared uploader handles only one image at a time (`apps/web/components/ImageUploader.tsx:11-27`, `apps/web/app/shop/(management)/dashboard/damage/create/page.tsx:420-431`).
- Submit shows calculated unit-group totals and loss, requires confirmation, and posts through the single atomic service. Cancel returns without mutating inventory. Draft save is recommended if Edit/Delete must be supported.

### Detail page

- Basic info: Entry ID, warehouse, actor, occurrence/posted dates, type, mode, status, unit-group totals, and total acquisition-cost loss.
- Read-only line breakdown with source carton/batch links, conversion snapshots, cost snapshots, and notes.
- Proof image gallery, description, posting/reversal audit timeline, and reversal reason when applicable.
- Draft actions: Edit, Delete, Submit. Posted action: **Reverse Entry** only for an authorized role; never hard-delete or rewrite posted quantities.

### API surface

Use a warehouse-scoped router such as `warehouseDamage` with `list`, `summary`, `getByEntryNo`, `searchSources`, `createDraft`, `updateDraft`, `deleteDraft`, `post`, and `reverse`. Keep source search mode-aware, paginate list/search in SQL, validate all ownership on the server, and return typed operational-unit and costing snapshots rather than having the UI reconstruct them.

## Delivery phases

1. **Resolve semantics and schema:** approve canonical modes/units, grouped KPIs, ownership strategy, carton damage state, lot-balance approach, costing method, and reversal permissions; add migrations and backfill strategy.
2. **Build the posting core:** implement the single transactional service, owner checks, locking/idempotency, unit validation, batch/carton allocation, acquisition-cost snapshots, reversals, and focused integration tests.
3. **Expose warehouse API and pages:** add list/create/detail routes and Stock Control nav; reuse Shop Owner presentation patterns only after adapting warehouse ownership, units, cartons, batches, and lifecycle.
4. **Connect adjacent workflows:** make Expired Products “Mark Damaged” open a prefilled batch-linked draft; decide whether Stock Adjustment redirects damage/loss to the damage flow or calls the same posting core without creating a second stock movement; add reporting and migration/regression coverage.

## Verification matrix

| Scenario | Verify |
|---|---|
| Tenant isolation | Warehouse A cannot search, view, post, reverse, or link inventory/batches/cartons owned by B; shop behavior remains scoped and unchanged. |
| Loose/pack/direct product | Canonical operational unit is shown and stored; decimal quantity is accepted only when variant rules allow it; only eligible loose stock is deducted. |
| Physical carton | Only eligible active cartons of the line's single variant can post; `availableQty`, `inCartonQty`, `activeCartonCount`, and carton disposition all change together and reconcile. |
| Expired batch | Expired page opens a draft with `stockEntryId`; posting cannot exceed remaining lot/on-hand quantity and snapshots acquisition cost. |
| Valuation | Loss equals stored acquisition-cost snapshots and remains unchanged after later purchase/selling-price changes. |
| Atomicity and retry | Any failed line/carton/proof/audit write rolls back everything; concurrent/retried submit produces exactly one posting and one deduction. |
| Totals | Entry loss totals equal lines; quantities are grouped by operational unit and never collapsed into a misleading cross-unit “Units” total. |
| Lifecycle | Draft edit/delete works; posted edit/delete is rejected; authorized reversal preserves the original and restores stock/carton state through a compensating audit record. |
| Navigation/routes | Stock Control shows Damage; list, create, detail, deep links, loading/empty/error states, filters, and back navigation work at the recommended warehouse routes. |
