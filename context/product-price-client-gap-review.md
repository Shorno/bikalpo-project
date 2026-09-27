**Product price page — client comparison**

Reviewed 28 September 2026 against repository commit `57026b9b` and the supplied [client HTML](C:/Users/Shorno/Documents/bikalpo_product_price_page_mobile_5col_fixed-1.html). Target: `/dashboard/admin/product-price`.

The current page has most of the necessary pricing infrastructure. Matching this reference requires changes to the mobile table, row presentation, edit state, update attribution, and purchase-detail navigation. It does not require replacing the existing validation, audit transactions, or Excel workflow.

This is a source-based review of the client's HTML/CSS/JavaScript and the current React/API implementation. The browser tool rejected the local `file:` URL, so no rendered desktop/mobile or authenticated browser verification is claimed. Application code and the client's file were not changed.

**How to interpret the reference**

The HTML is a prototype, not a complete implementation. Its visible developer note is evidence of the client's intended behavior; its executable JavaScript shows what the demo actually does. Neither is treated as an instruction to modify the application during this review. Where they disagree, the discrepancy is called out below.

The clearest requirements in the [client's behavior note](C:/Users/Shorno/Documents/bikalpo_product_price_page_mobile_5col_fixed-1.html:95) are: disclosure opens read-only details; Edit expands the product and enables price fields; Save/Cancel appear in edit mode; Purchase Price opens the corresponding inventory/purchase detail; and Last Update uses a five-digit user ID and short date.

**Desktop and mobile structure**

Both client layouts retain this main-table order:

`ID | Product Name | Selling Price | Last Update | Action`

| Area | Client HTML | Current application | Update needed |
| --- | --- | --- | --- |
| Desktop columns | Five columns, fixed table layout; declared widths `8ch / 13ch / 9ch / 9ch / 4ch`. These are character-based CSS widths, not literal character limits or pixel measurements. | Same five headings; widths `16% / 36% / 21% / 20% / 7%`. | Preserve order; retune proportions and density to the reference. |
| Mobile columns | All five columns remain visible at widths up to 760px. | Below 768px, ID and Last Update columns disappear. Their values move under Product Name. The remaining three columns use `54% / 32% / 14%`. | Main mismatch: retain all five columns and use `colSpan={5}` for main-table detail/separator rows. Remove the duplicate metadata underneath the product name. |
| Product name | One line with ellipsis; complete name placed in `title`. Name and ID are plain text. | Wrapping name is also an expand/collapse button, with a chevron beside it. | Use compact name presentation and put the primary disclosure in Selling Price. Preserve access to the full name on touch and keyboard, not only hover. |
| Selling Price cell | Collapsed: down arrow. Expanded: up arrow plus `Purchase Price →`. Numeric prices appear in the expanded table. | Shows `From ৳…` or `Not priced`, plus variant count; clicking toggles details. No purchase link. | Change the cell's content and controls. Make the purchase link a separate navigation target so clicking it does not toggle the row. |
| Last Update | Example `88450 (10 Apr)`; no Admin label. | Latest variant update displays actor name plus `d MMM yyyy`, or a date without an actor. | Return and display an approved user display code plus short date. Keep full timestamp/identity available in secondary detail. |
| Product identifier | Eight-digit sample IDs, including leading zeroes. | Generated display IDs such as `PRD-000013`. | Resolve the intended display-ID mapping. Keep database IDs and workbook identifiers stable; do not truncate or invent identifiers to fit a column. |
| Expanded LPG prices | Three columns: Variant, Exchange Price, New Cylinder Price. Full-width detail row spanning five parent columns. | Usually five columns on desktop: Variant, Exchange Price, New Cylinder Price, Last Update, Action; an extra Brand column appears if needed. Mobile usually has four columns and update metadata beneath Variant. | Simplify the visible price grid if strict parity is required; move Save/Cancel into the product editor. |
| Other product types | Demo incorrectly reuses cylinder headings even for rice, electronics, and clothing. | Ordinary products have Brand, Variant, Unit, Price, Last Update, Action; mobile moves unit/update metadata underneath Variant. | Preserve correct ordinary-product pricing semantics. Apply the compact interaction pattern without labeling grocery prices as cylinder prices. |
| Search and filters | Search row, then four selects and Reset Filter in one horizontal row. Mobile filter row scrolls horizontally. | Search and Reset Filter share a row. Filters use four columns at large widths and two columns on mobile. | Move Reset Filter beside the filters and use a compact horizontal filter strip if matching the reference exactly. |
| Category strip | Horizontal product-type buttons. | Horizontal strip already exists and stays synchronized with the Type filter. | Retain dynamic catalog types and the functioning All Products action. Match spacing if needed. |
| Page framing | Search starts the product-price page; list title and Expand All sit inside one bordered panel. | Additional Consumer Price Management header and three statistics precede search; list heading sits outside its table card. Type separator rows also appear inside the table. | Reduce/remove extra framing and separator rows for strict visual parity, while keeping meaningful price-scope information somewhere concise. |
| Bulk actions | Upload at one end, Export at the other; stacked on mobile. | Additional Bulk Action heading/help text; both buttons are grouped with wrapping. | Align desktop placement and explicitly stack mobile buttons if strict parity is desired. Keep the existing workflow. |
| Result scope | All filtered sample products render together; no pagination. | Fifteen products per page, with all matching variants kept together. | Keep pagination for production; explicitly define whether Expand All means this page or every matching product. |

Primary evidence: [client table/CSS](C:/Users/Shorno/Documents/bikalpo_product_price_page_mobile_5col_fixed-1.html:16), [client mobile CSS](C:/Users/Shorno/Documents/bikalpo_product_price_page_mobile_5col_fixed-1.html:32), [current main table](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-table.tsx:81), [expanded variant table](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-table.tsx:225), [filters](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-filter-bar.tsx:128), [page composition](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-client.tsx:185).

**Every action and control**

| Control | Client intention / executable behavior | Current behavior and required change |
| --- | --- | --- |
| Search | Filters sample ID, name, type, category, subcategory, and core strings immediately. Placeholder mentions Brand/SKU/Barcode, but the sample data has no separate fields for these. | Real search already covers product/brand/core names and stored catalog/local SKUs, with 300ms debounce and URL state. Retain it; a separate manufacturer barcode field is not implemented. |
| Type / Category / Sub-Category / Core Identity | Four independent, hard-coded filters combine with the category strip. No cascading option lists. | Real cascading filters already clear invalid descendants and reset pagination. Retain this stronger behavior while matching the layout. |
| Reset Filter | Clears search, selects, selected category, expanded rows, and edit mode; resets Expand All text. | Clears URL filters/search/page and, when navigation changes the result state, clears the editor. Expanded rows are not cleared. Align the reset contract and handle unsaved drafts deliberately. |
| Category buttons | Select a type. `All Products` is broken because the handler returns when `data-cat` is empty. The trailing arrow also has no handler. | All Products and real type links already work. Keep those; if a trailing arrow is rendered, make it scroll the strip. |
| Individual down/up arrow | Toggles the product's details and clears that product's edit mode. This is the read-only entry point. | Name and price-summary buttons toggle expansion but do not clear the draft. Collapsing and reopening an edited row can restore edit mode. Introduce explicit view/edit transitions. |
| Expand All / Collapse All | Operates on filtered products and clears edit modes. Note describes view-only expansion. | Operates on currently loaded page groups and preserves the draft. Update the edit-state behavior; resolve dirty drafts before leaving edit mode. |
| Product pencil | Expands the product and toggles all its variant price fields into/out of edit mode. | Expands the product, then edits only its first variant. A single global draft means a second edit replaces the first draft. For parity, use a product-level draft containing all its editable variants. |
| Price cells / variant pencils | In view mode the client prices are plain text; editing is entered from the product pencil. | Current New/ordinary price cell and each variant pencil can start an edit. Remove or deliberately retain these extra entry points; they are not part of the reference interaction. |
| Save | Requested by the note, but not rendered or implemented in the demo. `Auto Save` is only a label; no input handler updates the data. | Real Save already validates and persists one variant, records an audit entry, refreshes data, and handles errors. Extend to an atomic product-level save if all variants become editable together. |
| Cancel | Requested by the note, but absent in the demo. Clicking the pencil again discards DOM edits via rerender. | Current X button and Escape cancel the one-variant draft. Preserve the behavior and provide a clear Cancel control within the product editor. |
| Purchase Price → | Appears in expanded Selling Price cell and opens the detail panel. The link passes only product ID, despite the note describing product/variant-specific navigation. | Missing entirely. Add real navigation with defined product/variant context, an authorized cost-data source, and a return path that restores list state. |
| Upload Price (Excel) | Visible button with no handler. | Already opens a file picker, parses `.xlsx`, validates up to 1,000 rows and a 10 MB limit, shows preview/errors, and saves transactionally. Preserve. |
| Export Price List | Visible button with no handler. | Already downloads an `.xlsx` for all matching variants across all pages, including stable IDs and import instructions. Preserve. |
| Font / Size controls | Change CSS variables; selected fonts are not downloaded. Mobile table text remains explicitly 10px. | Absent. Treat as prototype controls unless actual per-user typography settings are required. |
| UI Preview device / width / font / Reset Preview | Changes the wrapper width and CSS variables; not a real device emulator. | No production equivalent is necessary. Use actual viewport testing for implementation acceptance. |
| Detail Back | Hides the detail panel and restores the existing list DOM. | No purchase-detail transition exists from this page. The existing admin product detail returns to Product Catalog by default, so it would need a price-list return context. |
| Detail size/type radios | Native selection changes only; no dependent price/stock update handler. | Any reused/new detail page must bind options to real variants and recalculate the displayed price/stock. |
| Detail quantity − / + | Static buttons; displayed quantity never changes. | Only implement if quantity is meaningful for the chosen inventory/detail workflow. Do not add an ordering flow merely because it appears in this mockup. |
| Detail Product Information / Description / Reviews tabs | Buttons are static; all sections remain visible. | Existing admin product detail already has functioning content tabs and reviews. Reuse applicable components when defining the purchase detail. |
| Detail inventory-rule choices / related cards | Static text and example cards. | These are sample content, not implemented rules or navigation. Bind applicable sections to real records; omit unsupported figures instead of copying them. |

Evidence: [client rendering and event handlers](C:/Users/Shorno/Documents/bikalpo_product_price_page_mobile_5col_fixed-1.html:130), [current edit state and save](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-client.tsx:103), [current inline controls](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-table.tsx:239), [Excel actions](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-bulk-actions.tsx:71).

**Prototype problems that should not be copied**

- The top preview defaults to a 390px wrapper even on a desktop browser. Its selector changes the wrapper, while media queries still follow the real browser viewport. Selecting Mobile on a desktop therefore does not activate the mobile CSS. The tablet preset is 768px, above the prototype's 760px mobile cutoff.
- The prototype forces the mobile search row and font-control row to at least 620px inside a toolbar with hidden overflow. That can clip controls on a phone. Copy the five-column intent while fixing this overflow.
- Main-table text is forced to 10px on mobile; the pencil is only 34 × 30px and the disclosure is an unpadded glyph. Retaining five columns needs careful width/touch testing, not just shrinking all text and controls. Current mobile edit controls already use larger targets.
- The preview's initial top font-size selection says 10px while `--fs` starts at 14px. Reset Preview sets the variable to 10px but the lower selector to 14. These controls are not a reliable typography specification.
- Edited inputs never update `products`, make a network request, or write storage. Rerendering loses the entered prices. There is no real autosave, Save, or Cancel.
- Expand All compares the size of the global expanded set with the current filtered count. Hidden expanded products can make its decision wrong. Its label also becomes stale after individual toggles or filter changes.
- Product IDs are rendered as plain cells. The unused `data-id` event-handler branch does not make them clickable.
- Purchase detail only changes the name and ID. Brand, price, inventory, reviews, and other facts remain the hard-coded Omera example even when opening another product.

**Purchase Price is a functional gap, not just a missing link**

The [previous implementation notes](C:/Users/Shorno/WebstormProjects/bikalpo-project/context/consumer-price-management.md) explicitly excluded the purchase workflow as an inconsistent example. The supplied HTML makes the link and its destination explicit, so that earlier interpretation does not fully satisfy this reference.

The current page edits global admin reference prices. It must not substitute those values for actual purchase costs. The [inventory model](C:/Users/Shorno/WebstormProjects/bikalpo-project/packages/db/src/schema/inventory.ts:29) is owner/variant scoped, and [purchase items](C:/Users/Shorno/WebstormProjects/bikalpo-project/packages/db/src/schema/purchase.ts:180) contain a linked variant and unit cost under a warehouse purchase. Product, variant-price, generated owner-variant, and catalog-variant IDs are different identities and need an explicit mapping.

An [admin product detail route](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/app/(dashboard)/dashboard/admin/products/[productId]/page.tsx:1) already exists, with real images, brand-scoped variants, information, description, and reviews. It is not the requested purchase-cost view. It currently accepts a brand context, initializes selection to the first variant, and returns to Product Catalog. It has no complete purchase-cost/variant-stock/history/performance panel matching the mockup.

Before implementing that link, define whose inventory/cost is shown, whether the number is latest cost, batch cost, or another cost basis, and how a product-level link selects or lists variants. Then extend an authorized detail surface or add a dedicated one, preserving list filters/page on Back. Do not hard-code a generic Omera destination or send an admin into a warehouse page without the appropriate owner context.

**Last Update needs a stable display identifier**

The [price service](C:/Users/Shorno/WebstormProjects/bikalpo-project/packages/api/src/services/consumer-reference-prices.ts:83) currently returns only `updatedByName`. The [audit log](C:/Users/Shorno/WebstormProjects/bikalpo-project/packages/db/src/schema/consumer-price-log.ts:20) already stores raw actor ID and name, but the [user schema](C:/Users/Shorno/WebstormProjects/bikalpo-project/packages/db/src/schema/auth-schema.ts:4) has a text primary key and no dedicated five-digit user code. The existing user-management display label uses an application number or a role prefix plus an ID fragment; it is not the client's five-digit code.

Expose a real, stable display code if one is defined elsewhere in the business, or add an approved mapping. Preserve the canonical actor ID and audit history. Do not truncate an arbitrary auth ID or replace missing history with the sample `88450`. Rows without historical attribution need an honest fallback.

**Recommended implementation order**

1. **P1 — Main-table parity:** Keep all five columns on mobile; update widths, names, disclosure location, Last Update placement, detail colspans, and page framing. Preserve correct labels for non-cylinder products.
2. **P1 — Explicit view/edit flow:** Product pencil opens a product editor; arrow and Expand All enter view mode; Save/Cancel manage the whole product draft. Resolve unsaved changes on another edit, filtering, reset, collapse, and navigation. Current filtering discards the draft and another edit replaces it without a dirty-state check.
3. **P1 — Attribution:** Define the user-code source, return it from the price query, and format it consistently. Keep missing history distinguishable from known attribution.
4. **P1 — Purchase navigation:** Define the owner/cost context and variant identity, then implement the real destination and return navigation. This is the main scope decision beyond table changes.
5. **P2 — Toolbar and footer parity:** Reposition Reset Filter, compact the filter strip, and match bulk-button placement. Retain cascading filters, URL state, validation, and complete exports.
6. **P2 — Responsive verification:** Inspect collapsed, expanded, and editing states at 320, 390, 768, and 1440px, including zoom/text scaling, long product names, long IDs, and missing update authors. Test actual viewports, not the prototype's width selector.

Most presentation work is in [product-price-table.tsx](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-table.tsx), [product-price-client.tsx](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-client.tsx), and [product-price-filter-bar.tsx](C:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/product-price/product-price-filter-bar.tsx). Attribution and product-level saving also affect [consumer-reference-prices.ts](C:/Users/Shorno/WebstormProjects/bikalpo-project/packages/api/src/services/consumer-reference-prices.ts) and the [product API router](C:/Users/Shorno/WebstormProjects/bikalpo-project/packages/api/src/routers/product.ts:1296).

For product-level Save, the service already accepts multiple updates transactionally. Add an appropriately scoped inline batch mutation that verifies the product/variant relationship and logs `source: inline`; do not route UI saves through the Excel endpoint, which records `source: excel`.

Decisions to settle before implementing dependent parts: the purchase-cost destination and cost basis; the five-digit user-code source; the eight-digit product display-ID expectation; whether Expand All covers the current page; and whether the font controls are product requirements or preview tools. The Save/Cancel behavior is the recommended interpretation of the client's note; the static Auto Save label is not an implemented alternative.

**Verification and quality notes**

All 13 existing tests passed with:

```powershell
pnpm exec tsx --test packages/api/src/consumer-price.test.ts packages/api/src/services/consumer-reference-prices.test.ts apps/web/lib/consumer-price-workbook.test.ts
```

These cover amount validation, cylinder price relationships, grouped pagination, identifier search, audit attribution, owner-price isolation, batch rollback, export scope, and Excel serialization/validation. The database suite uses isolated in-memory PostgreSQL. These passes verify existing pricing logic; they do not prove visual parity or browser interaction behavior.

The Impeccable detector returned no mechanical findings for the product-price component directory. Manual inspection still identifies the contract gaps above. Existing strengths include accessible expansion labels/states, inline validation errors, pending-save controls, keyboard Enter/Escape, responsive mobile editors, and transactional audit logging.

Additional source-level review against the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) supports preserving meaningful control names, visible focus, accessible disclosure state, and protection for unsaved drafts. The client prototype's unlabeled icon disclosure and price inputs need accessible names in the production implementation. Render-dependent contrast, text fit, and touch usability remain unverified.

Acceptance should include: five visible main columns at every tested width; view-only disclosure after prior edits; product-wide Save and Cancel; failed saves preserving drafts; reset clearing its documented state; correct actor code/date; a purchase link resolving the intended product/variant and owner context; Back restoring the list; and existing import/export behavior remaining intact.
