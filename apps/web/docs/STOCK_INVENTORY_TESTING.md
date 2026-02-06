# Stock / Inventory — Testing Guide

## Prerequisites

1. **Database**  
   - `0003_stock_inventory` applied (product has `reorder_level`, `sku`, `supplier`, `last_restocked_at`; `stock_change_log` exists).  
   - If `pnpm db:migrate` fails on 0001, run:  
     `pnpm exec tsx scripts/run-0003-stock-inventory.ts`

2. **Dev server**  
   - `pnpm dev`

3. **Admin access**  
   - Log in as a user with admin role.

---

## 1. Open the Stock page

- **URL:** `/dashboard/admin/stock`  
  - Full: `http://localhost:3000/dashboard/admin/stock` (or your dev host, e.g. `b2b.localhost:3000`).

- **Sidebar:**  
  - **Catalog → Stock / Inventory** (Boxes icon, between Products and Categories).

**Check:** Page title "Stock / Inventory", filter bar, table, and pagination are visible. No "Failed query" error.

---

## 2. Filter bar

| Control        | What to do                                                                 | Expected |
|----------------|----------------------------------------------------------------------------|----------|
| **Search**     | Type product name, SKU, or category; press Enter or **Apply Filters**      | URL gets `?search=...`, table updates. |
| **Category**   | Pick a category from dropdown, then **Apply Filters**                      | `?category=<id>`, only that category. |
| **Stock**      | All / In Stock / Out of Stock / Low Stock → **Apply Filters**              | `?status=in|out|low`, rows match. |
| **Sort**       | Newest → Oldest / Oldest → Newest / Popular Products → **Apply Filters**   | `?sort=...`, order changes. |
| **Apply Filters** | Change any of the above and click                                         | URL and table reflect filters. |
| **Add New Product** | Click                                                                    | Goes to `/dashboard/admin/products/new`. |
| **Export CSV** | Click                                                                     | Downloads `stock-inventory-YYYY-MM-DD.csv` (respects current filters). |
| **Export PDF** | Click                                                                     | Toast: "PDF export coming soon". |

**Low stock:** A product is "Low" when `stock_quantity <= reorder_level` and `reorder_level > 0`. If none exist, filter will show no rows.

---

## 3. Table

Columns: **Product ID**, **Product Name**, **SKU**, **Category**, **Current Stock**, **Reorder Level**, **Unit Price**, **Actions**.

**Check:**

- Product ID: `PRD-{id}`.
- SKU: value or slug or "—" if both empty.
- Category: "Category / SubCategory" or "—".
- Prices in ৳.
- Empty state: "No products found." when filters match nothing (or there are no products).

---

## 4. Row actions

| Action         | How                                 | Expected |
|----------------|-------------------------------------|----------|
| **View (eye)** | Click eye on a row                  | Product Detail panel opens (right sheet). |
| **Edit (pencil)** | Click pencil                      | Navigate to `/dashboard/admin/products/{id}/edit`. |
| **Delete**     | Click delete, confirm in dialog     | Product removed, table refreshes. |
| **Adjust (sliders)** | Click sliders on a row         | Adjust Stock dialog opens. |

---

## 5. Product Detail panel (View)

- **Open:** View (eye) on a row.

**Check:** Sheet shows:

- Product name (title)
- SKU, Category, Current Stock, Reorder Level, Unit Price, Supplier, Last Restocked, Batch Info
- **Stock Change Logs** link at bottom

**Stock Change Logs:** Opens a sheet with add/reduce history for that product.

---

## 6. Adjust Stock dialog

- **Open:** Adjust (sliders) on a row.

**Flow:**

1. Choose **Add Stock** or **Reduce Stock**.
2. **Quantity:** number ≥ 1. For Reduce, cannot exceed current stock.
3. **Reason (optional):** e.g. "Restock from supplier".
4. Submit.

**Check:**

- Add: stock increases, "Stock added" toast, table refresh.
- Reduce: stock decreases, "Stock reduced" toast, table refresh.
- Reduce with qty &gt; current: error "Quantity cannot exceed current stock".
- **Stock Change Logs** (in dialog): opens logs sheet for this product; new adjust should appear after a refresh.

---

## 7. Edit product (SKU, Reorder Level, Supplier)

- From Stock: **Edit (pencil)** → product edit page.  
- Or: **Add New Product** and fill the form.

**Check on edit/create form:**

- **SKU** (optional): saved and shown in Stock table and Detail panel.
- **Reorder Level** (optional, default 0): used for Low Stock filter and in table/panel.
- **Supplier** (optional): shown in Detail panel.

Save, go back to `/dashboard/admin/stock`, and confirm the row and View panel show the new values.

---

## 8. Pagination

- **When:** More products than page size (default 10).

**Check:**

- Prev/Next or page numbers at bottom.
- Changing page updates `?page=2` etc. and keeps other params (search, category, status, sort).
- First/Last or correct disabling when on first/last page (if your pagination component supports it).

---

## 9. Item Requests → Stock

- **Stock page:** **Item Requests** (top right).
- When an item request is approved and added to a product, that product’s stock should increase.

**Check:** Approve an item request that adds to a product, then on Stock verify that product’s **Current Stock** increased.

---

## 10. Export CSV

- Set filters (e.g. Category, Low Stock) if you want.
- Click **Export CSV**.

**Check:** File `stock-inventory-YYYY-MM-DD.csv` downloads; rows and columns match the filtered Stock table (product id, name, sku, category, stock, reorder, price, etc.).

---

## Quick smoke checklist

- [ ] Open `/dashboard/admin/stock` — no runtime error, table loads.
- [ ] Apply Filters (search and/or category) — URL and table update.
- [ ] View (eye) — Detail panel with SKU, reorder, supplier, Stock Change Logs.
- [ ] Adjust (sliders) — Add then Reduce with reason — stock and logs update.
- [ ] Edit a product — set SKU, Reorder Level, Supplier — visible in Stock and View.
- [ ] Export CSV — file downloads with expected columns.
- [ ] Pagination (if &gt;10 products) — page param and results change correctly.

---

## If the Stock page shows "Failed query"

1. Ensure `0003_stock_inventory` is applied:  
   `pnpm exec tsx scripts/run-0003-stock-inventory.ts`
2. Confirm `DATABASE_URL` in `.env` and that Postgres is reachable.
3. Check the browser console and server logs for the exact Drizzle/Postgres error.
