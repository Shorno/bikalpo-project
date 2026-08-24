# Warehouse Expiry Tracking: Primary-Source Research

**Scope.** This report uses only current repository source, schemas, tests, and Git history. No application code was changed.

## Conclusion

The expiry feature is **partially implemented and currently disconnected at stock entry**.

- The warehouse product setup still has an **Expiry tracking** switch, and the selected value is stored on every generated warehouse product (`apps/web/components/features/product/components/core-product-config-form.tsx:1419-1444`, `packages/api/src/routers/warehouse.ts:7629-7652`). The warehouse product edit flow also submits `expiryEnabled` (`apps/web/app/warehouse/(management)/dashboard/products/[productId]/edit/page.tsx:56-89`).
- The warehouse **Add Stock** product query still returns both `trackingType` and `expiryEnabled` (`packages/api/src/routers/warehouse.ts:8115-8127`), but the current page renders only batch-number inputs. Its expiry and manufacture date state values have no setters and therefore remain empty (`apps/web/app/warehouse/(management)/dashboard/stock/add/page.tsx:231-235`, `apps/web/app/warehouse/(management)/dashboard/stock/add/page.tsx:1089-1118`, `apps/web/app/warehouse/(management)/dashboard/stock/add/page.tsx:1267-1287`).
- Add Stock nevertheless sends those permanently empty date values to both receiving APIs (`apps/web/app/warehouse/(management)/dashboard/stock/add/page.tsx:744-764`, `apps/web/app/warehouse/(management)/dashboard/stock/add/page.tsx:767-809`). Consequently, normal warehouse use cannot currently create a new expiry-dated `stock_entry` row.
- The Expired Products page is live data, not a hardcoded example. It queries `stock_entry` rows whose `expiryDate` is not null, then keeps only rows whose product still has `expiryEnabled = true` (`packages/api/src/routers/warehouse.ts:11245-11305`). Historical rows created before the UI regression can therefore remain visible.

## Intended lifecycle in the current model

### 1. Configure the product

The warehouse configuration route `/warehouse/dashboard/catalog/add/[coreProductId]` loads the shared core-product configuration form and submits its template details to `configureWarehouseCoreProducts` (`apps/web/app/warehouse/(management)/dashboard/catalog/add/[coreProductId]/page.tsx:22-57`, `apps/web/app/warehouse/(management)/dashboard/catalog/add/[coreProductId]/page.tsx:142-178`).

That form exposes two separate controls:

- `trackingType`: none, batch, or serial (`apps/web/components/features/product/components/core-product-config-form.tsx:1400-1416`)
- `expiryEnabled`: an independent switch labelled **Expiry tracking** (`apps/web/components/features/product/components/core-product-config-form.tsx:1419-1444`)

The default is off (`apps/web/components/features/product/components/core-product-config-form.tsx:1304-1328`). The server input also defaults it to false and copies it into the warehouse product template (`packages/api/src/routers/warehouse.ts:6818-6848`, `packages/api/src/routers/warehouse.ts:6889-6925`). On initial configuration it is written to each generated product; on edit it is updated on the existing product (`packages/api/src/routers/warehouse.ts:7629-7652`, `packages/api/src/routers/warehouse.ts:7222-7248`). The database product column is real and defaults to false (`packages/db/src/schema/product.ts:122-130`).

There is also a product-type rule system where `expiryAvailable` controls whether the shared full-product form shows the toggle and `expiryDefault` controls its initial value (`packages/db/src/schema/product-type-rule-setting.ts:34-43`, `apps/web/components/features/product/components/product-form.tsx:201-217`, `apps/web/components/features/product/components/product-form.tsx:1513-1522`). This availability/default mechanism is separate from the warehouse core-configuration form above.

### 2. Receive a dated batch

The durable batch record is `stock_entry`. It is explicitly defined as one stock-in event/batch and stores `batchNo`, `expiryDate`, and `manufactureDate` alongside quantity, supplier, cost, and storage data (`packages/db/src/schema/stock-entry.ts:37-40`, `packages/db/src/schema/stock-entry.ts:65-114`).

Both Add Stock server paths already accept and persist these fields:

- Direct receiving accepts date fields per line and inserts them into `stock_entry` (`packages/api/src/routers/warehouse.ts:8268-8297`, `packages/api/src/routers/warehouse.ts:8467-8497`).
- Loose/pack/carton receiving accepts the same fields and persists them to `stock_entry` (`packages/api/src/routers/warehouse.ts:8527-8556`, `packages/api/src/routers/warehouse.ts:8712-8747`).

The current Add Stock table is multi-product and multi-row, but its row model contains `batchNo` only—there is no row-level expiry or manufacture date (`apps/web/app/warehouse/(management)/dashboard/stock/add/page.tsx:179-191`). The correct UI location is therefore on each receiving row, or in a shared value with an explicit “apply to selected rows” action, because different batches in one receipt can have different expiry dates.

### 3. Surface expired and near-expiry batches

`getExpiredProducts` uses a default near-expiry window of 30 days (`packages/api/src/routers/warehouse.ts:11250-11264`). It calculates expired, near-expiry, or safe from each stored entry date, hides safe entries from the default `all` result, and supports status/category/supplier/search filtering (`packages/api/src/routers/warehouse.ts:11344-11360`, `packages/api/src/routers/warehouse.ts:11414-11454`).

The page calls this endpoint and renders its returned rows; it has no local fixture list (`apps/web/app/warehouse/(management)/dashboard/stock/expired/page.tsx:330-383`). A row shows the stored batch number, expiry date, original entry quantity, and loss value (`apps/web/app/warehouse/(management)/dashboard/stock/expired/page.tsx:752-781`). Expired rows can now open a batch-prefilled warehouse Damage entry (`apps/web/app/warehouse/(management)/dashboard/stock/expired/page.tsx:261-277`, `apps/web/app/warehouse/(management)/dashboard/stock/expired/page.tsx:842-867`).

## Missing and inconsistent pieces

### P0 — Add Stock lost the date controls

Git history identifies a concrete regression. Commit `e1f923e9` introduced the warehouse stock page with a conditional **Batch & Expiry** card. It showed Batch No when tracking was enabled and Expiry Date when `expiryEnabled` was true. Commit `3e530fef` (“update table”) removed that entire card during the table-first rewrite. Commit `750c2f11` later removed the state setters, leaving `expiryDate`, `manufactureDate`, and a legacy global `batchNo` as permanently empty state values while the submit payload still references them.

This is why the user-visible toggle can be enabled while no date control appears in Add Stock. The current `ProductResult.expiryEnabled` field is declared and fetched but never used by the page beyond its type definition (`apps/web/app/warehouse/(management)/dashboard/stock/add/page.tsx:63-82`, `packages/api/src/routers/warehouse.ts:8119-8127`).

### P0 — Expiry tracking and batch tracking disagree

The product UI and schema allow `expiryEnabled = true` with `trackingType = none`; they are independent values (`packages/api/src/routers/warehouse.ts:6833-6837`, `apps/web/components/features/product/components/core-product-config-form.tsx:1400-1444`). However, the direct-receipt API rejects `batchNo`, manufacture date, or expiry date whenever tracking type is `none`, and requires a batch number when it is `batch` (`packages/api/src/routers/warehouse.ts:8363-8410`).

The non-direct `addStockEntry` path has the opposite problem: it does not load the product's tracking or expiry settings and accepts date/batch strings without enforcing either toggle (`packages/api/src/routers/warehouse.ts:8563-8595`, `packages/api/src/routers/warehouse.ts:8731-8738`).

**Recommended invariant:** expiry-enabled inventory should be batch-tracked. Turning on expiry should either automatically select batch tracking or validation should require it. Each received expiry-enabled line should require a batch/lot number and expiry date. This is an inference from the repository's batch-level reporting model: without a batch identity, multiple receipts of one variant with different dates cannot be reconciled reliably.

### P0 — Purchase receiving does not feed expiry tracking

The legacy purchase schema can store `batchNo` and `expiryDate` on `purchase_item` (`packages/db/src/schema/purchase.ts:102-140`), and the legacy `createPurchase` endpoint accepts and saves them (`packages/api/src/routers/warehouse.ts:5802-5824`, `packages/api/src/routers/warehouse.ts:5848-5863`). But no current web page calls `createPurchase` or `receivePurchase`; the only web callers for stock receipt are Add Stock's `createStockReceipt` and `addStockEntry`.

Even if the legacy endpoint were called, `receivePurchase` increments aggregate inventory and marks items received but never creates a `stock_entry` or transfers the purchase item's batch/expiry data (`packages/api/src/routers/warehouse.ts:5903-5968`). Those receipts would therefore never appear in `getExpiredProducts`, whose sole source is `stock_entry` (`packages/api/src/routers/warehouse.ts:11266-11305`).

The newer warehouse Purchases detail page also contains no batch or expiry inputs and calls `receiveWarehouseSupplierShipment` (`apps/web/app/warehouse/(management)/dashboard/purchases/[id]/page.tsx:194-215`); that procedure is not currently present in the warehouse router. Expiry capture must eventually be part of the actual shipment-receipt transaction, not just manual Add Stock.

### P1 — The list reports original receipt quantities, not remaining lot stock

The expired query copies `entry.quantity` and `entry.totalCost` directly into every row (`packages/api/src/routers/warehouse.ts:11380-11411`) and builds KPI totals from those original values (`packages/api/src/routers/warehouse.ts:11456-11470`). It does not subtract sales, transfers, prior damage allocation, or other consumption from the batch. The page can therefore overstate current expired quantity and loss.

The batch needs a remaining-balance/allocation model (or a query over authoritative batch movements). Rows with zero remaining quantity should disappear; quantities and loss should use the remaining batch amount.

### P1 — Server validation is incomplete

Both receiving schemas accept manufacture and expiry dates as unrestricted optional strings (`packages/api/src/routers/warehouse.ts:8291-8294`, `packages/api/src/routers/warehouse.ts:8542-8548`). There is no explicit `YYYY-MM-DD` validation, no rule that expiry must be after manufacture date, and no requirement that an expiry-enabled product receive an expiry date. These checks should be centralized in the receiving service so every UI/purchase path follows the same contract.

### P1 — KPI filters do not match the visible list

The endpoint filters visible rows by status/category/supplier/search, but computes KPIs and analytics from the unfiltered `items` collection (`packages/api/src/routers/warehouse.ts:11414-11454`, `packages/api/src/routers/warehouse.ts:11456-11505`). A filtered table can therefore disagree with its summary. This is separate from the missing setup, but it affects trust in the expiry page.

## Why products could have appeared previously

There is no production seed or hardcoded warehouse expiry list in the repository. The only current source-code fixture with concrete past/future expiry dates is the opt-in warehouse Damage integration test, which creates temporary `stock_entry` rows and cleans them up (`packages/api/src/routers/warehouse-damage.integration.test.ts:157-190`).

The most likely explanation for previously visible real products is historical data created while the old Add Stock **Batch & Expiry** card existed. Removing the input UI did not delete old `stock_entry.expiryDate` values, and the current list deliberately continues to read those rows.

## Recommended repair sequence

1. Restore expiry capture to Add Stock as row-level data: Batch/Lot No, Manufacture Date, and required Expiry Date only for expiry-enabled products. Support a deliberate “apply to selected rows” shortcut for shared dates.
2. Establish the domain invariant: expiry-enabled products use batch tracking. Enforce the same rule in product configuration and both receiving APIs.
3. Validate dates and product settings server-side, including expiry after manufacture and required expiry for tracked receipts.
4. Move the same batch/date capture into the active supplier-shipment receiving flow and create `stock_entry` rows atomically with inventory updates.
5. Change Expired Products to report remaining batch quantity/cost, exclude fully consumed batches, and calculate summaries from the filtered result.
6. Add end-to-end tests for: toggle off/on, receiving two batches with different dates, near-expiry transition, expired listing, partial consumption, damage posting, and tenant isolation.

## Acceptance checks

| Scenario | Expected result |
|---|---|
| Expiry disabled | Add Stock does not request expiry metadata; the receipt is absent from Expired Products. |
| Expiry enabled | Batch tracking is enforced; batch number and expiry date are required per received row. |
| Mixed receipt | Each row retains its own batch and date; shared values apply only when the operator explicitly chooses them. |
| Direct/loose/pack/carton | All supported receiving modes enforce the same expiry contract and create dated `stock_entry` rows. |
| Purchase receipt | Receiving a supplier shipment creates the same batch-aware stock entry as manual Add Stock. |
| Partial consumption | Expired Products displays remaining lot quantity/value, not the original receipt quantity/value. |
| Historical data | Existing dated stock entries remain visible and can be reconciled or corrected without deleting audit history. |
