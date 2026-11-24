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
| 4 | Retailer Real-time Stock | List and View built (uncommitted); graphs later |
| 5 | Expired products by batch | Not started |
| 6 | Empty Pack | Not started |
| 7 | Label printing | Not started |
| 8 | Warehouse copy of phases 4–7 | Not started |

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
- Seller and warehouse edit pages still use the old list.

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
- View `stock/live/[productId]/page.tsx`: name, Product ID, status, total
  stock, empties, sold this month, the low-stock limit form, and Size |
  Stock | Sold (this month).
- API: `getRealtimeStock`, `getRealtimeStockProduct`,
  `setProductLowStockLevel`, all on `helpers/realtime-stock.ts`, which the
  warehouse page can reuse.
- Stock Breakdown: counted units add up ("120 Cylinder"), loose stock is
  shown apart ("120 Pack + 900 KG Loose"), and empties come from
  `empty_pack_stock` ("(30 Empty)").
- Status order: Out of Stock, then Expired, then Low Stock (total at or
  below the limit), then In Stock. The limit is `product.reorderLevel`;
  0 means the default of 5.
- Expired, for now: an "expired" damage entry in the last 30 days. Shop
  Add Stock does not keep expiry dates yet; Phase 5 replaces this with
  batches.
- Sold this month: shop orders (not cancelled or returned) since the start
  of the month, Dhaka time.
- Not done yet: removing the old Low Stock page and its sidebar link.

## Phase 5: Expired products by batch

- One row per batch: batch ID, supplier, date received, invoice number,
  variants (comma separated), expiry date, received and sold quantities.
- Warning 10 or 20 days before expiry; red ✕ once expired.
- Sold quantity is kept per batch, because a sold batch no longer needs
  expiry tracking.
- Today: no batch table with sold quantity. Batch data sits on
  `stock_entry` (warehouse) and `purchase_item` (shop). The warehouse page
  estimates what is left per batch with `allocateCurrentStockLots`
  (`packages/api/src/services/warehouse-stock-lots.ts`). The shop expired
  page reads damage entries, not batches.

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
