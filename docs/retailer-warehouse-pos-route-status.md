# Retailer and Warehouse POS Route Status

This document identifies the active counter-sales surfaces and the deliberately deferred pages. Retailer POS is operated only by the authenticated shop owner in this phase.

## Active routes

| Responsibility | Warehouse route | Retailer route | Status |
|---|---|---|---|
| Product selection, customer, payment, Held Cart, checkout | `/warehouse/dashboard/pos` | `/dashboard/pos` | Active |
| Counter and fulfilled online sales | Warehouse POS history | `/dashboard/sales` | Active for retailer |
| Owner-scoped customer book and purchase history | Warehouse POS customers | `/dashboard/customers` | Active for retailer |
| Outstanding POS balances and collection | Warehouse POS Due collection | `/dashboard/finance/receivable` | Active for retailer |
| Receipt print and authenticated PDF data | Warehouse POS receipt | Retailer sale detail | Active |

The shared storage remains additive: existing warehouse rows keep warehouse ownership, while retailer rows carry shop ownership. Every record has exactly one owner. Retailer catalog selection uses active, positive shop inventory and locked retailer prices; Counter Sales hand products over immediately and never enter fulfillment.

## Deferred and unchanged routes

| Surface | Classification | Current use |
|---|---|---|
| `/dashboard/user-roles` | Deferred/static | Unchanged; no cashier accounts or permissions in this phase |
| Daybook | Deferred/static | Existing route remains unchanged |
| Sales Report | Deferred/static | Existing route remains unchanged |
| EMI | Deferred/static | Existing route remains unchanged |
| Shifts and cashier management | Missing/deferred | Shop owner performs every POS action |
| Barcode scanning and offline checkout | Missing/deferred | Product name and SKU search are active |
| Split tender and named payment accounts | Missing/deferred | One tender and optional transaction reference are active |
| Returns, item refunds, and exchanges | Missing/deferred | Full Sale Void is active |
| SMS receipt delivery | Missing/deferred | Print and PDF are active |
| Profit and COGS reporting | Missing/deferred | Not calculated by this release |
