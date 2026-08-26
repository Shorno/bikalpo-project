# Public Product Card: Open-Order Cart Research

**Scope.** This report traces the requested public reference-product card interaction from catalog data through cart state and Open Order placement. It uses repository source only, at baseline commit `e87f9353e5eb6dc0816410f20ffbd51bbf821822`; no web sources were used and no application code was changed.

## Conclusion

The public card is not missing a separate commerce system. It already renders through the same shared `StorefrontProductCard` used by a retailer storefront, but `ConsumerProductCard` selects `mode="reference"`, and that branch is deliberately hard-coded to show **View details** instead of the shared Add-to-cart/quantity controls (`apps/web/components/features/products/consumer-product-card.tsx:71-100`; `apps/web/components/storefront/storefront-product-card.tsx:293-311`).

The correct Open Order line identity is:

```text
productId + variantId + shopId(null) + cylinderSaleMode(new|exchange)
```

The server already uses that identity when it decides whether to increment an existing line or insert a new one. It locks the customer's cart, matches product, exact variant, nullable shop, and cylinder sale mode, then increments only that matching line (`packages/api/src/routers/customer.ts:4861-4912`, `:4973-4989`). Therefore, the public card should find the current cart line with the same tuple and call the existing `addItem`/`updateQuantity` context operations; it should not introduce a second cart store or a client-only counter.

The safest implementation boundary is:

1. Let `ConsumerProductCard` connect the reference card to the existing `useCart()` context and pass the same cart callbacks/state shape already used by retailer storefront cards.
2. Generalize only the action/cart-identity branch inside `StorefrontProductCard` so reference mode uses `shopId == null` and `purchaseMode="open_order"`, while storefront mode continues to use its exact retailer `shopId` and `purchaseMode="direct"`.
3. Keep product/variant/type selection local to the card, but derive the button versus stepper from authoritative `cartItems` after every mutation.
4. Do not use retailer stock as an Open Order limit: `ConsumerProductCard` currently sets `totalAvailableQty: 0`, so reusing the storefront stock checks unchanged would disable every reference-card add and increment action (`apps/web/components/features/products/consumer-product-card.tsx:94-99`; `apps/web/components/storefront/storefront-product-card.tsx:129-131`, `:344-360`).
5. Before calling quantity-update parity complete, make reference-price resolution consistent across add, cart read/update, and Open Order placement. `addToCart` resolves the active linked consumer reference price, but `getCart`, `updateCartItem`, and `placeOpenOrder` currently recalculate from `productVariant.price` (`packages/api/src/routers/customer.ts:2799-2823`, `:4805-4843`, `:5095-5114`, `:6659-6691`). Generated variants are intended to mirror consumer prices, but using one resolver everywhere removes drift as a correctness assumption (`packages/api/src/routers/helpers/sync-generated-variants.ts:205-238`, `:341-366`; `packages/api/src/routers/product.ts:1643-1649`).

## Current public-card selection behavior

### Catalog contract

`customer.getReferenceProducts` is the authoritative public-card endpoint. It only keeps Admin reference products with at least one exact variant eligible for Open Orders. Eligibility requires an active/public/published Admin product with core product and brand identity, plus an active configured catalog variant belonging to that same product/core/brand (`packages/api/src/routers/customer.ts:1501-1650`; `packages/api/src/routers/helpers/reference-product-catalog.ts:31-83`).

For each card, the endpoint:

- filters again to eligible Open Order variants;
- sorts by `sortOrder`, then variant ID;
- returns the concrete `variantId`, labels, active consumer reference price, exchange capability, and exchange credit (`packages/api/src/routers/customer.ts:1694-1723`).

`ConsumerProductCard` maps those rows into the shared card's variant model, including `displayPrice`, `exchangeEnabled`, `exchangeCreditAmount`, and `canExchange`, and explicitly selects reference mode (`apps/web/components/features/products/consumer-product-card.tsx:26-35`, `:55-74`).

### Variant and New/Exchange selection

The shared card initializes the selected variant to the first API-sorted row and initializes cylinder mode to Exchange. If that exact variant is not exchange-enabled, the effective mode is forced to New. When a user changes size, the card resets the mode to Exchange for an exchange-enabled variant or New otherwise (`apps/web/components/storefront/storefront-product-card.tsx:84-98`, `:151-161`). It displays the New/Exchange radio group only for an exchange-enabled selected variant (`apps/web/components/storefront/storefront-product-card.tsx:274-282`).

That behavior matches the product-details defaulting rule. The details view sorts active variants by `sortOrder` and ID, selects the first one, takes the variant's server-provided `defaultMode`, and resets to the next variant's default when size changes (`apps/web/components/features/products/public-product-details-view.tsx:97-115`, `:199-202`). The details API defines `defaultMode` as Exchange only when that exact LPG variant has exchange enabled (`packages/api/src/routers/customer.ts:2149-2185`).

One visual parity gap exists today: the public card's displayed `selectedPrice` chooses `displayPrice`/retail price but does not subtract `exchangeCreditAmount` when Exchange is selected (`apps/web/components/storefront/storefront-product-card.tsx:121-128`). The details view does calculate New versus Exchange price immediately (`apps/web/components/features/products/public-product-details-view.tsx:125-138`). If “same as product details” includes the selected-mode price, the shared card calculation should use the same rule.

## How product-details Add Cart reaches Open Orders

The public details view passes the exact selected variant and effective New/Exchange mode into `ProductActions`, explicitly setting `purchaseMode="open_order"` (`apps/web/components/features/products/public-product-details-view.tsx:387-435`). `ProductActions` maintains its pre-add quantity locally and delegates:

```text
addItem(product.id, quantity, variantId, undefined, "open_order", cylinderSaleMode)
```

through the shared cart context (`apps/web/components/features/products/product-actions.tsx:50-62`, `:80-94`).

`OrpcCartProvider.addItem` requires login, opens the existing login-required modal for an anonymous visitor, builds the request, and defaults a no-shop request to Open Order. It also owns the existing confirmation flow for replacing an incompatible direct-retailer cart (`apps/web/hooks/use-orpc-cart.tsx:97-118`, `:133-170`, `:231-256`).

On the server, `customer.addToCart`:

- rejects a shop ID on an Open Order request (`packages/api/src/routers/customer.ts:4673-4684`);
- verifies the exact product/variant pair is still eligible for Open Orders (`packages/api/src/routers/customer.ts:4700-4731`);
- defaults to Exchange only when that exact variant supports it and rejects an invalid Exchange request (`packages/api/src/routers/customer.ts:4778-4797`);
- resolves effective New/Exchange unit price and validates cylinder pricing (`packages/api/src/routers/customer.ts:4799-4851`);
- enforces the cart mode transition, requiring explicit replacement when direct and Open Order carts would mix (`packages/api/src/routers/customer.ts:4861-4897`);
- increments the exact matching line or inserts a new one and returns **Added to open order** (`packages/api/src/routers/customer.ts:4899-4999`).

The details action is therefore already an Open Order add. It is not a retailer checkout add. However, its UI is not currently an authoritative cart-state stepper: it starts a local quantity selector at the variant minimum and each Add press adds that amount; it does not inspect whether that exact line already exists (`apps/web/components/features/products/product-actions.tsx:50-94`, `:101-131`). The requested card behavior should reuse the backend path while using the stronger synchronized behavior already present on retailer cards.

## Current client-side cart synchronization

Every non-dashboard route is wrapped in one `OrpcCartProvider`, so all public product cards and the navbar/checkout observe the same cart context (`apps/web/app/providers.tsx:11-38`). The provider exposes `mode`, `items`, `addItem`, `removeItem`, `updateQuantity`, and cylinder-mode updates (`apps/web/hooks/use-orpc-cart.tsx:39-91`, `:212-228`).

For authenticated users, `getCart` returns each line's `productId`, `variantId`, nullable `shopId`, quantity, and—on LPG variants—the persisted cylinder mode and effective pricing metadata (`packages/api/src/routers/customer.ts:2674-2735`, `:2799-2861`). The client `CartItem` type exposes those same identity fields and `cylinderSale.mode` (`apps/web/hooks/use-orpc-cart.tsx:39-64`).

All add, update, remove, and clear mutations invalidate the same `customer.getCart` React Query key. That refetch is the existing cross-component synchronization mechanism (`apps/web/hooks/use-customer-api.ts:155-161`, `:187-230`). `updateQuantity` removes a line when the requested quantity reaches zero; otherwise it calls the cart update mutation (`apps/web/hooks/use-orpc-cart.tsx:173-183`). On the server, removal of the final line also resets cart mode and direct shop identity (`packages/api/src/routers/customer.ts:5038-5053`).

The retailer card already demonstrates the intended render behavior: it finds the exact cart item, renders Add when absent, and renders decrement/current quantity/increment when present (`apps/web/components/storefront/storefront-product-card.tsx:132-144`, `:301-374`). Public reference mode is simply excluded from that lookup and action branch today (`apps/web/components/storefront/storefront-product-card.tsx:132-141`, `:293-301`).

## Exact identity and interaction rules

For a reference card, the selected cart line should be:

```ts
const cartItem = cartItems.find(
  (item) =>
    item.productId === product.id &&
    item.variantId === selectedVariant.variantId &&
    item.shopId == null &&
    (item.cylinderSale?.mode ?? "new") === effectiveCylinderSaleMode,
);
```

The nullable-shop check is essential: a direct retailer line may use the same product and variant identifiers but is not the same cart source. The mode check is equally essential: New and Exchange are separate lines by server design, and both may coexist for one exact variant because the add deduplication includes `cylinderSaleMode` (`packages/api/src/routers/customer.ts:4899-4912`). The database persists cart mode, variant ID, nullable shop ID, and cylinder mode separately (`packages/db/src/schema/cart.ts:16-29`, `:46-70`).

Expected behavior by selection:

| Current selection | Matching cart line | Card action |
|---|---:|---|
| 12 KG + Exchange | none | **Add to cart** |
| 12 KG + Exchange | quantity 1 | `[-] 1 [+]` |
| 12 KG + New | none, while Exchange exists | **Add to cart** |
| 12 KG + New | quantity 3 | `[-] 3 [+]` |
| 16 KG + Exchange | none, while 12 KG + Exchange exists | **Add to cart** |

Pressing Add should delegate exactly once with quantity 1:

```text
addItem(productId, 1, variantId, undefined, "open_order", cylinderSaleMode)
```

Pressing plus should call `updateQuantity(cartItem.id, cartItem.quantity + 1)`. Pressing minus at 1 should call `updateQuantity(cartItem.id, 0)`, allowing the existing context/server removal behavior to return the card to **Add to cart**. This is preferable to calling `addItem` for every plus because update-by-line-ID is unambiguous and matches the retailer card's existing stepper (`apps/web/components/storefront/storefront-product-card.tsx:311-351`; `apps/web/hooks/use-orpc-cart.tsx:173-183`).

## Safe implementation seams

### 1. Reference adapter: `ConsumerProductCard`

Connect `ConsumerProductCard` to `useCart()` and keep reference-specific mutation state here. This component is already a client component and is the single adapter that turns public API rows into the shared card model (`apps/web/components/features/products/consumer-product-card.tsx:1-4`, `:46-103`). Doing this here avoids duplicating handlers in the home, all-products, category, and related-products grids, all of which render `ConsumerProductCard` (`apps/web/app/(public)/page.tsx:38-71`; `apps/web/components/features/products/public-products-grid.tsx:30-92`; `apps/web/components/features/products/products-grid.tsx:31-70`; `apps/web/components/features/products/related-products.tsx:15-44`).

Add a small pure `addReferenceProductToCart` helper parallel to `addRetailerProductToCart`. The existing retailer helper captures the correct seam and has narrow argument-forwarding tests (`apps/web/lib/retailer-quick-add.ts:1-22`; `apps/web/lib/retailer-quick-add.test.ts:5-37`). The reference helper should omit `shopId`, force `open_order`, pass quantity 1, and preserve the exact cylinder mode.

### 2. Shared presentation: `StorefrontProductCard`

Keep one card design. Generalize its exact-cart-line lookup and action branch rather than cloning markup. The mode already provides the necessary semantic split (`apps/web/components/storefront/storefront-product-card.tsx:54-69`).

The reference branch must not inherit the retailer stock gates. Reference products are intentionally not tied to one seller's inventory; the Open Order placement process later searches nearby retailers that can fulfill the complete request (`packages/api/src/routers/customer.ts:6698-6711`). Today the reference adapter sets total available quantity to zero, while the retailer branch disables Add at zero and plus at the selected available quantity (`apps/web/components/features/products/consumer-product-card.tsx:94-99`; `apps/web/components/storefront/storefront-product-card.tsx:344-360`). For reference mode, enable Add whenever an eligible selected variant exists and cap only by the Open Order quantity contract.

The requested visible action is the initial **Add to cart** button changing into a stepper. Image and product name already remain links to details, so replacing the reference-mode **View details** button does not remove detail navigation (`apps/web/components/storefront/storefront-product-card.tsx:163-200`, `:293-300`).

### 3. Quantity constraints and data contract

The details action supports `orderMin`, `orderMax`, and `orderIncrement`, and defaults Open Order maximum to 999 (`apps/web/components/features/products/product-actions.tsx:20-22`, `:50-57`). The public card API currently omits those three fields from `cardVariants`; it returns only identity/labels/price/exchange data (`packages/api/src/routers/customer.ts:1694-1723`).

The task specifically says initial quantity 1 and direct increments, so a first implementation can use one-unit steps. If “exactly like product details” also means variant-specific minimum/increment/maximum, extend the public-card variant projection and shared-card type with those three fields before enforcing them. Do not silently apply retailer `availableQty` to Open Orders.

### 4. Data-producer completeness

The current primary public home, `/products`, `/products/[category]`, and server-rendered related-products paths use `getReferenceProducts`, which includes actionable variants (`apps/web/app/(public)/page.tsx:38-39`; `apps/web/components/features/products/public-products-grid.tsx:30-33`; `apps/web/components/features/products/products-grid.tsx:31-34`; `apps/web/components/features/products/related-products.tsx:15-22`).

Two legacy producers still render `ConsumerProductCard` after stripping variants: `getCustomerProducts` and `getCategoriesWithProducts` destructure them out of the response (`packages/api/src/routers/customer.ts:2010-2035`, `:2422-2450`). Their consumers include the legacy `/shop` category listing and a role-aware related-products view (`apps/web/components/features/products/orpc-category-listing.tsx:9-69`; `apps/web/components/shop/product-detail-client.tsx:440-473`). A global `ConsumerProductCard` action must either migrate those callers to the reference endpoint/shape or deliberately render a non-action fallback when no exact `variantId` is available. Never add an Open Order line without a variant: the server explicitly requires an eligible exact reference variant (`packages/api/src/routers/customer.ts:4700-4731`).

### 5. Reference-price consistency prerequisite

The selected card price is sourced from linked active `productVariantPrice.consumerPrice` with `productVariant.price` as fallback (`packages/api/src/routers/customer.ts:1703-1723`). `getProductDetails` follows the same resolution and returns mode-specific prices (`packages/api/src/routers/customer.ts:2149-2185`). `addToCart` also tries the linked price row by `sourceVariantPriceId`, falls back by `sourceVariantOptionId`, then uses the variant price (`packages/api/src/routers/customer.ts:4805-4843`).

By contrast:

- `getCart` uses `variant.price` for Open Order current/listed price (`packages/api/src/routers/customer.ts:2799-2823`);
- `updateCartItem` recomputes reference cylinder price from `item.variant.price` (`packages/api/src/routers/customer.ts:5095-5114`);
- `placeOpenOrder` freezes the request from `item.variant.price` (`packages/api/src/routers/customer.ts:6659-6691`).

Generated variant synchronization normally writes consumer price into `productVariant.price`, including Admin price edits (`packages/api/src/routers/helpers/sync-generated-variants.ts:231-238`, `:341-366`; `packages/api/src/routers/product.ts:1643-1649`). Even so, the add path's extra linked lookup means the system currently has two definitions of “reference price.” The card quantity button will exercise `updateCartItem` frequently, so one shared server-side resolver should be used by list, details, add, get, update, and place before claiming end-to-end price parity.

## Open Order destination

The cart's `mode` drives checkout. Checkout treats `mode === "open_order"` as an Open Order, calls `placeOpenOrder`, and routes a successful request to `/open-orders/{id}` (`apps/web/app/shop/(storefront)/checkout/page.tsx:237-252`, `:491-525`). The Open Order endpoint rejects any cart that is not an Open Order cart or contains retailer-bound items, revalidates every exact reference variant, freezes the persisted cylinder mode and price snapshots, and asks `findEligibleSellers` for retailers that can fulfill the complete request (`packages/api/src/routers/customer.ts:6571-6649`, `:6650-6711`).

Thus, using `addItem(..., undefined, "open_order", selectedMode)` from the public card is sufficient to enter the real Open Order system. No new order endpoint or retailer selection should be added to the card.

## Failure and edge-state behavior

- **Anonymous user:** leave the action visible. Existing `addItem` opens the login-required modal and does not create local fake state (`apps/web/hooks/use-orpc-cart.tsx:133-144`).
- **Customer preview:** keep ordering disabled, as the shared card already does for storefront preview; do not mutate a real cart from preview (`apps/web/components/storefront/storefront-product-card.tsx:301-310`).
- **Direct cart already exists:** preserve the existing replace-cart dialog; Open Order and direct lines cannot mix (`apps/web/hooks/use-orpc-cart.tsx:155-170`, `:231-256`).
- **Exchange disabled on selected variant:** effective mode must be New and the Exchange selector must disappear (`apps/web/components/storefront/storefront-product-card.tsx:93-98`, `:274-282`).
- **Switching variant/type:** immediately recompute the exact line lookup. The counter must disappear unless that newly selected tuple exists.
- **Minus at one:** remove only the exact line. If it was the final line, cart mode resets to null (`apps/web/hooks/use-orpc-cart.tsx:177-183`; `packages/api/src/routers/customer.ts:5038-5053`).
- **Concurrent clicks:** disable the exact card action/line while its mutation is pending, following the existing retailer card pattern (`apps/web/components/storefront/storefront-product-card.tsx:142-144`, `:325-346`). Server cart locking protects the final stored result (`packages/api/src/routers/customer.ts:4861-4865`, `:5019-5023`).
- **No actionable variant:** do not send a product-only Open Order add. Render a disabled/unavailable action or details fallback until the caller supplies the actionable reference-card shape.

## Test seams

1. Add a pure reference quick-add test mirroring `retailer-quick-add.test.ts`, asserting the exact call tuple `[productId, 1, variantId, undefined, "open_order", cylinderSaleMode]` (`apps/web/lib/retailer-quick-add.test.ts:5-37`).
2. Extract/test the cart-line matcher for:
   - same product/variant, New versus Exchange as separate lines;
   - different variants as separate lines;
   - `shopId == null` required for reference mode;
   - non-LPG cart rows with `cylinderSale == null` matching New only.
3. Test shared-card state transitions: Add when absent, stepper when present, type/variant switch returning to Add when the new tuple is absent, and decrement from one invoking quantity zero.
4. Add API integration coverage proving duplicate exact selection increments, New and Exchange coexist, decrement-to-zero removes only one line, and an Open Order add does not bypass replacement of a direct cart.
5. Add a price-consistency test that changes an active consumer reference price and verifies list, details, add response/cart read, quantity update, and frozen Open Order item all use the same effective New/Exchange unit price.

## Acceptance checklist

- Every actionable public reference card starts with the first API-sorted eligible variant and its valid default New/Exchange mode.
- The initial action says **Add to cart** and adds exactly one unit through `purchaseMode="open_order"` with no `shopId`.
- The action changes to a synchronized `[-] quantity [+]` only when the exact selected product + variant + type reference line exists.
- Selecting a different variant or New/Exchange mode shows that selection's independent cart state.
- Plus and minus update the persisted cart immediately; minus at one removes that exact line and restores **Add to cart**.
- Cart totals/navbar/checkout and every other card instance update through the existing shared `getCart` invalidation.
- Reference actions are not disabled by retailer inventory fields; Open Order seller availability remains a placement-time server decision.
- Anonymous, preview, direct-cart replacement, mutation-pending, and no-variant states use the existing safe behaviors.
- The resulting cart remains `mode="open_order"`, has null `directShopId`/item `shopId`, and reaches the existing atomic Open Order placement and seller-matching flow.
- List, details, cart add/read/update, and frozen Open Order snapshots resolve one canonical reference price for the exact variant and cylinder mode.
