# Product variants and stock: phased plan

Source: client review with Rony bhai on 2026-11-24 (product create/update
and stock), plus the client's prototype
`Bikalpo_Product_Management_Variant_MultiSelect.html` (Variant Table,
Variant Overview, Variant Pricing).

Order: Create Product first, because the stock pages and the barcode both
depend on each product having Size × Type variants.

| Phase | Scope | Status |
|---|---|---|
| 1 | Product Information card | Done: `749d418e` on `feat/create-product-identity-fields` |
| 2 | Variant Table, Overview, Pricing (LPG) | Done in Create and Edit: `d26732d1` |
| 3 | 13-digit product code | Done: `9efe1189` |
| 4 | Retailer Real-time Stock | Done: `3aa6b50e`, rows open in place `bca2a40e`; graphs later |
| 5 | Expired products by batch | Built (2026-11-25), not committed; see below |
| 6 | Empty Pack | Not started |
| 7 | Label printing | Not started |
| 8 | Warehouse copy of phases 4–7 | Real-time Stock done: `4381c1bd` |

## Decisions from the meeting

- Product creation starts and is checked in the admin panel, then goes to
  the wholesaler and retailer panels.
- Conversion logic stays as it is for now; it is checked again after
  stock, sales and purchase are done.
- No separate Low Stock page: low stock is a filter on Real-time Stock.
- Brand is not part of the barcode.
- SKU is not worked on for now, but the option stays.
- A product has at most 2 variant attributes (the two options picked on
  the product card before Add to cart).
- The Type/Size logic is for LPG only for now; other product types are
  undecided.

## Phase 1: Product Information card (done)

- Type, Category, Sub category and Core identity stay visible after a core
  identity is picked (they used to collapse to a summary row).
- Type and Category are pick-only.
- Sub category and Core identity are search-or-add: when nothing matches,
  "Add …" creates it. A new sub category is saved at once; a new core
  identity is created when the product saves.
- Display name and Slug are not shown; they come from the core identity.
- The same four fields, in the same layout, show on every product editor.
  Edit pages (admin and seller) show them filled in and locked
  (`ProductIdentityFields`).
- Retailer and warehouse Create Product (2026-11-25) works like admin's:
  catalog "Create Product" opens `…/add/new`, and the catalog Add page keeps
  the four pickers editable (`StoreCatalogIdentity`). Picking another core
  identity opens its Add page. Display name and Slug are hidden everywhere;
  the name comes from the core identity with the brand in front.
  - "Add" in Sub category adds a shared sub category (same as admin; sub
    categories have no store owner). A name already in the category is
    reused.
  - "Add" in Core identity adds a store-only core identity:
    `creator_source` = shop / warehouse and `created_by_id` = the store, so
    only that store sees it (`coreVisibleToOwner`). Admin's catalog still
    lists admin core identities only. No database change was needed.
  - A new core identity has no image, so the first save needs the main
    image (the same rule as admin Create Product).

## Phase 2: Variant Table, Overview and Pricing

Client prototype behaviour, as agreed:

- For LPG / gas products, Variant attribute 1 is Type and attribute 2 is
  Size, set automatically.
- Type options: New, Exchange, Refill, Regular, Premium, Standard.
- Variant Table: one row per Type option (6 rows). Only row 1 shows; the
  others open with "Show more rows". Each row has a checkbox for every
  Type option and a free-text sizes box ("12 KG, 15 KG").
- Why several rows: a row is a selling condition. Example: 12 KG New only;
  15 KG New and Exchange; 50 KG Refill only. One row cannot express that.
- Overview: sizes grouped by the Type options chosen for them.
- Pricing: one row per size, one column per Type option. A cell is locked
  when that size is not sold that way. Prices are optional.
- Bug to avoid (seen in the prototype): a size typed in one row showing up
  under another row's Type options.
- One brand per product, picked by search or added inline. The variant
  chips under each brand go away.

Built (Create Product):

- `lpg-variant-table.tsx` (Variant Table, Overview, Variant Pricing) and
  `lpg-variant-table-model.ts` (+ tests) in
  `apps/web/components/features/product/components/`.
- Sizes are matched to cylinder variant options by KG (missing ones are
  created). One `product_variant_price` row per size; every Type price is
  kept in the new `sale_type_prices` jsonb (migration `0096`).
- New price → `consumerPrice`; Exchange is orderable only when both New and
  Exchange are priced (saved as `exchangeCreditAmount` = New − Exchange).
  A size with no New price saves `consumerPrice` 0, the same as an
  unpriced variant before.
- Variant attributes are set to Type / Size and locked in the rules grid.
- Create Product takes one brand; picking another replaces it.

Built (Edit Product, admin):

- The same Brand (fixed), Variant Table and Pricing cards. Rows are rebuilt
  by grouping sizes sold the same ways. Sizes saved before Phase 2 read as
  New (and Exchange when it was on).
- A removed size is turned off (`isActive` false), not deleted.
- If a saved variant is not a cylinder size in KG, or two share a KG, Edit
  keeps the old per-brand variant list so saving can't drop it.
- Retailer and wholesaler use it too (2026-11-25): catalog Add
  (`core-product-config-form.tsx`, adapter `lpgVariantTable`) and product
  Edit (`product-form.tsx`, edit adapter `lpgVariantTable`). Missing sizes
  are made as store-only variants. The shop and warehouse configure /
  update APIs take and return `saleTypePrices`; New is the seller's selling
  price and Exchange works as before. The admin core-product page keeps
  the chips.
- Sizes are typed as plain numbers in KG ("10, 12, 15"); "12 KG" works too.

Code that was changed:

- Form: `apps/web/components/features/product/components/product-form.tsx`
  (brand cards with variant chips, `ProductPricingTable`, `ClientRulesGrid`).
- Rules grid: `product-rules-grid.tsx` already saves `variantAttr1` and
  `variantAttr2` as strings; they do not drive variants yet.
- `variant_attribute` (`packages/db/src/schema/variant-attribute.ts`) holds
  attribute names and their options as plain strings.
- `variant_option.skuCode` (`variant-option.ts`) is a 2-digit code per
  option; store-only options get none.
- Prices today: only New (`consumerPrice`) and Exchange
  (`exchangeEnabled` + `exchangeCreditAmount`). Refill, Regular, Premium
  and Standard have no storage.

## Phase 3: 13-digit product code

- 8-digit product ID (`coreProductIdentity.catalogCode`) + `0` + 2-digit
  size code + 2-digit type code. Brand is not included.
- Saved per variant so it can be searched and scanned.
- Generator: `packages/api/src/routers/helpers/core-catalog-code.ts` and
  `generate-sku.ts` (`composeSku` exists but is unused).
- Note: EAN-13's 13th digit is a check digit, so these 13 data digits are
  printed as Code 128, not EAN-13.

Built (2026-11-24):

- `packages/db/src/product-code.ts` (+ tests) builds and reads the code.
  Codes are worked out from the core identity's code, the size code and the
  Type, not stored, so older products have them too and they follow any
  change. Type codes: New 01, Exchange 02, Refill 03, Regular 04, Premium
  05, Standard 06. Products without a Type (non-LPG) use 00.
- Types per size: the Variant Table's Types; older cylinders read as New,
  plus Exchange when it is on.
- Size codes (`variant_option.sku_code`) are now unique within a product
  Type. Before, a category size and a type-wide size could share one (5.5 KG
  and 12 KG were both 01). Migration `0097` re-coded the duplicates (5.5 KG
  → 05, 20 KG → 06) and `structured-variant-option.ts` allocates per Type.
- The API adds `productCodes` to the admin product list and the catalog
  product page (`helpers/product-codes.ts`). The page lists every code with
  its size and Type; the admin product search finds a product by a typed or
  scanned code (spaces and dashes ignored).
- Brands share codes: a code finds every brand under that core identity.
  Agreed for now; to be revisited.
- Store-only sizes (made by a shop or warehouse) have no size code, so they
  get no product code.

## Phase 4: Retailer Real-time Stock

- Columns: Product ID, Name, Stock ("90 + 30 empty"), Status icon, View.
  Built for phones.
- Status icon per product: green fine, low-stock mark, red out, warning
  sign when expired.
- Low stock is a filter here; the Low Stock page goes away.
- Low-stock limit is set per product inside View. Today there are several
  hardcoded limits (`shop-owner.ts` 5, 5, 5; warehouse low page 10) and a
  `reorderLevel` column on product and product variant.
- Search by name, Product ID, typed barcode or scanned barcode.
- In View: remove the ID line and the month-on-month arrows.
- The Stock Overview page is not in the client's spec.
- Pages: `apps/web/app/shop/(management)/dashboard/stock/` (`page.tsx`,
  `live`, `low`, `expired`, `empty-pack`, `add`). Live uses
  `shopOwner.getRealtimeStock` (`packages/api/src/routers/shop-owner.ts`).

### Built (2026-11-24)

- List `stock/live/page.tsx`: the catalog's search and Type / Category /
  Sub Category filters plus Status (In Stock, Low Stock, Out of Stock,
  Expired), [Add Stock] [Purchase], and Product ID | Product Name | Stock
  Breakdown | Action (status icon + View). "Expired" lists any product with
  expired stock. Graph cards (Total Units, Loose Stock trend) come later.
- ~~View `stock/live/[productId]/page.tsx`~~: replaced on 2026-11-25, see
  below.
- API: `getRealtimeStock`, `getRealtimeStockProduct`,
  `setProductLowStockLevel`, all on `helpers/realtime-stock.ts`, which the
  warehouse page can reuse.
- Stock Breakdown: counted units add up ("120 Cylinder"), loose stock is
  shown apart ("120 Pack + 900 KG Loose"), and empties come from
  `empty_pack_stock` ("(30 Empty)").
- Status order: Out of Stock, then Expired, then Low Stock (total at or
  below the limit), then In Stock. The limit is `product.reorderLevel`;
  0 means the default of 5.
- Expired: stock left in a batch past its expiry date (Phase 5). This
  replaced the old rule (an "expired" damage entry in the last 30 days).

### Row opens in place (client, 2026-11-25)

- No View page: the View button (or a click on the row) opens the product under
  its row: name + Product ID, Total Stock, Status with the low-stock limit
  ("Low stock at [n] Save") beside it, then Size | Stock | Sold (this month). No section
  headings or icons (client, 2026-11-25). This replaces the line above
  about removing the ID and the arrows.
- Stock arrow: this month's stock in (purchases received and manual
  changes from `inventory_movement`, supplier returns subtract) against
  sold this month. Down = more sold than came in.
- Sold arrow: sold this month so far against the same days last month.
- The Size column drops the unit word ("12 KG"); the unit shows with each
  figure. `getRealtimeStockProduct` stays on the API but the web no longer
  calls it.
- Sold this month: shop orders (not cancelled or returned) since the start
  of the month, Dhaka time.
- Not done yet: removing the old Low Stock page and its sidebar link.

## Phase 5: Expired products by batch

### What the client decided (review, 2026-11-24)

- Same variant is bought several times, so expiry is tracked per batch.
  Rony bhai first said batches would be too messy, then agreed: "then the
  batch is needed".
- The expiry date is entered when stock is added.
- Warning 10 or 20 days before expiry (red ✕ once expired, ⚠ before).
- The list stays like the other stock pages (search, filters); View opens
  the batches inside the row, not on a new page.
- A batch shows: batch ID, supplier, date received, invoice number,
  variants (comma separated) and expiry date.
- Sold is counted per batch: once a batch is sold, its expiry no longer
  matters.
- The detail page's extra product information (product ID block, etc.)
  is not needed there.

### What the code had before Phase 5

- Shop Add Stock (`stock/add`) is a manual purchase: supplier, bill no.
  and date per purchase; Batch and Expiry per row, saved on
  `purchase_item` (`services/manual-purchase.ts`). No manufacture date.
  Receiving writes `inventory_movement` (`purchase_receipt`) with
  `purchase_item_id`, but not the batch or expiry.
- Receiving a warehouse order (`shopOwner.markPurchaseReceived`) takes no
  batch or expiry at all.
- Sales (online and POS) take stock from the variant total; no sale
  records which batch it came from.
- The shop Expired page reads "expired" damage entries, not batches.
- Live data (2026-11-25, read only): `purchase_item` is empty, the shop
  has 2 receipt movements (both warehouse orders, no batch), and only 3
  products (all warehouse) have expiry tracking on. Shop expiry tracking
  starts with new stock; today's stock shows as "no batch".
- The warehouse already estimates what is left in each batch
  (`allocateCurrentStockLots`): today's stock is matched to the newest
  receipts, so the oldest batches are counted as sold first.

### Plan

**1. Data (one migration, needs approval; the DB is shared with live)**

- `inventory_movement`: add nullable `batch_no`, `manufacture_date`,
  `expiry_date`. A batch is a stock-in movement with an expiry date;
  supplier and invoice come from its purchase or order.
- `product`: add `expiry_alert_days` (default 10), set per product like
  the low-stock limit.
- Additive and nullable only; nothing existing changes.

**2. Recording batches when stock comes in**

- Add Stock: rows for products with Expiry Tracking on show Batch,
  Mfg. date (optional) and Expiry (both required); other rows hide
  them. The receipt copies them onto the movement.
- Receive warehouse order: the same three inputs on lines whose product
  has expiry on.
- One server check for both paths: dates are `YYYY-MM-DD`, expiry not
  before manufacture, batch and expiry required when expiry is on.

**3. What is left in each batch, and Sold**

- Use the warehouse method: match today's stock to the newest batches;
  Left = matched quantity, Sold = Received − Left. Every sale channel
  already lowers the total, so no sale code changes.
- Stock beyond all batches is older, unbatched stock and is not shown.
- Batches with nothing left drop off the page.
- Limit: it assumes oldest-first selling. Recording the batch on each
  sale and damage (exact counts) is a later step if the client needs it.

**4. API** (`helpers/expiry-stock.ts`, owner-generic for Phase 8)

- `shopOwner.getExpiryStock`: products with a batch that is expired or
  inside its alert window and still has stock, with their batches.
- `shopOwner.setProductExpiryAlertDays`.
- Status: Expired when expiry is before today (Dhaka time); Expiring
  when within the product's alert days.

**5. Page** (`stock/expired`, same shell as Real-time Stock)

- Search (name, Product ID, scan code); filters Category, Sub Category.
- Header counts: Products, Expired, Expiring soon.
- Columns: Product ID | Product Name | Expired Qty | Last Expiry |
  Action (✕ or ⚠ + View).
  - Expired Qty: what is left in the flagged batches ("20 Cylinder").
  - Last Expiry: the most urgent date among them.
- View opens the row (centered panel, like Real-time Stock):
  - Name and Product ID; Status badge with "Alert [10] days before
    Save" beside it.
  - Batch table: Batch | Variants | Sold / Received | Left | Expiry.
    Under the batch ID, one muted line: supplier · invoice · received
    date. Same batch and expiry → one row with variants comma
    separated.
  - Action: [Create Damage], opening the damage form filled with the
    expired batches (the form learns to read those values).
- Not in the first version: Return to Supplier (today it only returns a
  whole warehouse order) and Apply Discount (nothing to build on yet),
  the product information block, Total order (30 days).

**6. Real-time Stock**

- Its "Expired" status switches from damage entries to these batches.

**7. Checks**

- Unit tests for batch matching and status dates.
- In Chrome: a product with expiry on, two batches (one past, one in 5
  days), sell some at POS, check Left/Sold, the alert setting and
  Create Damage.

**Order of work:** 1 → 2 → 3/4 → 5 → 6. The warehouse page (Phase 8)
reads `stock_entry` through the same helper.

### Answers (2026-11-25)

- Alert days: per product, a dropdown like the low-stock limit
  (5, 7, 10, 15, 20, 30 days; default 10). Saves on change.
- Last Expiry: the most urgent date of the flagged batches.
- Warehouse orders: the retailer types batch and expiry when receiving,
  the same as Add Stock.
- Which products: the ones with Expiry Tracking on in the product's
  Inventory & Product Rules (create / edit). Turning it on also turns on
  Batch Tracking.

### Built (2026-11-25)

- Migration `0098_batch_expiry_tracking.sql` (applied with approval):
  batch, manufacture and expiry dates on `inventory_movement`,
  manufacture date on `purchase_item`, `product.expiry_alert_days`.
- Add Stock: Mfg. Date and Expiry show only for expiry products; Batch
  and Expiry are required there. The same size can now come in two
  batches on one bill (the duplicate check looks at size + batch, and
  the receipt adds both lines to the stock).
- Receive warehouse order: Batch, Mfg. date and Expiry on expiry lines.
- API: `shopOwner.getExpiryStock`, `shopOwner.setProductExpiryAlertDays`
  (`helpers/expiry-stock.ts`, `helpers/expiry-batches.ts`,
  `services/batch-expiry.ts`).
- Page `stock/expired` (`components/features/stock/expiry-stock-page.tsx`,
  `expiry-row-detail.tsx`): as planned above. Expired Qty is what is
  left in the expired batches, or in the expiring ones while none has
  expired. Create Damage opens the damage form filled in: type Expired,
  the product, each size's quantity, and the batch numbers in the note.
- Real-time Stock "Expired" (shop) now comes from the batches.
- Checked in Chrome as the test retailer: Petromax LPG with expiry on,
  batches PX-OLD-01 (expired 20 Nov, 6 left) and PX-NEW-02 (29 Nov,
  "In 4 days"); alert dropdown saves; Create Damage fills 6 Cylinder;
  Real-time Stock shows Expired. Not checked: phone width, selling
  some at POS.
- Left out, as planned: Return to Supplier, Apply Discount.
- The old `getExpiredProducts` API (damage entries) is still on the
  server but the web no longer calls it.

## Phase 6: Empty Pack

- Product ID column.
- "In market" per the client: an exchange order delivered (OTP matched)
  where the customer gave back neither the empty cylinder nor the New
  price. If they paid, it is not in market. A warning shows on receipt.
- Today `empty-pack-management.ts` counts `convertedToNewQty` (empties not
  returned and charged as New) as in market, which does not match.

## Phase 7: Label printing

- Barcode drawn with bars and the number underneath (needs a barcode
  library; only `qrcode.react` is installed).
- Template: the bottom design. No QR code, no SKU, no letter next to the
  price, price amount on the far right, divider line kept. Pack/unit stays
  a typed sample for now.
- "Print label" opens a preview with the paper size (for example 70 × 40
  mm), then prints. Today the buttons only say "coming soon"
  (`catalog-product-detail.tsx`, `owner-product-list.tsx`).

## Phase 8: Warehouse

- Copy phases 4–7 to the warehouse pages; retailer and warehouse stock
  work the same way.

### Real-time Stock (done, 2026-11-25)

- `warehouse/(management)/dashboard/stock/live` uses the same
  `RealtimeStockPage` as the shop (`components/features/stock/`), with
  `warehouse.getRealtimeStock` and `warehouse.setProductLowStockLevel`.
  The sidebar's "Stock" entry now opens it as "Stock (Real-time)"; the
  old `stock/list` page stays for the links that still point to it.
- Warehouse "Expired": a batch (`stock_entry.expiry_date`, product
  expiry on) past its date that still has stock, allocated oldest-first
  the way the Expired Products page does.

## Answered (2026-11-24)

- Stock is counted per size only. New, Exchange, Refill, etc. decide how a
  cylinder is sold and its price; the barcode's type digits pick the price.
- Refill, Regular, Premium and Standard: ticked and priced in Create
  Product and saved, but only New and Exchange can be ordered until a sale
  flow exists.
- One brand per Create Product (as in the client's page).
- Only LPG gets the Type × Size Variant Table; other products keep picking
  variants per brand.

## Open questions

1. Same size in two Variant Table rows: combine the Type options (current
   default), or block it?
2. "In market": add an "empty owed, not paid" state for exchange orders?
3. Stock Overview page: remove it, or point it to Real-time?
4. Product code: brands under one core identity share codes (a scan shows
   them all). Revisit later, together with the Type codes.
