# Consumer price management

Implemented from the client's September 2026 price-page wireframe at
`/dashboard/admin/product-price`. The existing setup-page shell, colors, cards,
typography and mobile controls are retained.

## Requirements and implementation

| Client requirement | Behavior |
| --- | --- |
| Global Reference Price, admin control | Admin-only reads, edits, exports and imports. Only admin-created reference products are included. Owner selling prices are never updated. |
| Product / Brand / SKU / Barcode search | Searches product/core names, variant names, brand names, product/core SKUs, generated variant SKUs, preferred local SKUs and canonical catalog SKUs. Displayed product/core IDs are searchable too. |
| Type → Category → Sub-Category → Core Identity | Cascading, URL-backed filters. Changing a parent clears its children and returns to page one. Reset Filter clears search and all four filters. |
| Category Navigation | A horizontally scrollable All Products + catalog-type strip, synchronized with the Type filter. The examples LPG, Grocery, Fashion and Footwear are product types in this catalog; configured names are retained (for example, Gas). |
| Product Price List | Each row is an actual admin product, showing its product ID and name, Selling Price, Last Update and Action. Individual disclosure controls and Expand All / Collapse All reveal only that product's variants. Core identity remains a filter, not a displayed product group. |
| LPG cylinders | One brand product per group. Variant, Exchange Price, New Cylinder Price, Last Update and Action. Accessories retain ordinary single-price fields. |
| Other products | One actual product per row, with Brand, Variant, Unit, Price, Last Update and Action in its expanded variant table. Products sharing a core identity stay separate. Expanded groups show the variant table directly, without a repeated identity, SKU or category breadcrumb, per the follow-up request. |
| Inline edit → Save | One editor at a time, keyboard Enter/Escape, pending state, validation, recoverable error and query refresh. Mobile editors occupy a full row. |
| Auto save log | Every changed row records actor ID/name, old/new ordinary or New prices, old/new Exchange prices, source and timestamp. Data and audit are committed together. Unchanged submissions do not create misleading audit entries. |
| Upload Price (Excel) | Real `.xlsx` import with preview, row-specific validation, duplicate-ID detection, a 10 MB file limit and up to 1,000 rows per transaction. A failure rejects the entire batch. |
| Export Price List | Downloads all matching rows across every page as `.xlsx`, including stable Variant Price IDs and import instructions. The previous CSV API remains available. |

Pagination operates on actual products; it never splits a product's matching
variants across pages. Summary counts cover all matching products and variants. Mobile layouts
retain units and update metadata beneath the variant instead of hiding them.

## Price model and interpretation

- For a cylinder, `product_variant_price.consumer_price` remains its full New
  price. The existing generated variant's `exchange_credit_amount` is set to
  `New Cylinder Price - Exchange Price`. Consumer storefront calculations keep
  using their existing model.
- Entering an Exchange Price enables exchange for a cylinder. Blank values in
  an exported workbook preserve unavailable exchange; uploads cannot silently
  disable it. Non-cylinder products reject an Exchange Price.
- Prices must be positive, fit `numeric(10,2)` and use at most two decimal
  places. Exchange Price cannot exceed New Cylinder Price. Amount differences
  are calculated in integer minor units.
- Historical rows without a log show their recorded date without inventing an
  administrator. New updates show the actual saved administrator name.
- The document's isolated “Purchase Price” text is treated as an inconsistent
  example inside the consumer reference-price scope. No purchase-cost field or
  inventory workflow is added.
- Barcode search uses the identifiers already stored by the catalog. There is
  no separate manufacturer/EAN barcode field in the current product model.

## Storage and verification

Migration `0084_consumer_price_log.sql` adds only the audit table and its lookup
index. Snapshot records intentionally survive later product/user deletion.
Deploy the migration with the application; the list reads the latest audit
author and successful edits require the audit table.

The database tests run against isolated in-memory PostgreSQL using PGlite and
do not connect to the configured application database. They cover grouped
pagination, search/filter parity, LPG conversion, generated-variant writes,
administrator attribution, owner isolation, batch rollback and export scope.
Workbook tests cover actual XLSX serialization and validation failures.

```powershell
pnpm exec tsx --test packages/api/src/consumer-price.test.ts packages/api/src/services/consumer-reference-prices.test.ts apps/web/lib/consumer-price-workbook.test.ts
pnpm --filter web check-types
```
