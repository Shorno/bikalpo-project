# Shared Seller Product Details View Research

**Scope.** Repository sources only. This note covers the public reference-product detail, retailer storefront detail, and warehouse storefront detail. No application code was changed.

## Conclusion

Retailer and warehouse details should use the public detail page's **exact visual structure through one controlled shared shell**, while separate adapters retain each surface's existing commerce flow. Copying `PublicProductDetailsView` or routing every seller through `ProductActions` in Open Order mode would create visual drift or incorrect orders.

The public view already contains the required breadcrumb, Back/title row, image and service notes, Product ID/Name/Brand facts, selected price with rating/sold figures, variant and New/Exchange radios, action area, and Description/Reviews tabs (`apps/web/components/features/products/public-product-details-view.tsx:204-315`, `:317-441`, `:443-512`). Retailer and warehouse currently render the older `ProductDetailsView`, whose gallery, badges, trust blocks, and separate description/features/reviews layout are visibly different (`apps/web/components/features/products/product-details-view.tsx:52-180`, `:182-229`).

## Route and source inventory

| Surface | Route | Current component | API/data source |
|---|---|---|---|
| Public reference | `/products/[category]/[productSlug]` | `PublicProductDetailsView` (`apps/web/app/(public)/products/[category]/[productSlug]/page.tsx:17-80`) | `customer.getProductDetails` via `getProductBySlug` (`apps/web/lib/public-data.ts:189-196`) |
| Retailer storefront | `/stores/[slug]/products/[productSlug]` | `ProductDetailsView` (`apps/web/app/(public)/stores/[slug]/products/[productSlug]/page.tsx:16-107`) | `customer.getStoreProductDetail` via `getStoreProductDetail` (`apps/web/lib/public-data.ts:219-233`) |
| Warehouse storefront | `/w/[slug]/products/[productSlug]` | `WarehouseProductDetailPage` (`apps/web/app/w/[slug]/products/[productSlug]/page.tsx:7-20`) | `warehouse.getStorefrontProductDetails` via `getWarehouseProductDetail` (`apps/web/lib/public-data.ts:236-250`) |
| Legacy warehouse route | `/shop/warehouse/[warehouseSlug]/products/[productSlug]` | Same `WarehouseProductDetailPage` (`apps/web/app/shop/(storefront)/warehouse/[warehouseSlug]/products/[productSlug]/page.tsx:7-20`) | Same warehouse API |

Both warehouse URLs already converge on `WarehouseProductDetailPage`, which currently injects `WarehouseProductDetailActions` into the old shared view (`apps/web/components/features/warehouse/warehouse-product-detail-page.tsx:54-88`). One change at that source covers both warehouse detail URLs.

The shop-owner portal's role-aware product page is separate from these public seller storefronts. Shop-subdomain paths are authenticated and rewritten into `/shop` (`apps/web/proxy.ts:166-223`); redesigning that portal page should not be inferred from this storefront requirement.

## Shared-shell recommendation

Extract the markup and selection state from `PublicProductDetailsView` into a seller-neutral component, for example `SellerProductDetailsView`. It should be the single owner of:

- selected variant;
- selected New/Exchange mode;
- selected effective price;
- product/variant description rows;
- Description/Reviews tab state;
- the exact public spacing, typography, borders, breakpoints, and information order.

The shell should accept normalized product, variant, breadcrumb, review, sold-count, service-note, and Back-link data. It should expose a controlled operation seam such as:

```ts
renderActions({ selectedVariant, saleMode, effectiveUnitPrice, setSaleMode })
```

A render function is safer than the current static `actionSlot?: ReactNode`, because warehouse actions currently maintain their own selected variant and mode. Two independent selection states could display one variant while adding another.

Keep three thin adapters:

1. **Public adapter:** use existing `ProductActions` with `purchaseMode="open_order"`, no shop ID, exact reference variant, selected mode, preview restriction, and Call action.
2. **Retailer adapter:** use existing customer cart with `purchaseMode="direct"`, exact `shopId`, retailer live stock/price limits, and the shell-selected mode.
3. **Warehouse adapter:** keep role/connection checks, warehouse-local cart, quantity, cart link, and B2B order destination, but remove its duplicate price, variant selector, and specs markup (`apps/web/components/features/warehouse/warehouse-product-detail-actions.tsx:253-348`).

Create one product-code formatter for `PRD-${String(id).padStart(6, "0")}`. The public route currently duplicates that format in its product model and breadcrumb (`apps/web/app/(public)/products/[category]/[productSlug]/page.tsx:42-75`), while retailer and warehouse routes provide no code. Continue using each owner product's ID; Core Product Identity, Catalog Variant, and Owner Variant are distinct domain identities (`CONTEXT.md:26-67`).

## Behavior boundaries

### Public reference / Open Order

The public API filters exact eligible Open Order variants, resolves canonical Reference Prices, and supplies exact-variant cylinder choices (`packages/api/src/routers/customer.ts:2139-2203`). The view sends exact variant and mode in `open_order` mode without a retailer (`apps/web/components/features/products/public-product-details-view.tsx:387-435`). The server rejects retailer-bound Open Order lines, validates exact eligibility and Exchange capability, and resolves effective reference price (`packages/api/src/routers/customer.ts:4701-4711`, `:4727-4758`, `:4817-4853`).

Preserve Reference Price semantics: it estimates an Open Order and is not a guaranteed retailer selling price (`CONTEXT.md:69-78`). Do not apply retailer or warehouse inventory caps to this action.

### Retailer storefront / Direct Order

The retailer route maps the exact owner variant's live `retailPrice`, available quantity, order constraints, and cylinder configuration, then passes `purchaseMode="direct"` and exact `shop.id` (`apps/web/app/(public)/stores/[slug]/products/[productSlug]/page.tsx:33-55`, `:66-106`). The API accepts only the approved shop's public owner product and shop-owned inventory (`packages/api/src/routers/customer.ts:4330-4441`); cart add revalidates product ownership, exact active variant, inventory, and price (`packages/api/src/routers/customer.ts:4761-4803`, `:4926-4960`).

Today retailer detail defers New/Exchange until checkout and does not pass `cylinderSaleMode` (`apps/web/components/features/products/trade-product-detail-client.tsx:282-293`, `:314-340`). Exact interaction parity requires the shared selector's mode to be passed into the existing direct-cart API, which already accepts it (`packages/api/src/routers/customer.ts:4687-4696`, `:4817-4824`). The flow must remain a Direct Order tied to one retailer.

### Warehouse storefront / B2B orders

Warehouse detail returns only active variants backed by positive inventory owned by the exact warehouse, including live price, stock, order constraints, fulfillment metadata, and Exchange capability (`packages/api/src/routers/warehouse.ts:565-655`). Its action modes are role-specific: Shop Owner -> retailer buyer; connected Warehouse Owner -> warehouse-to-warehouse; unconnected Warehouse Owner -> view-only; others -> login (`apps/web/components/features/warehouse/warehouse-product-detail-actions.tsx:41-47`, `:210-249`).

Warehouse carts are scoped by buyer mode, user, and warehouse, and New/Exchange are distinct line identities (`apps/web/lib/warehouse-storefront-cart.ts:23-40`, `:65-100`). Exchange is available only to Shop Owner buyers when the exact variant permits it; warehouse-to-warehouse is forced to New (`apps/web/components/features/warehouse/warehouse-product-detail-actions.tsx:120-140`, `:181-208`). Checkout dispatches retailer buyers to `shopOwner.placeWarehouseOrder` and warehouse buyers to `warehouse.placeWarehouseSupplierOrder` (`apps/web/app/w/[slug]/page.tsx:291-335`). These paths must not be replaced with customer cart or Open Order mutations.

## Data gaps and risks

- Public detail already supplies review aggregates and delivered-order count (`packages/api/src/routers/customer.ts:2206-2235`). Retailer detail does not return those aggregates, although its product payload already preserves `shortDescription` (`packages/api/src/services/retailer-store-product-detail.ts:19-44`, `:147-161`).
- Warehouse detail/type contains product and variants but no review or sold aggregates (`packages/api/src/routers/warehouse.ts:668-704`; `apps/web/types/warehouse-storefront.ts:44-60`). Define whether warehouse “Sold” means completed retailer-to-warehouse orders, warehouse-to-warehouse orders, or both before showing non-zero social proof.
- Current warehouse UI displays full `retailPrice` even for Exchange (`apps/web/components/features/warehouse/warehouse-product-detail-actions.tsx:253-310`), while warehouse order placement subtracts the exchange credit (`packages/api/src/routers/shop-owner.ts:7925-7940`). Shared visible price and submitted mode must agree.
- Public structure shows one primary image; retailer/warehouse payloads have image galleries. Strict “not more or less” parity means omitting old thumbnails unless the public canonical design is changed first (`apps/web/components/features/products/public-product-details-view.tsx:252-269`).
- Existing retailer related-products, old trust badges, standalone Features/Reviews, and duplicate warehouse specs are additional sections. Keep them only if the client explicitly relaxes the exact-structure requirement.
- No component tests currently protect shared variant/mode/price/action synchronization. Existing retailer service tests cover live variants and per-variant Exchange behavior only (`packages/api/src/services/retailer-store-product-detail.test.ts:5-115`, `:117-282`).

## Migration order

1. Extract and test the public markup/selection controller as the seller-neutral shared shell without changing public behavior.
2. Add the shared `PRD-######` formatter and normalize public, retailer, and warehouse route models.
3. Add retailer review/sold aggregates and define/add truthful warehouse review/sold aggregates.
4. Migrate retailer detail to the shell and connect its direct-cart adapter, including exact selected New/Exchange mode.
5. Refactor warehouse actions into a controlled adapter, preserving all buyer modes and both B2B order APIs; migrate `WarehouseProductDetailPage` once for both routes.
6. Remove obsolete duplicated layout/action markup only after parity tests pass.
7. Run public, retailer, warehouse-retailer, warehouse-to-warehouse, view-only, guest, preview, responsive, and exact-structure browser checks.

## Acceptance checklist

- Public, retailer, and both warehouse detail URLs render the same breadcrumb, Back/title row, image/facts layout, `PRD-######`, price/rating/sold row, selectors, action position, and Description/Reviews tabs from one component.
- Variant and New/Exchange changes update visible price, description facts, allowed quantity, and submitted payload from one selected state.
- Public Add remains `open_order`, has no shop, uses Reference Price semantics, and ignores seller inventory caps.
- Retailer Add remains `direct`, uses exact `shopId`, owner variant, live stock/price, order constraints, and selected cylinder mode.
- Shop Owner warehouse buyers retain retailer-to-warehouse cart/order behavior; connected Warehouse Owner buyers retain warehouse-supplier cart/order behavior.
- Unconnected warehouse buyers remain view-only; guests remain login-only; warehouse-to-warehouse remains New-only.
- Exchange appears only for the exact eligible variant and its visible effective price matches the stored/submitted mode.
- Retailer and warehouse review/sold values use their own approved order semantics; no Admin reference statistics are copied.
- Old gallery, badge, trust, standalone feature/review, related-product, and duplicate warehouse detail blocks are absent unless approved as part of the public canonical design.
- Tests prove each adapter reaches its existing server flow and no retailer or warehouse action accidentally creates an Open Order.
