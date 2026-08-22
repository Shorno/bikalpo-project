# Empty Pack Return and Exchange Flow — Repository Research

**Scope:** pre-implementation baseline investigated on 2026-08-14. Sources are first-party repository code, schema, migrations, and integration tests. Concurrent implementation changes were intentionally excluded from the baseline conclusions.

## Requested invariant

For one exact LPG cylinder variant and quantity `q`:

| Sale mode | Seller filled stock | Seller empty stock | Price |
|---|---:|---:|---|
| New | `-q` | no change | listed New price |
| Exchange | `-q` | `+q` | New price minus Exchange Credit |

The buyer must select New or Exchange before the order line is created. The simplest implementation assumes every Exchange selection represents a completed one-for-one empty return; it does not wait for cashier, rider, OTP, or physical verification.

## What already exists

### Retailer → consumer

- The database already stores per-variant `exchangeEnabled` and `exchangeCreditAmount`, plus New/Exchange snapshots and expected/collected/converted empty quantities on each order line. The exchange migration deliberately backfilled LPG variants from the older pack-return/deposit fields. Sources: [`product-variant.ts:182-198`](../packages/db/src/schema/product-variant.ts#L182), [`order.ts:230-247`](../packages/db/src/schema/order.ts#L230), [`0042_retailer_cylinder_exchange.sql:1-25`](../packages/db/src/migrations/0042_retailer_cylinder_exchange.sql#L1).
- Retailer product configuration restricts Exchange to the LPG family and requires a positive credit. Source: [`shop-product-config.ts:556-576`](../packages/api/src/routers/shop-product-config.ts#L556).
- Pricing behavior already matches the requested policy: New keeps the listed price and expects no empty; Exchange subtracts the configured credit and expects one empty per sold unit. Sources: [`retailer-cylinder-sale.ts:15-50`](../packages/api/src/services/retailer-cylinder-sale.ts#L15), [`retailer-cylinder-sale.test.ts:8-38`](../packages/api/src/services/retailer-cylinder-sale.test.ts#L8).
- Checkout exposes New/Exchange and persists the choice. At order placement, the API snapshots mode, New price, credit, and expected empty quantity. Sources: `apps/web/components/checkout/checkout-summary.tsx:153-208`, [`customer.ts:4541-4603`](../packages/api/src/routers/customer.ts#L4541), [`customer.ts:4690-4709`](../packages/api/src/routers/customer.ts#L4690).
- Both New and Exchange already remove the same filled quantity from retailer availability at order placement. The writer moves `availableQty` to `reservedQty`; delivery consumes the reservation by reducing only `reservedQty`. Sources: [`customer.ts:4712-4726`](../packages/api/src/routers/customer.ts#L4712), [`retailer-order-stock.ts:90-142`](../packages/api/src/routers/helpers/retailer-order-stock.ts#L90).
- The integration test proves the current Exchange result: price `100 - 20 = 80`, one filled cylinder reserved, then one verified empty record created and the filled inventory fully consumed. Source: [`retailer-order-flow.integration.test.ts:645-709`](../packages/api/src/routers/helpers/retailer-order-flow.integration.test.ts#L645).

### Current empty-pack persistence

- `empty_pack` is a collection/handoff record, not a live owner inventory. Its lifecycle is `collected → submitted → verified/rejected`; it is scoped specifically through nullable `shopId`, invoice, order item, delivery stop, variant, and quantity. There is no generic `ownerType`/`ownerId`, warehouse owner, balance, or movement type. Source: [`empty-pack.ts:20-77`](../packages/db/src/schema/empty-pack.ts#L20).
- Retailer Exchange currently creates the verified empty only inside `settleRetailerCylinderHandoff`, after accepted quantities are supplied. Missing returns are converted to New and charged back through the handoff balance. Source: [`retailer-cylinder-handoff.ts:65-166`](../packages/api/src/routers/helpers/retailer-cylinder-handoff.ts#L65).
- That settlement is called only from retailer delivery completion or retailer self-pickup; warehouse-owned self-pickup explicitly skips it. Sources: [`deliveryman.ts:657-672`](../packages/api/src/routers/deliveryman.ts#L657), [`self-pickup.ts:67-78`](../packages/api/src/routers/helpers/self-pickup.ts#L67).
- The older generic delivery collection route inserts an `empty_pack` row without `shopId`, while the retailer summary reads only rows whose `shopId` equals the retailer. Those generic records therefore do not contribute to the retailer dashboard. Sources: [`deliveryman.ts:2100-2147`](../packages/api/src/routers/deliveryman.ts#L2100), [`shop-owner.ts:1239-1258`](../packages/api/src/routers/shop-owner.ts#L1239).

### Warehouse → retailer

- Retailer warehouse-order input currently accepts variant, quantity, fulfillment mode, and conversion target, but no cylinder sale mode. Its pricing uses warehouse inventory/variant/carton prices and never applies Exchange Credit. Its order-item insert consequently leaves the shared cylinder fields at their New/default values. Source: [`shop-owner.ts:6291-6315`](../packages/api/src/routers/shop-owner.ts#L6291), [`shop-owner.ts:6483-6566`](../packages/api/src/routers/shop-owner.ts#L6483), [`shop-owner.ts:6675-6696`](../packages/api/src/routers/shop-owner.ts#L6675).
- Warehouse filled stock is not reserved when the retailer selects or places the order. The established B2B lifecycle reserves it atomically when the warehouse approves: `availableQty -= sourceQty`, `reservedQty += sourceQty`. Source: [`b2b-inventory-movement.ts:357-457`](../packages/api/src/routers/helpers/b2b-inventory-movement.ts#L357).
- Confirmed B2B receipt consumes the warehouse reservation and adds the corresponding filled quantity to the retailer's inventory. Cylinders use direct one-for-one transfer semantics. Sources: [`b2b-conversion.ts:337-369`](../packages/api/src/routers/helpers/b2b-conversion.ts#L337), [`b2b-conversion.ts:495-584`](../packages/api/src/routers/helpers/b2b-conversion.ts#L495), [`b2b-conversion.ts:619-642`](../packages/api/src/routers/helpers/b2b-conversion.ts#L619).

## Confirmed gaps

1. Warehouse orders have no New/Exchange selection, validation, price snapshot, or empty-stock credit.
2. `empty_pack` cannot represent warehouse-owned empty inventory or an auditable current balance.
3. The warehouse has no Empty Pack API, Stock Control navigation item, or page. The warehouse sidebar stops at Add Stock. Source: `apps/web/components/dashboard/warehouse-sidebar.tsx:84-97`.
4. The retailer has an Empty Pack page, but it is a read-only aggregation of handoff rows. Return to Supplier, Mark as Damaged, and Return Now are disabled. Sources: `apps/web/app/shop/(management)/dashboard/stock/empty-pack/page.tsx:68-74`, `:319-333`, `:396-399`.
5. Supplier-return tracking is not an operational write path. `purchase_item.returnPackQty` exists, but its only API reference is the retailer summary read; no mutation writes it. Sources: [`purchase.ts:124-138`](../packages/db/src/schema/purchase.ts#L124), [`shop-owner.ts:1270-1300`](../packages/api/src/routers/shop-owner.ts#L1270).
6. Crediting an empty at order creation without a reversal would be incorrect: retailer cancellation already restores the filled reservation, so empty stock must be reversed in that same transaction. Source: [`customer.ts:4760-4814`](../packages/api/src/routers/customer.ts#L4760).

## Recommended simplest implementation

### 1. Add owner-scoped empty stock and an idempotent ledger

Keep legacy `empty_pack` as delivery/handoff evidence. Add:

- `empty_pack_stock(ownerType, ownerId, variantId, availableQty, damagedQty, returnedQty, appliedToSalesQty)` with a unique owner/variant key.
- `empty_pack_movement(ownerType, ownerId, variantId, type, quantity, orderId, orderItemId, sourceKey, createdAt)` with a unique `sourceKey` such as `exchange:warehouse:<warehouseId>:<orderItemId>`.

The snapshot makes the page fast; the immutable movement makes retries idempotent and provides the requested Order ID hover details. Reuse the existing inventory owner vocabulary (`shop`, `warehouse`) rather than adding a warehouse-only table. Source for owner convention: [`inventory.ts:15-49`](../packages/db/src/schema/inventory.ts#L15).

### 2. Implement warehouse Exchange first

1. Add `cylinderSaleMode` to `placeWarehouseOrder.items` for exact LPG cylinder variants.
2. Resolve price with the existing cylinder pricing rules and persist `cylinderSaleMode`, `newUnitPrice`, `exchangeCreditAmount`, and `expectedEmptyPackQty` on the B2B order item.
3. Preserve the repository's approval lifecycle: in the same transaction that first reserves warehouse filled stock, credit warehouse empty stock for Exchange lines. This is the first existing authoritative seller-stock mutation and avoids changing every pending-order assumption.
4. Make the credit idempotent by order item. On rejection/cancellation after approval, release the filled reservation and append the exact inverse empty movement in the same transaction.
5. Do not call rider/cashier verification. The Exchange selection itself is the accepted one-for-one return under this simplified policy.

### 3. Apply the same rule to retailer sales

1. Keep current checkout, price calculation, order snapshots, and retailer filled-stock reservation.
2. Immediately after the reservation succeeds in the same order-placement transaction, credit the retailer's empty stock for every Exchange line.
3. Prevent the later delivery/self-pickup handoff from crediting the same order line again. It may remain as compatibility/audit code, but the unique movement source must make it a no-op for an already credited line.
4. Reverse the empty movement whenever the corresponding filled reservation is released because of cancellation, rejection, failed delivery, or return.

### 4. Build both pages from the same owner-scoped API

- Add **Stock Control → Empty Pack** for warehouse, then migrate the retailer page to the same query with `ownerType = shop`.
- Group by core SKU/product, then brand and exact variant/capacity. Show current empty balance as **Total**.
- Treat **In Market** as outstanding cylinders introduced through New sales: `New sold - later empties received`. This interpretation is inferred from the client layout and should be confirmed; historical In Market counts require a seed because pre-ledger New sales cannot be reconstructed reliably from current stock alone.
- Populate the Order ID hover/cursor from movement rows.
- Wire Create Damage, Return to Supplier, and Apply Sales as movements that atomically reduce `availableQty` and increase the appropriate destination bucket. Do not derive these actions from `purchase_item.returnPackQty`.

## Minimum verification matrix

| Flow | Assertion |
|---|---|
| Warehouse New | filled available/reserved moves by `q`; empty unchanged; New price used |
| Warehouse Exchange | same filled movement; warehouse empty `+q`; Exchange Credit applied |
| Retailer New | retailer filled `-q`; empty unchanged |
| Retailer Exchange | retailer filled `-q`; retailer empty `+q`; Exchange Credit applied |
| Retry / later handoff | no second empty credit for the same order item |
| Cancellation/rejection | filled reservation and empty credit both reverse atomically |
| Variant safety | brand/capacity mismatch cannot credit another variant |
| Ownership safety | warehouse and retailer balances never cross owner scope |

## Bottom line

The retailer-consumer half already has nearly all selection, pricing, snapshot, and filled-stock logic. The missing foundation is a generic empty-stock ledger. Warehouse B2B additionally needs New/Exchange input and pricing. Implement the owner-scoped ledger once, connect warehouse approval first, then connect retailer order placement and retire the handoff dependency for stock accounting.
