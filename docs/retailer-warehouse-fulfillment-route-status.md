# Retailer and Warehouse Fulfillment Route Status

This document records the operational route handoff and distinguishes active pages from ancillary, stub, legacy, and deliberately missing work.

## Active fulfillment flow

| Stage | Warehouse route | Retailer route | Status | Owner responsibility |
|---|---|---|---|---|
| Order Management | `/warehouse/dashboard/order-management` + `/[id]` | `/dashboard/incoming-orders` + `/[id]` | Active | Review, Order Approval, or cancellation |
| Dispatch Orders | `/warehouse/dashboard/dispatch-orders` | `/dashboard/dispatch-orders` | Active | Create invoices; retailer is full-only and idempotent |
| Delivery Management | `/warehouse/dashboard/delivery-management` | `/dashboard/delivery-management` | Active | Batch invoices into owner-scoped Delivery Groups |
| Delivery Team | `/warehouse/dashboard/delivery-team` | `/dashboard/delivery-team` | Active | Owner-scoped rider CRUD and availability |
| Assign Orders | `/warehouse/dashboard/delivery-team/assignments` | `/dashboard/delivery-team/assignments` | Active | Group-centric rider assignment |
| Rider Assignment | `/warehouse/dashboard/delivery-team/assignment` | `/dashboard/delivery-team/assignment` | Active | Rider-centric workload and assignment |
| Rider execution | delivery subdomain `/dashboard` and `/deliveries/[id]` | Same | Active | Start trip, OTP delivery, failed, and returned actions |
| Return History | delivery subdomain `/dashboard/returns` | Same | Active | Rider- and owner-scoped history |

Retailer operational labels use **Pending Approval** and **Approve Order**. The Consumer Journey remains a simplified projection and continues to show **Store confirmed**.

## Ancillary, stub, legacy, and missing routes

| Surface | Classification | Current use |
|---|---|---|
| Warehouse Delivery Areas | Ancillary | Functional warehouse configuration; not copied to retailer scope |
| Warehouse Delivery Tracking | Stub | Linked raw-fetch page; not a source for the active flow and not copied |
| `/deliveryman/dashboard` | Legacy redirect | Redirects all deliverymen to the canonical delivery subdomain |
| `/deliveryman/dashboard/active-route` | Legacy compatibility | Directly reachable, unlinked from active navigation |
| `/deliveryman/dashboard/empty-packs` | Legacy compatibility | Directly reachable, unlinked from active navigation |
| `/deliveryman/dashboard/reconciliation` | Legacy compatibility | Directly reachable, unlinked from active navigation |
| `/deliveryman/dashboard/performance` | Legacy compatibility | Directly reachable, unlinked from active navigation |
| Settlement workflow | Missing | Not built in this phase; existing rider collection fields are unchanged |
| Third-party delivery | Missing | Not built for retailer fulfillment |
| GPS, packs, reconciliation, performance rebuild | Missing | Deferred; legacy direct routes are compatibility only |

## Retailer capability differences

Retailer fulfillment reuses the warehouse desk pattern but disables quantity adjustment, partial invoices, self-pickup, and delivery-type selection. Approval moves directly to `ready_for_dispatch`; invoice creation always produces the one full `internal_delivery` invoice. Multiple compatible consumer invoices may share one store-owned Delivery Group.
