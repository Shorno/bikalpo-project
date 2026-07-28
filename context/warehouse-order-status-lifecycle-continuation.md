# Warehouse Order Status Lifecycle Continuation

Use this note when continuing the warehouse order status and dispatch/invoice flow work.

## Current Strict Flow

The active warehouse order lifecycle is:

```text
Pending Approval -> Approved -> Ready for Dispatch -> Partially Invoiced / Invoiced -> Fulfillment Mode -> Delivery Management / Self Pickup OTP
```

Fulfillment mode selection and self-pickup OTP verification are handled on the Dispatch Orders page. Rider assignment and delivery group creation remain on Delivery Management.

## Status Meanings

- `pending`: order is waiting for warehouse approval. Display as `Pending Approval`.
- `approved`: warehouse approved the order with quantity changes; retailer acceptance is still required before dispatch.
- `ready_for_dispatch`: order is approved and available on the dispatch orders page for invoice creation.
- `partially_invoiced`: at least one dispatch invoice exists, but some approved quantity remains uninvoiced.
- `invoiced`: all approved quantities have been invoiced.
- `confirmed`: legacy accepted status kept for compatibility. Treat as `approved` in filters and labels where needed.
- `processing`, `delivered`, `returned`, `cancelled`: legacy/customer/delivery states kept for compatibility.

## Approval Rules

- Normal warehouse approval with no item quantity changes sets:
  - `confirmedAt`
  - `readyAt`
  - `status = ready_for_dispatch`
- Warehouse approval with quantity changes sets:
  - `confirmedAt`
  - `status = approved`
  - no dispatch readiness until retailer accepts
- Retailer accepts warehouse modifications:
  - set `modificationAcceptedAt`
  - set `confirmedAt` if missing
  - set `readyAt`
  - set `status = ready_for_dispatch`
- Retailer rejects warehouse modifications:
  - set `modificationRejectedAt`
  - cancel the order

## Dispatch/Invoicing Rules

- Dispatch Orders is order-first for this phase.
- The page shows:
  - `Ready for Dispatch`
  - `Partially Invoiced`
  - `Invoiced`
- Full invoice creates invoice rows for every remaining approved quantity.
- Partial invoice requires selected order item quantities.
- Partial invoice quantity must be greater than zero and cannot exceed remaining uninvoiced quantity.
- Creating a partial invoice moves the order to `partially_invoiced`.
- Creating the final invoice that covers all approved quantities moves the order to `invoiced`.
- Dispatch uses a unified modal (`dispatch-order-modal.tsx`) for full/partial invoice strategy, item quantities, and delivery mode (`self_pickup` | `delivery`).
- `POST /warehouse/dispatch/orders/confirm` creates the invoice and sets `invoice.fulfillment_mode` in one transaction.
- Legacy invoiced rows without fulfillment mode can be configured via the same modal (`mode: configure`).
- Self pickup: OTP is generated on confirm; warehouse verifies via `POST /warehouse/dispatch/self-pickup/verify` in the modal. The shared dispatch charge calculation treats self-pickup as zero delivery charge.
- Delivery: invoice is saved with `fulfillment_mode = delivery` and appears in Delivery Management. Rider assignment is not done from dispatch.

## Key Implementation Files

- DB enum: `packages/db/src/schema/order.ts`
- Manual SQL patch: `packages/db/src/migrations/0012_strict_warehouse_order_flow.sql`
- Warehouse API: `packages/api/src/routers/warehouse.ts`
- Retailer purchase API: `packages/api/src/routers/shop-owner.ts`
- Dispatch UI: `apps/web/app/warehouse/(management)/dashboard/dispatch-orders/page.tsx`
- Dispatch modal: `apps/web/app/warehouse/(management)/dashboard/dispatch-orders/_components/dispatch-order-modal.tsx`
- Warehouse order management list: `apps/web/app/warehouse/(management)/dashboard/order-management/page.tsx`
- Warehouse order detail: `apps/web/app/warehouse/(management)/dashboard/order-management/[id]/page.tsx`
- Warehouse order table columns: `apps/web/app/warehouse/(management)/dashboard/order-management/_components/order-columns.tsx`
- Shop owner purchase hooks: `apps/web/hooks/use-shop-owner-api.ts`
- Shop owner order pages:
  - `apps/web/app/shop/(management)/dashboard/orders/page.tsx`
  - `apps/web/app/shop/(management)/dashboard/orders/[id]/page.tsx`
  - `apps/web/app/shop/(management)/dashboard/orders/tracking/page.tsx`

## Migration State

The database had real schema objects but an empty `drizzle.__drizzle_migrations` table. It was baselined to the local Drizzle journal through:

- latest journaled migration: `0010_bright_ricochet`
- latest `created_at`: `1780550699276`

After baselining, this command succeeds again:

```bash
pnpm --filter @bikalpo-project/db db:migrate
```

The strict order status enum values were applied manually and verified in Postgres:

- `approved`
- `ready_for_dispatch`
- `partially_invoiced`
- `invoiced`

## Important Caveat

The following manual SQL files are outside Drizzle's `_journal.json`, so Drizzle does not track them automatically:

- `packages/db/src/migrations/0010_invoice_fulfillment_modes.sql`
- `packages/db/src/migrations/0011_add_delivery_handoff_mode.sql`
- `packages/db/src/migrations/0012_strict_warehouse_order_flow.sql`

Future schema changes should prefer the normal generated flow:

```bash
pnpm --filter @bikalpo-project/db db:generate
pnpm --filter @bikalpo-project/db db:migrate
```

If adding manual enum SQL, make it idempotent with `ADD VALUE IF NOT EXISTS`.

## Validation Already Done

- Targeted Biome lint passed for changed files.
- `pnpm --filter @bikalpo-project/db db:migrate` succeeds after metadata baseline.
- The new `order_status` enum values were verified in the database.
- `pnpm --filter web build` compiled successfully, then failed during TypeScript on an unrelated existing invoice delivery status mapping missing `returned`.
- Broad web/db TypeScript checks still have unrelated existing errors in product/carton/backfill areas.

## Continuation Notes

- Keep `Approved` as a completed lifecycle milestone, but normal approvals should still auto-move to `ready_for_dispatch`.
- Use `confirmed` only as legacy compatibility, not as the primary new warehouse flow state.
- Any future delivery group / rider assignment work should use Delivery Management after fulfillment mode is set to `delivery`.
- Do not assign riders from the dispatch modal without a confirmed business decision to expand that scope.
