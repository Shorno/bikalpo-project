# ADR 0003: Retailer POS extends the owner-scoped counter module

**Status:** Accepted — 2026-07-20

Bikalpo will extend the existing physical warehouse POS records with exactly one nullable warehouse or shop owner and expose them through an owner-scoped POS Module. Warehouse and retailer Adapters retain their capabilities: warehouse wholesale and editable-price behavior remain available, while retailer Counter Sales use active shop inventory, locked retail prices, one tender, and immediate counter handover. Shared ownership, Walk-in Customer creation, stock validation, receipt records, payments, Held Carts, collections, and audit semantics stay behind this Module so retailer authorization cannot drift from the warehouse pattern.

Retailer checkout and Due collection use idempotency keys, and receipt numbers come from a database sequence. A named POS Customer with a phone is required whenever an Outstanding Balance remains. A Sale Void restores stock once and adds compensating payment-reversal records instead of deleting history. POS sales never create marketplace orders, fulfillment invoices, Delivery Groups, or rider work; customer and Sales views may project fulfilled online records without mutating them.
