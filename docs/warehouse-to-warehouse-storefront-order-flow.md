# Warehouse-To-Warehouse Storefront Ordering Plan

## Summary

- Change warehouse-to-warehouse purchasing from the dashboard-only supplier order page to the supplier warehouse storefront at `/w/{warehouseSlug}`.
- Update the warehouse dashboard supplier list so active warehouse suppliers render as clickable cards that open the main-domain storefront, for example `http://bikalpo.localhost:3001/w/algoverse`.
- Reuse the existing W2W order backend, especially `warehouse.placeWarehouseSupplierOrder`; no database migration is needed.

## Key Changes

- In `apps/web/app/warehouse/(management)/dashboard/suppliers/page.tsx`, replace the active warehouse supplier table with a responsive card grid. Each card should show warehouse name, slug, address, phone, product count, status, and last ordered date.
- Make the whole active supplier card link to `${NEXT_PUBLIC_APP_SUBDOMAIN_URL || "http://bikalpo.localhost:3001"}/w/${warehouseSlug}`. If a supplier has no `warehouseSlug`, keep the card disabled with clear "Storefront unavailable" copy.
- Keep pending and disconnected supplier cards visible, but do not route them to storefront ordering. Pending keeps Cancel; disconnected/rejected keeps request status actions.
- Leave the External Suppliers tab as a management table.
- Remove the dashboard "Order" button from warehouse supplier rows/cards.
- Remove or hide the sidebar item for `/warehouse/dashboard/order-from-supplier`.
- Keep the old `/warehouse/dashboard/order-from-supplier` route as a compatibility redirect or simple handoff screen pointing users back to `/warehouse/dashboard/suppliers`.

## Storefront Cart Flow

- On `/w/[slug]`, detect warehouse buyer mode using `authClient.useSession()`. Enable W2W cart only when the logged-in user has role `warehouse`.
- Confirm active supplier access by querying `warehouse.getMyWarehouseSuppliers({ status: "active", search: slug, page: 1, limit: 10 })` and exact-matching `warehouseSlug === slug || warehouseId === slug`.
- If the visitor is not a connected warehouse buyer, keep the existing public storefront browsing behavior.
- If the visitor is a warehouse user without active access, disable ordering and show a compact "Request supplier access from dashboard" state.
- Refactor `WarehouseProductGrid` and `WarehouseProductCard` to support a mode prop. Default mode keeps current behavior; W2W mode turns product actions into Add to Cart / quantity controls and does not open `WarehouseOrderDialog`.
- Add a W2W cart UI on the storefront: desktop sticky cart/checkout panel, mobile bottom cart button plus sheet, item quantity controls, remove, clear cart, subtotal, and place order button.
- Add a client cart hook keyed by `warehouse-supplier-cart:{buyerWarehouseId}:{slug}` in localStorage. Cart items store `variantId`, `inventoryId`, `productName`, `image`, `sku`, `unitLabel`, `price`, `availableQty`, and `quantity`.
- Clamp quantities between `1` and current `availableQty`. Merge duplicate variants. Clear cart when the supplier slug changes or after a successful order.
- The checkout section collects receiving warehouse/contact name, phone, address, city, optional area, payment method, and optional note. Prefill from the session user where fields exist.
- Place order with `orpc.warehouse.placeWarehouseSupplierOrder.call({ warehouseKey: slug, items: [{ variantId, quantity }], shippingName, shippingPhone, shippingAddress, shippingCity, shippingArea, customerNote, paymentMethod })`.
- On success, toast the order result, clear the W2W cart, invalidate `warehouse.getMyWarehouseSuppliers` and `warehouse.getMyOrders`, then navigate to `${NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL || "http://warehouse.bikalpo.localhost:3001"}/warehouse/dashboard/orders`.

## Interfaces And Data

- Add client-only types such as `WarehouseSupplierCartItem` and `WarehouseStorefrontOrderMode`; no public database schema change is required.
- Keep `warehouse.placeWarehouseSupplierOrder` as the final source of truth for active connection, stock validation, pricing snapshot, and `W2W-*` order creation.
- Continue using `warehouse.getStorefrontBySlug`, `warehouse.getStorefrontCategories`, and `warehouse.getStorefrontProducts` for storefront display.
- Do not reuse the customer `useCart` or checkout cart for W2W orders, because that cart is consumer/shop storefront oriented and routes to `/checkout`.

## Test Plan

- Run `pnpm -F web lint` and `pnpm -F web build`.
- Manually verify from `http://warehouse.bikalpo.localhost:3001/warehouse/dashboard/suppliers`: active cards render, clicking a card opens `http://bikalpo.localhost:3001/w/{slug}`, pending/disconnected cards do not open ordering.
- On `/w/{slug}` as a connected warehouse user: add multiple variants, update quantities, remove items, clear cart, refresh page and confirm cart persistence, then place an order.
- Confirm the created order appears in `http://warehouse.bikalpo.localhost:3001/warehouse/dashboard/orders`.
- Verify unconnected warehouse users cannot place W2W orders from `/w/{slug}`.
- Verify non-warehouse visitors still see the storefront without the W2W cart UI.
- Check desktop and mobile layouts so product cards, sticky cart, mobile cart sheet, and checkout form do not overlap or resize awkwardly.

## Assumptions

- Only the Warehouse Suppliers tab changes to the new card-to-storefront flow; External Suppliers remain dashboard-managed records.
- The storefront URL must use the main app domain from `NEXT_PUBLIC_APP_SUBDOMAIN_URL`, not the warehouse subdomain.
- The old dashboard ordering UI is deprecated, but its route should not hard-break existing bookmarks.
