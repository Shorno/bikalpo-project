# Public Retailer Storefront: Design-Parity Research

**Scope.** This report compares the supplied retailer-store wireframe with the consumer-facing storefront implementation. The repository baseline is commit `4dadea6a`; concurrent application-code worktree changes were intentionally excluded from the baseline. No application code was changed by this research task, and no web sources were used.

## Conclusion

The public consumer route is **`/stores/[slug]`**. It loads `customer.getShopBySlug`, renders a shared `StoreHeader`, a separate catalog search/sort panel, a left category sidebar, and `StorefrontProductCard` rows (`apps/web/app/(public)/stores/[slug]/page.tsx:48-128`, `:250-405`; `apps/web/components/storefront/retailer-storefront.tsx:98-197`, `:305-330`, `:438-731`).

The supplied design instead calls for this sequence: compact one-row storefront navigation; store identity and real store facts/actions; a promotion carousel; horizontal categories; five quick-filter chips; the existing product-card grid; and trust/service cards (`C:/Users/Shorno/.codex/attachments/357a6ea9-1489-41bd-a3ce-d0da6d7b27ba/pasted-text.txt:1-35`, `:36-141`).

The product card should remain an implementation boundary: leave `StorefrontProductCard` content and interaction design unchanged and alter only the page composition and permitted grid/card sizing (`apps/web/components/storefront/retailer-storefront.tsx:438-731`; **Task brief — “there should be no change in the product card design”**).

## Route and component map

- The public page component is `apps/web/app/(public)/stores/[slug]/page.tsx`. It reads the slug and URL filters, calls `orpc.customer.getShopBySlug`, and paginates 12 products (`apps/web/app/(public)/stores/[slug]/page.tsx:48-70`, `:114-128`).
- The page uses `StoreHeader`, `StorefrontCategorySidebar`, `StorefrontMobileFilters`, `ActiveFilterSummary`, `StorefrontProductCard`, empty state, and skeleton exports from one module (`apps/web/app/(public)/stores/[slug]/page.tsx:8-20`; `apps/web/components/storefront/retailer-storefront.tsx:98-197`, `:305-420`, `:438-854`).
- Product-card links resolve to `/stores/{shopSlug}/products/{productSlug}` (`apps/web/lib/retailer-storefront-url.ts:3-14`). The detail page is `apps/web/app/(public)/stores/[slug]/products/[productSlug]/page.tsx` (`apps/web/app/(public)/stores/[slug]/products/[productSlug]/page.tsx:11-25`, `:56-106`).
- Every public route inherits the shared `Navbar` and `Footer`; they are outside the store page itself (`apps/web/app/(public)/layout.tsx:1-14`). Any store-only navigation treatment must therefore be route-aware so it does not unintentionally redesign all public pages.
- The owner dashboard's `/dashboard/stores` page is a separate, duplicated preview UI. Its **View as customer** action points to the public route, so the requested consumer scope is `/stores/[slug]`, not a redesign of that management page (`apps/web/app/shop/(management)/dashboard/stores/page.tsx:38-81`, `:104-143`).

## Documentation-to-current comparison

| Area | Documentation contract | Baseline implementation | Required change |
|---|---|---|---|
| Top navigation | One row with hamburger, logo, product search, and overflow menu (`pasted-text.txt:1-3`). | The shared navbar has a main row with logo/global search/cart/account plus a second row for Products, Offers, Stores, For business, and Contact (`apps/web/components/layout/navbar.tsx:29-100`). | Use a store-route-specific one-row variant and remove the second link row on this route only. Keep cart/account access available inside the compact treatment even though the ASCII wireframe does not spell out behavior. |
| Search | A single product search in the top row (`pasted-text.txt:1-3`). | Top search queries the platform-wide reference catalog and routes to `/products/...`; a second box lower on the page searches the current store (`apps/web/components/layout/navbar-search.tsx:29-62`, `:78-87`; `apps/web/app/(public)/stores/[slug]/page.tsx:58`, `:140-149`, `:297-322`). | Bind the top-row search to this storefront's `q` URL parameter and remove the duplicate catalog search box. Do not reuse global-search results, because they can navigate away from the retailer. |
| Store profile | Name, address, opening hours, rating, orders, customers, followers, and Follow/Contact/Report actions (`pasted-text.txt:5-12`). | The header has breadcrumb, image, name, “Verified retailer,” business type/product count, address, an address-derived delivery badge, and All stores (`apps/web/components/storefront/retailer-storefront.tsx:106-195`). | Remove the breadcrumb and All stores treatment. Render only facts/actions backed by real response data; omit unavailable rows/buttons rather than filling the examples. |
| Promotion | Text offer banner/carousel with arrows and pagination dots (`pasted-text.txt:14-23`). | No section exists between `StoreHeader` and the catalog (`apps/web/app/(public)/stores/[slug]/page.tsx:250-260`). | Add a conditional carousel fed by genuinely active, currently valid, generally eligible retailer offers. Hide it when there are none; never seed the wireframe's example offers. |
| Categories | Horizontal category chips (`pasted-text.txt:25-28`). | Sticky 240px desktop sidebar; mobile sheet; both include category/subcategory counts (`apps/web/components/storefront/retailer-storefront.tsx:207-330`, `:340-420`; `apps/web/app/(public)/stores/[slug]/page.tsx:354-367`). | Replace the sidebar with an overflow-safe horizontal row backed by the real `facets`; include All plus actual categories. Preserve URL-driven category behavior. |
| Quick filters | All, In Stock, Low Price, Popular, Discount (`pasted-text.txt:30-33`). | No quick-filter row; a Sort by select offers Recommended, Newest, two price directions, and Name A–Z (`apps/web/app/(public)/stores/[slug]/page.tsx:325-344`). | Replace the select visually with the five documented chips and implement truthful semantics described below. |
| Product grid | Two-up examples, with product cards carrying their existing retail controls (`pasted-text.txt:36-133`). | Grid is one column, two from 430px, and three at XL; cards are rendered through `StorefrontProductCard` (`apps/web/app/(public)/stores/[slug]/page.tsx:383-398`). | Adjust only grid/card sizing to match the two-column document where space allows. Do not edit the card's content, variants, ratings, price, availability, cart stepper, or Details behavior. |
| Trust/service | Home delivery and Cash/Online Payment cards (`pasted-text.txt:135-141`). | Missing from the public page. The inherited generic footer is not this section (`apps/web/app/(public)/layout.tsx:11-13`; `apps/web/components/layout/footer.tsx:23-68`). | Add only truthful platform/store capabilities. Payment support is backed; “same day delivery” is not. |

## Real-data inventory and no-dummy boundary

### Already available to the public page

- Store identity currently includes `id`, `name`, `shopName`, `shopSlug`, `shopAddress`, `businessType`, `image`, and coordinates (`packages/api/src/routers/customer.ts:3595-3607`, baseline `4dadea6a`). Name, image, and address can therefore be rendered without new persistence.
- The endpoint constructs real sellable store products, requiring an active/public shop-owned product, positive inventory, and positive retail price (`packages/api/src/routers/customer.ts:3624-3685`, baseline `4dadea6a`).
- It returns real category/subcategory facets and supports search, category, subcategory, and sort URL inputs (`packages/api/src/routers/customer.ts:3582-3592`, `:3731-3746`, baseline `4dadea6a`; `packages/api/src/routers/helpers/retailer-storefront-catalog.ts:75-112`, `:129-190`).
- Per-page product rating/review and sold-order counts are real and are added to product rows (`packages/api/src/routers/customer.ts:818-876`, `:3747-3762`, baseline `4dadea6a`). These remain product-card facts; they are not automatically store-level facts.

### Persisted or derivable, but not in the baseline public response

- A phone number is persisted on `user`, and the private owner preview already returns it, but baseline `getShopBySlug` does not select it (`packages/db/src/schema/auth-schema.ts:4-12`; `packages/api/src/routers/shop-owner.ts:8994-9012`, `:9182-9192`; `packages/api/src/routers/customer.ts:3595-3607`, baseline `4dadea6a`). A Contact button can be real only after an explicit decision to expose that number as the retailer's public contact.
- Total B2C orders and distinct customers are derivable from `order.shopId`/`order.userId`. The private owner stats endpoint already calculates both for its own shop (`packages/api/src/routers/shop-owner.ts:9200-9212`, `:9246-9251`). The public store query needs an equivalent safe aggregate before those values appear in the header.
- There is no store-review relation. The private owner stats endpoint computes “avgRating” from product reviews across products in shop inventory (`packages/api/src/routers/shop-owner.ts:9214-9243`). If the same aggregate is exposed publicly, document it as a catalog/product-review aggregate or explicitly accept it as the store-rating definition; do not invent a client-side rating.
- Shop-owned executable offers have real name, product/category scope, discount, validity, target, and lifecycle fields (`packages/db/src/schema/retailer-offer.ts:42-123`). However, all existing retailer-offer listing/management calls are owner-authenticated (`packages/api/src/routers/retailer-offer.ts:416-426`, `:560-587`), so baseline `getShopBySlug` cannot populate a public carousel.
- Offer visibility must respect the same real validity/eligibility ideas as checkout: active time window, all-day/custom hours, usage maximum, customer target, and area target are enforced by the offer engine (`packages/api/src/services/retailer-offer-engine.ts:53-76`, `:117-139`). For an anonymous public banner, the safe first scope is active, valid, `all_customers` offers; targeted offers need actual customer/area context.
- The platform's direct checkout genuinely offers Cash on delivery, bKash, and Nagad (`apps/web/app/shop/(storefront)/checkout/page.tsx:104-129`, `:865-920`; `packages/api/src/routers/customer.ts:4635-4637`). A trust card may state those platform payment methods, but the data is not a retailer-specific capability setting.

### Unavailable and therefore omitted until modeled

- `user` has no opening/closing-hours fields (`packages/db/src/schema/auth-schema.ts:18-59`). Do not print the wireframe's `8:00 AM – 11:00 PM` example.
- The repository has no follower/following store model or API. Do not render `500+ Follower`, fake a Follow Store state, or keep follow state only in the browser. This is a repository-wide source search result; no local source line can cite a nonexistent symbol.
- The support-ticket API creates a general authenticated customer ticket with subject/message/priority, but has no store target (`packages/api/src/routers/customer.ts:5636-5671`). A Report Issue action may route to the existing support experience, but it cannot claim store-specific reporting until a store reference is carried and persisted.
- “Same day delivery” is not stored as a shop capability. The private preview currently hardcodes that sentence (`apps/web/app/shop/(management)/dashboard/stores/page.tsx:347-375`); copying it to the public view would violate the no-dummy requirement.
- The baseline header's “Delivery from this location” is inferred solely from presence of an address (`apps/web/components/storefront/retailer-storefront.tsx:177-183`). Address existence is not evidence of a delivery promise, so remove or replace it with an actual capability.
- Avoid fallback copy that turns missing business type into `Retail`; the baseline does this at render time (`apps/web/components/storefront/retailer-storefront.tsx:157-160`). Under the task's no-dummy rule, render business type only when present.

## Quick-filter semantics

1. **All** clears quick-filter state and keeps the documented/default catalog ordering.
2. **In Stock** is truthful but currently equivalent to All because the endpoint already removes zero-stock products (`packages/api/src/routers/customer.ts:3673-3685`, baseline `4dadea6a`). Keep the chip only if this intentional equivalence is acceptable; otherwise the catalog contract must include unavailable products.
3. **Low Price** maps directly to existing `price_asc` sorting (`packages/api/src/routers/helpers/retailer-storefront-catalog.ts:3-9`, `:158-169`).
4. **Popular** must sort the complete filtered catalog by real store sold-order counts before pagination. In the baseline, pagination happens first and sold counts are fetched only for the page, so a client-side/page-only sort would be incorrect (`packages/api/src/routers/customer.ts:3731-3762`, baseline `4dadea6a`).
5. **Discount** must use real active retailer-offer applicability (product, variant, category, or all products), not just decorative card state (`packages/db/src/schema/retailer-offer.ts:57-84`). If the public offer projection is not ready, omit/disable this chip rather than pretending every reduced base/retail price is an active offer.

## Precise implementation checklist

### Page shell and header

- [ ] Detect the exact `/stores/[slug]` index route and render a compact one-row navbar there; do not apply it to `/stores`, product detail pages, or other public routes unless separately requested.
- [ ] Include hamburger, existing logo, store-local search, and an overflow menu in the documented order (`pasted-text.txt:1-3`).
- [ ] Preserve cart/account access in the compact route header and preserve `preview=customer` through navigation/search changes (`apps/web/lib/customer-storefront-preview.ts:1-18`).
- [ ] Remove the store breadcrumb and All stores button (`apps/web/components/storefront/retailer-storefront.tsx:108-129`, `:184-191`).
- [ ] Remove the duplicate boxed **Product catalog** search/sort panel after search moves into the top row (`apps/web/app/(public)/stores/[slug]/page.tsx:261-352`).

### Store identity

- [ ] Render actual store image only when available, actual `shopName || name`, and actual address only when present.
- [ ] Add total orders, distinct customers, and the explicitly chosen rating aggregate to the public response; render stats only when returned.
- [ ] Expose a public business contact only after confirming the persisted phone is intended for publication; render Contact only then.
- [ ] Omit opening hours, follower count, and Follow Store until their schema/API exists.
- [ ] Link Report Issue to the real support flow only if the desired generic-versus-store-targeted behavior is accepted; do not create a dead button.
- [ ] Do not substitute example figures, labels, hours, delivery claims, or zeroes for missing optional facts.

### Offers, categories, and filters

- [ ] Add a public, minimal projection of active/current/universal retailer offers, excluding private targeting keys and management-only fields.
- [ ] Render the promotion carousel only when real eligible offers exist; use offer name/discount/product summary from data, and derive arrows/dots from the returned item count.
- [ ] Render an All chip plus actual category facets in a horizontal, horizontally scrollable navigation row; keep category selection in the URL.
- [ ] Replace the desktop sidebar/mobile filter sheet and Sort-by select with the documented quick-filter row.
- [ ] Implement Popular server-side before pagination and Discount against actual active-offer applicability.
- [ ] Keep loading, error, empty, active-filter, and pagination behavior working after the layout change (`apps/web/app/(public)/stores/[slug]/page.tsx:207-239`, `:369-405`; `apps/web/components/storefront/retailer-storefront.tsx:734-854`).

### Product cards and trailing content

- [ ] Do not change `StorefrontProductCard` markup/content/interactions (`apps/web/components/storefront/retailer-storefront.tsx:438-731`).
- [ ] Change only the grid/container sizing so the documented two-up layout is reached at suitable widths (`apps/web/app/(public)/stores/[slug]/page.tsx:383-398`).
- [ ] Preserve product detail URLs, quick-add behavior, cart quantity updates, preview disabling, and pagination (`apps/web/app/(public)/stores/[slug]/page.tsx:166-205`, `:383-400`).
- [ ] Add a Cash/Online Payment trust card from the real checkout capabilities. Add Home Delivery only with truthful generic copy; omit “Same day delivery” until backed by a store capability.
- [ ] Decide explicitly whether the generic public footer stays. It is not present in the wireframe, but removing it is a shared-shell choice rather than part of `StorefrontProductCard` (`apps/web/app/(public)/layout.tsx:9-14`).

## Acceptance criteria

- The consumer at `/stores/{slug}` sees the supplied section order without the old breadcrumb, All stores action, second navigation row, boxed duplicate search/sort panel, or left category sidebar.
- Search in the compact top bar changes the current store's `q` and never opens global reference-catalog results.
- Every visible store fact, statistic, promotion, category, filter result, and service statement is backed by repository data; missing hours/follow/service settings do not generate fallback examples.
- Categories and the five quick-filter concepts are horizontal and usable on narrow screens without overflowing the viewport.
- Popular ordering is computed across the complete filtered result before pagination; Discount shows only products covered by a currently eligible real offer.
- Empty offers omit the carousel cleanly; one offer has no misleading navigation controls; multiple offers expose working arrows/dots.
- `StorefrontProductCard` content and interaction design are unchanged; only the surrounding layout/card width changes.
- Existing preview mode, add-to-cart/quantity, product-detail navigation, error/empty/loading states, and pagination remain functional.

