# Feature: PDP specs, product variants, delivery rules

## Summary
This PR adds product specifications on the PDP, product variants with flexible packaging/order rules, delivery rules by area and weight, and checkout delivery cost. It also hides unit count on PDP and fixes build/lint.

---

## Product details page (PDP)

### Specs and layout
- **ProductSpecs component** (`components/features/products/product-specs.tsx`):
  - **Specs table:** Weight, Category, Sub-Category, Brand, Origin, Shelf Life, Packaging Type, Moisture, Grain Length.
  - Always shows all rows; uses **"—"** when a value is missing so the layout is consistent.
  - **Packaging section:** e.g. "1 Sack = 50kg", Moisture, Grain Size (from variant or product features).
  - **Unit Type section:** Minimum order (e.g. "1 piece"), Bulk units (from variant quantity options).
- Data sources: first product variant (when present), product size/category/brand, and product **features** (keys: Moisture, Grain Length, Origin, Shelf Life, etc.).
- Used on **public** PDP (`/products/[category]/[productSlug]`) and **customer** PDP (`/customer/products/[category]/[slug]`) with optional `theme="emerald"` for customer.

### Other PDP changes
- **getProductBySlug** now includes `variants` so PDP can show variant-based specs.
- **Stock display:** Removed "(X units available)" on customer PDP; only **In Stock** / **Stock out** badges are shown.
- **Add to Cart** on PDP still updates cart in place (no redirect).

---

## Product variants

### Schema
- **product_variant** table: `unitLabel`, `weightKg`, `packagingType`, `origin`, `shelfLife`, pricing (`price`, `priceTiers`), order rules (`orderMin`, `orderMax`, `orderIncrement`, `orderUnit`), `quantitySelectorOptions`, `stockQuantity`, etc.
- **Cart & order items:** Optional `variantId` on `cart_item` and `order_item` to reference a variant.

### Admin
- **Product form (edit):** "Variants" card with CRUD via `ProductVariantsCard` and `VariantFormDialog`.
- **Product form (create):** "Draft variants" card (`ProductDraftVariantsCard`); variants are saved after the product is created.
- **Product API:** `getProductById` returns product with variants; create product returns data that includes `id` for saving variants.

### Actions
- `actions/product-variant/`: `create-variant`, `update-variant`, `delete-variant`, `get-variants-by-product-id`.

---

## Delivery rules

### Schema
- **delivery_rule** table: area (e.g. zone name or "all"), weight bands (min/max kg), cost per order or per kg.

### Admin
- **Delivery rules page:** `app/(dashboard)/dashboard/admin/delivery-rules/page.tsx` with list, create, edit, delete.
- Link added in admin sidebar.

### Actions
- `actions/delivery-rule/`: `list-delivery-rules`, `create-delivery-rule`, `update-delivery-rule`, `delete-delivery-rule`, `calculate-delivery-cost`, `get-estimated-delivery-cost`.

### Checkout
- **Customer** and **public** checkout pages show **estimated delivery cost** based on shipping area and cart contents (total weight), updating when area or cart changes.

---

## Order flow
- Order creation uses cart items with `variant` when present.
- **Total weight** for delivery is computed from variant `weightKg` (or product size for legacy items).
- **Shipping cost** is set via `calculateDeliveryCost`.
- Stock updates apply to `product_variant` when `variantId` is set, otherwise to `product`.

---

## Migrations & scripts
- **drizzle/0006_product_variant.sql** – product_variant table.
- **drizzle/0007_variant_pricing_delivery_rules.sql** – variantId on cart/order, delivery_rule table.
- **scripts/run-0006-0007-migrations.ts** – optional script to run these migrations if needed.

---

## Build & quality
- **Type fix:** `product-form.tsx` – create product result `data` cast via `unknown` to `{ id: number }` for new product ID.
- **Lint/biome:** Removed unused `timestamp` imports (`delivery-rule.ts`, `product-variant.ts`), optional chain in migration script, format applied.

---

## Merged from master
- Branch is up to date with `master`; audit log feature (and other recent changes) merged in with no conflicts.
