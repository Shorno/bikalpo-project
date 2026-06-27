# Delivery Portal Feature Parity Completion

## Summary
The new delivery portal has the core rider flow working: dashboard, assigned groups, start delivery, OTP delivered, failed, returned, and returns screens. Missing rider-facing parity from the old `/deliveryman/dashboard` is GPS tracking, payment collection, route ending/reconciliation, empty pack collection/submission, and dedicated performance/active-route pages. Admin delivery management actions should stay in admin/warehouse management, not inside the rider portal.

## Key Changes
- Add rider portal pages under `delivery/(management)/dashboard`:
  - `/active-route`: live route, stop list, call/map actions, periodic GPS ping.
  - `/empty-packs`: collect empty packs from delivered stops and submit packs.
  - `/reconciliation`: route payment/pack reconciliation and supervisor approval status.
  - `/performance`: detailed delivery stats using existing `deliveryman.getStats`.
- Extend delivery execution:
  - Start delivery with optional GPS check-in.
  - Delivered modal captures OTP, payment method, amount collected, transaction ID, and optional GPS.
  - Failed/returned actions include optional GPS.
  - Add call and Google Maps actions on each delivery stop.
  - Add an end-route action once all invoices are processed.
- Update navigation:
  - Sidebar and dashboard quick actions include Active Route, Empty Packs, Reconciliation, and Performance.
  - Keep existing Deliveries and Returns routes.

## API And Security
- Reuse existing `deliveryman` ORPC endpoints: `pingLocation`, `collectEmptyPack`, `endRoute`, `getReconciliation`, `submitPacks`, `getStats`, `markDelivered`, `markFailed`, and `markReturned`.
- Add a scoped deliveryman list endpoint for reconciliation/history groups, because current `getMyGroups` excludes completed groups.
- Fix returns access for the delivery portal:
  - Do not use generic `returns.getAll` for riders.
  - Add deliveryman/warehouse-scoped return list/detail/order-for-return behavior, limited to orders assigned to or delivered by the logged-in rider in the same warehouse.
  - Keep admin/salesman return access unchanged outside the delivery portal.
- No database migration is required; existing delivery group, invoice, GPS ping, empty pack, payment, and return fields already exist.

## Test Plan
- Rider can start a delivery and GPS check-in is sent when browser permission allows it.
- Rider can mark delivered with OTP plus cash/digital collection details.
- Rider can mark failed/returned and the action remains scoped to their own assigned group.
- Active Route sends GPS pings every 60 seconds only while a group is `out_for_delivery`.
- Rider cannot view or process returns for unrelated orders.
- Completed/partial groups appear in reconciliation and empty-pack submission flows.
- Admin delivery pages `/dashboard/admin/delivery` and `/dashboard/admin/delivery/[id]` still work.
- Warehouse assignment/management pages still work.
- Focused Biome checks pass for changed files; TypeScript is checked for changed areas while existing unrelated project errors are documented.

## Assumptions
- The delivery portal remains rider-only.
- Admin assignment/group creation stays in admin and warehouse management panels.
- The old `/deliveryman/dashboard` pages are reference only and should not remain the canonical rider experience.
