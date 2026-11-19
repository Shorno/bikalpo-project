# Product List & Catalog Product Detail — Implementation Plan

Source: client review meeting with Roni, 2026-11-20 (transcript + summary), plus the KPI and
product-list mockups shared after the meeting.

Scope decided in the meeting:

- **Product list** (wholesaler *and* retailer, identical): no stock column, no stock KPIs,
  new columns, catalog-style filters, two new KPI cards.
- **Catalog product detail** (admin catalog → product): restructured header, display-only
  variant/type/quantity controls, a new *Product Information* tab, an admin-only block, and
  the seller view of the same page (prices hidden as stars, **Add Product** button).
- Platform focus is **LPG first**; brand-inclusive product names only for the LPG type.

Out of scope for now (explicitly deferred in the meeting): the product-list row detail page,
the Add/Edit Product flow redesign, the variant price matrix, label printing, and the one
price bug Roni is tracking.

---

## Phase 0 — Carry-overs from the start of the meeting (verify first)

These were discussed at the start of the meeting. On `main` (12725c2d) they are **not** in
the code yet, so confirm whether they live on an unmerged branch before redoing them.

| Item | Where on `main` | What is left |
| --- | --- | --- |
| Remove the plus icon from the mobile catalog rows (retailer + wholesaler) | `apps/web/components/features/product/components/catalog-layout.tsx` — `AddButton compact` with `<Plus>` is still rendered on mobile when `hasAdd` | Drop the compact Add cell on mobile (row tap + name link already open the product), matching admin. Keep the desktop **View / Add** buttons. |
| Footer inside the retailer **My Store** dashboard view | `ShopFooter` is only mounted in `app/(retailer-storefront)/stores/[slug]/layout.tsx`; `app/shop/(management)/dashboard/stores/page.tsx` has none | Render `ShopFooter` (same component as the public page) at the bottom of My Store. |
| Store URL visible in the footer | `shop-footer.tsx` "Contact us" shows the link text *"{name} store page"* | Show the actual URL as text, e.g. `bikalpo.com/stores/<slug>` (colour optional per Roni). Applies to the public footer too. |

**Done when:** mobile catalog has no plus icon for retailer/wholesaler; My Store shows the
same footer as the public store; the footer shows the store URL. Deploy.

---

## Phase 1 — Shared product-list API (backend)

Today the two lists are built differently:

- Wholesaler: `app/warehouse/(management)/dashboard/products/page.tsx` → `warehouse.getWarehouseProductList`
  (`packages/api/src/routers/warehouse.ts:9812`), **one row per variant**, stock-based stats,
  hides inactive rows client-side (`visibleRows = activeRows`).
- Retailer: `app/shop/(management)/dashboard/products/page.tsx` → `shopOwner.getShopProducts`
  + `getShopProductKPIs`, **one row per product** with expandable variants.

Because `inventory` is owner-based (`ownerType` + `ownerId`), one helper can serve both.

1. Add `packages/api/src/routers/helpers/owner-product-list.ts` taking `{ ownerType, ownerId }`
   and returning **one row per Brand Product** (owner's `product` row):
   - `productId`, `productCode` (= `product.catalogCode`, the shared Product ID)
   - `name` — brand-inclusive (e.g. "Bashundhara LPG") **only for the LPG type**, otherwise the product name
   - `typeId/categoryId/subCategoryId` (+ names, for filters only — no sub-text in the cell)
   - `variantCount` and, when `variantCount === 1`, `variantLabel` — short form only ("12 KG"),
     no brand, no "Cylinder"
   - `value` — Σ over variants of `inventory.availableQty × price` (see Q2)
   - `isActive` — `product.status === "active"`
2. Inputs: `page`, `pageSize`, `search` (**product name + Product ID only**, drop SKU search),
   `typeId`, `categoryId`, `subCategoryId`, `status: "all" | "active" | "inactive"`, `sortBy`
   (name / value; drop stock sorts).
3. Return inactive rows too (the UI blurs them instead of hiding them).
4. Expose it as `warehouse.getProductList` and `shopOwner.getProductList` (thin wrappers that
   resolve the owner from the session). Leave the old procedures in place until Phase 2 ships.

**Done when:** both procedures return identical shapes for an owner with LPG + grocery
products, including a multi-variant product and an inactive one.

---

## Phase 2 — Shared product-list UI (wholesaler + retailer)

1. Build `components/features/product/owner-product-list.tsx` used by both pages (pass the
   query hook + detail-href builder as props).
2. Columns (desktop): **Product ID · Product Name · Category · Variant · Value**. No Stock, no
   Actions column. Whole row clickable → existing detail page for now
   (wholesaler `stock/core-*` / `stock/product-*`, retailer `/dashboard/products/[id]`).
3. Mobile: **Product ID · Name · Variant · Value** (drop Category). Reuse the fixed-width
   mobile table pattern from `catalog-layout.tsx`.
4. Variant cell: one variant → short label ("12 KG"); several → the count ("2", "5").
5. Value: `৳72,000` style, no decimals, right-aligned.
6. Inactive products: shown with reduced emphasis (e.g. `opacity-50` + slight blur) — still clickable.
7. Toolbar: search (placeholder "Search by name or Product ID"), then the catalog's
   **Type / Category / Sub Category** filter row (reuse the filter panel from
   `catalog-layout.tsx`), plus an **Active / Inactive** control (toggle or segmented). On mobile,
   if it doesn't fit on the filter row, put it on the line below.
8. Remove: stock tabs (All / In stock / Low / Out), stock sorts, Core Identity and Brand filters,
   brand badge + sub-category text under cells, row action menu.
9. Retailer sidebar: rename **Inventory → Products** (`components/dashboard/shop-owner-sidebar.tsx:59`).
   Wholesaler already says Products.
10. Keep header buttons **Print Labels** (placeholder) and **Add Product** (→ catalog).

**Done when:** both panels show the same list, matching the mockup columns, on desktop and
375 px mobile without horizontal scroll.

---

## Phase 3 — KPI cards

Replace the four stock KPIs with the two cards from the mockup (same on both panels):

| Card | Big number | Top line | Bottom line | Trend |
| --- | --- | --- | --- | --- |
| **Products** | total products (e.g. "3,850 ID") | "+N New ID Added" this month | "N ID Inactive" | sparkline, products added per month (last 6) |
| **Inventory Value** | current value (e.g. "৳4.8 Cr", compact Lakh/Crore) | "+x% vs Last Month" | "N ID Slow-Moving Stock" | sparkline, month-end value (last 6) |

Backend (`getProductListKpis` next to the list helper):

- New this month: owner products with `createdAt ≥ start of month`.
- Inactive: `status !== "active"`.
- Value now: same Σ as the list. Value last month: rebuild month-end quantity per variant from
  `inventory_movement.quantity_after` (latest movement before the month boundary) × the same
  price rule. Monthly comparison — Roni corrected "year" to **month** in the meeting.
- Slow-moving: see Q4.

Stock KPIs (in / low / out of stock) move to the Stock section only.

---

## Phase 4 — Catalog product detail: header, tabs, labels

Page today: `app/(dashboard)/dashboard/admin/web-view/[id]/web-view-detail-client.tsx`, reused
by `admin/products/[productId]/page.tsx`. Turn it into a shared
`CatalogProductDetail` with a `viewer: "admin" | "warehouse" | "shop"` prop.

1. Rename **System ID → Product ID** everywhere it is shown:
   `core-product-columns.tsx:45`, `core-product-table.tsx:181`, `catalog-layout.tsx:190/202`,
   `product-catalog-table.tsx:223`, and the search placeholder in `admin/web-view/page.tsx:428`.
2. Hero (right column): brand → name → rating/reviews on its own line → price → variants →
   type → quantity → buttons. No "Sold".
3. Variants: show **all** variants as checkbox-style chips, display-only (no selection logic needed).
4. Type: **New / Exchange** chips, display-only. Show Exchange when the product's variants have
   `exchangeEnabled` (it is set when the product is created). See Q5.
5. Quantity −/+ stepper: rendered but disabled (design only).
6. Buttons: admin → **Edit Product** (existing edit route); seller → **Add Product** (Phase 6).
   **Print Label** shown as a placeholder (disabled / "coming soon"). Position is our call.
7. Tabs, left → right: **Product Information · Description · Reviews**. Default = Product
   Information. Description content (features, short + long description) appears **only** in
   the Description tab. Reviews tab unchanged.
8. Product Information fields: Product ID, Category, Sub Category, Product Name, Variant(s),
   Inventory Unit, Minimum Order, Brand, SKU, Status — all read from product creation data.
   Do **not** show the "Inventory rule enable" toggle.

---

## Phase 5 — Admin-only block

Shown only when `viewer === "admin"`, inside the Product Information tab below the fields,
with a tinted background and an "Admin only" label so it reads as a separate area.

1. **Product History** — created (date, by whom) and price changes from `consumer_price_log`.
2. Performance merged into the same block (no separate "Performance" heading, no stat cards,
   no Total Sales):
   - **Average rating** — end-consumer reviews (already loaded via `customer.getProductReviews`).
   - **Orders** — count of end-consumer orders that include the product (an order count, not sales value).
3. Variant price matrix: not now — comes with the pricing work.

New procedure: `product.getAdminProductInsights({ productId })` → history + order count.

---

## Phase 6 — Seller view of the catalog detail

Meeting flow: seller opens Product Catalog → clicks a product → sees this same page → clicks
**Add Product** → the add/edit product form opens.

1. Routes: `/warehouse/dashboard/catalog/view/[productId]` and
   `/dashboard/product-catalog/view/[productId]`, rendering `CatalogProductDetail viewer="warehouse" | "shop"`.
2. Point the catalog **View** button / row tap at these routes (today they go to the brand
   management page for the core product). Keep **Add** pointing at `catalog/add/[coreProductId]`.
3. Prices: show `★★★` wherever a price would appear (hero and variant chips). Strip prices
   **server-side** in a seller-facing procedure — don't send them to the browser and hide them in CSS.
4. Button: **Add Product** → `catalog/add/[coreProductId]` (warehouse) /
   `product-catalog/add/[coreProductId]` (retailer). If the seller already has the product,
   show **Edit Product** → their own product edit page.
5. No admin-only block, no Edit for admin data.

---

## Suggested PR split

| PR | Phases | Notes |
| --- | --- | --- |
| 1 | 0 | Small, deploy right away (Roni asked for it). |
| 2 | 1 + 2 | Product list on both panels. |
| 3 | 3 | KPIs: needs the month-end value query. |
| 4 | 4 + 5 | Admin catalog detail. |
| 5 | 6 | Seller catalog detail + price stripping. |

---

## Open questions (to confirm with Roni)

1. **Row grain.** The list is per variant today; the meeting moved to one row per product with
   a variant count. Plan: one row per Brand Product (Product ID = `catalogCode`). OK?
2. **Value price basis.** Value = quantity × which price: the owner's selling price
   (`packPrice` / shop price) or purchase cost (`unit_cost` from stock entries)? Plan default:
   selling price.
3. **Product ID format.** Mockup shows `PRD-000013`; the system uses the 10-digit shared
   catalog code. Plan: keep the catalog code.
4. **Slow-moving stock.** Definition? Plan default: quantity > 0 and no outbound movement in 30 days.
5. **New / Exchange.** Exchange is configured per variant (`exchangeEnabled`). Meeting said show it
   on all variants of the product. Plan: show Exchange when any variant has it on.
6. **Admin hero price.** Sellers see stars. Does admin also see stars in the hero, or real prices?
   Plan default: admin sees real prices.
