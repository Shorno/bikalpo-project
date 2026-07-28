# ADR 0001: Owner-scoped fulfillment and one rider portal

**Status:** Accepted — 2026-07-19

Bikalpo will implement warehouse and retailer fulfillment behind one owner-scoped Interface whose warehouse and shop Adapters define tenant ownership and capability differences; invoice eligibility, open-group rules, group creation, rider availability, assignment, and order/invoice propagation remain inside that Module. Both warehouse-owned and shop-owned deliverymen use the canonical delivery-subdomain portal, while the former `/deliveryman/dashboard` entry redirects there and its deferred compatibility routes remain directly reachable but unlinked. This avoids two operational patterns and centralizes authorization, at the cost of requiring every shared query and mutation to carry an explicit warehouse, shop, or administrative owner scope.
