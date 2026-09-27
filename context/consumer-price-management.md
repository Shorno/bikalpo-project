# Consumer price management

Implemented at `/dashboard/admin/product-price` from the client's
`bikalpo_product_price_page_mobile_5col_fixed-1.html` reference. The September 28,
2026 revision keeps the client's functional structure and uses real catalog,
inventory and audit data. The follow-up restores the existing page's visual
design: management header, summary counts, shared buttons and tables, original
category tabs, application typography and filter styling. Only the new search
and filter arrangement and pricing behaviors are retained from the demo.

## Layout and actions

| Area | Implemented behavior |
| --- | --- |
| Main table | ID, Product Name, Selling Price, Last Update, Action remain visible on desktop and mobile. Names truncate; column widths stay 18/30/21/21/10 percent. At 760px of available content width and below, the table uses compact text without hiding columns, including tablets with an open dashboard sidebar. |
| Identity | One actual admin product per row, with an eight-digit display ID. Existing database IDs, SKUs and workbook IDs are unchanged. |
| Price disclosure | The arrow in Selling Price expands read-only variants. Expand All / Collapse All applies to the current page. Expansion is stored in the URL. Purchase Price and variant-detail links are temporarily removed while that flow is reviewed. |
| Pencil | Opens every active variant of that product in one editor, including when search matched a single variant barcode. LPG uses Variant / Exchange Price / New Cylinder Price; ordinary products use Variant / Price. Brand appears when needed to distinguish mixed brands. |
| Save / Cancel | Save validates and commits all edited rows in one transaction; Cancel restores saved values. Enter saves and Escape cancels. Errors retain the draft. Navigation and filter changes protect unsaved edits. |
| Last Update | Last five characters of the latest editor's authenticated Better Auth user ID and short date in Asia/Dhaka. No editor name is shown. The tooltip contains the full user ID/date. Historical records without an actor show a dash and their recorded date. |
| Search and filters | Full-width search; Type → Category → Sub-Category → Core Identity; Reset clears all four and search. The filter row scrolls horizontally on small screens. |
| Category navigation | Original scrollable tab styling for All Products + configured product types. All Products clears the type hierarchy while preserving search. |
| Typography | Inherits the existing application font and sizes. Demo font/size controls and their local-storage preferences have been removed. |
| Upload / Export | Removed from this page at the user's request, including the unused bulk-action component. Existing backend contracts and workbook utilities remain compatible. |

Search includes product/core names, variant names, brands, product/core SKUs,
generated and preferred local variant SKUs, canonical catalog SKUs, and display
IDs. A search match selects the whole product, preserving all its active
variants in the list. Pagination groups by actual product
rather than by core identity. Only admin-created reference products are included; owner selling
prices are not changed by reference-price edits.

## Purchase Price detail

The page and route `/dashboard/admin/product-price/[productId]` are retained,
but the pricing list no longer links to them, including from variant labels.
The retained route supports an optional variant and a safe return URL; its
existing Back and related-product navigation are unchanged.

The page includes actual image, identity, variant selectors, available
New/Exchange modes, quantity controls and reference totals; these controls do
not place an order. Product Information, Description and Reviews tabs use real
records. Inventory and minimum-order units come from the shared variant model,
so a 12 KG cylinder is counted in cylinders rather than kilograms.

Stock and recorded purchase costs are matched through exact generated variant
or canonical catalog identity, never through product names. Records retain
their owner, unit basis, receipt reference and available New/Exchange mode.
An owner selector scopes the selected variant. Costs are displayed as recorded,
not as a fabricated average or an editable global purchase price.

Only received/partially received purchase items with positive received quantity
and existing stock entries are included. The response caps stock at 200 records
and merged receipts at 200 and reports truncation. Product history shows the
latest 20 reference-price changes. Performance covers delivered marketplace
orders across matching variants; counter sales and undelivered orders are
explicitly excluded. Empty data is shown as unavailable rather than populated
with the prototype's Omera examples.

## Price model and storage

- `product_variant_price.consumer_price` remains the full New Cylinder Price.
  Generated variants retain the existing exchange-credit calculation:
  `New Cylinder Price - Exchange Price`.
- Entering an Exchange Price enables exchange for a cylinder. Blank workbook
  values preserve unavailable exchange; ordinary products reject exchange
  prices. Prices must be positive, fit `numeric(10,2)`, have at most two decimal
  places, and Exchange Price cannot exceed New Cylinder Price.
- Every changed row records old/new ordinary or New prices, old/new Exchange
  prices, actor, source and timestamp in the same transaction. Unchanged saves
  create no audit entry. Product-level saves reject another product's variants.
- Audit attribution uses the full `context.session.user.id` from Better Auth.
  The five-character suffix is display formatting only and is not guaranteed
  unique. It may include letters. Last Update and the retained history page
  show this suffix; they never substitute the current viewer for the last editor.
  Full IDs remain in the audit log after account deletion, and unchanged saves
  do not replace the previous editor's identity.
- Migration `0084_consumer_price_log.sql` supplies the audit table. The applied
  `0085_price_user_display_codes.sql` is retained as migration history;
  `0086_remove_price_user_display_codes.sql` removes its unused alias table and
  sequence without modifying price logs. The application no longer reads or
  allocates aliases. Deploy the updated application before applying this cleanup
  migration so an older running version does not access the removed table.
  The cleanup has been applied to the development database.

## Verification

Isolated PGlite database tests cover pagination and search, LPG conversion,
owner-price isolation, atomic product saves, full authenticated editor IDs,
unchanged-save attribution, colliding display suffixes, rollback, exact
inventory identity, receipt eligibility and delivered-order performance.
Workbook tests exercise actual XLSX serialization and validation.

All 16 pricing tests and the web TypeScript check pass after the ID change.
The live page was reloaded after alias cleanup and confirmed to display the
authenticated editor ID suffix without the editor name.

Browser checks for the layout revision covered 320px,
390px, 768px and 1440px layouts, the five visible columns, expansion, LPG and
ordinary editors, invalid-price validation, Cancel, a successful unchanged
Save, search/reset/category navigation, detail variant/type/quantity controls,
tabs and return-state restoration. Existing development prices were preserved.

```powershell
pnpm exec tsx --test packages/api/src/consumer-price.test.ts packages/api/src/services/consumer-reference-prices.test.ts apps/web/lib/consumer-price-workbook.test.ts
pnpm --filter web check-types
```

The client gap review in `product-price-client-gap-review.md` records the
pre-implementation comparison; this document describes the resulting behavior.
