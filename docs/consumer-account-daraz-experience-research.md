# Consumer Account Panel: Daraz-Informed Experience Research

**Scope.** Repository source, the Daraz account screenshot supplied by the client, and first-party Daraz Bangladesh pages only. Sources were checked on 2026-08-27. This is an information-architecture and UI recommendation; no implementation code was changed.

## Conclusion

Bikalpo should borrow Daraz's **account overview first, grouped navigation second, contextual actions third** model without copying Daraz's branding or reducing Bikalpo to Daraz's feature set. The correct first release is a route and navigation consolidation around canonical user-facing `/account/*` URLs, followed by a compact overview containing Personal Profile and Address Book summaries. Existing Bikalpo-specific workflows—Open Orders, Estimates, Requested Items, complaints/support, and To-Let—should remain, but under clear groups rather than one undifferentiated list.

The present panel is functionally broad but structurally inconsistent:

- one flat sidebar mixes account settings, order history, cart, marketplace requests, rentals, complaints, and support (`apps/web/components/account/account-sidebar.tsx:33-105`);
- the same sidebar uses hard-coded emerald active styles even though the project's defined primary is Registry Blue (`apps/web/components/account/account-sidebar.tsx:178-227`; `DESIGN.md:55-71`; `apps/web/app/globals.css:92-122`);
- public `/account/*` and `/shop/account/*` duplicate or near-duplicate account pages and layouts (`apps/web/app/(public)/account/page.tsx:1-5`; `apps/web/app/shop/(storefront)/account/page.tsx:1-5`; `apps/web/app/(public)/account/layout.tsx:7-38`; `apps/web/app/shop/(storefront)/account/layout.tsx:7-38`);
- the shared overview sends users to `/shop/account/orders`, while the shared sidebar sends them to `/account/orders` (`apps/web/components/shop/account-overview-client.tsx:148-172`; `apps/web/components/account/account-sidebar.tsx:33-97`);
- the global account dropdown independently defines another navigation list, using `/account/*` for consumers and `/shop/account/*` for seller accounts (`apps/web/components/layout/user-dropdown.tsx:137-213`); and
- the shop account tree reuses links for My Bookings and My Complaints even though it has neither corresponding page, whereas the public account tree does. On the shop subdomain, `/account/...` is internally rewritten below `/shop`, so these shared links resolve to missing `/shop/account/...` pages. A single flat list therefore advertises destinations that are not available in every surface (`apps/web/components/account/account-sidebar.tsx:77-95`; `apps/web/app/(public)/account/to-let/page.tsx:1-11`; `apps/web/app/(public)/account/complaints/page.tsx:114-390`; `apps/web/proxy.ts:178-223`).

This route drift should be corrected before a visual redesign; otherwise a Daraz-like sidebar would only make inconsistent destinations easier to discover.

## What the Daraz reference actually contributes

The supplied desktop screenshot shows this hierarchy:

```text
Hello, [customer]

Manage My Account
  My Profile
  Address Book
  My Payment Options
  Daraz Wallet

My Orders
  My Returns
  My Cancellations

My Reviews
My Wishlist & Followed Stores
Sell On Daraz
```

The account landing view is not an analytics dashboard or an edit form. It is a summary titled **Manage My Account**, with a Personal Profile card and inline Edit action beside an Address Book card with inline Add and separate shipping/billing summaries. The persistent desktop navigation is narrow and text-led, with bold group labels, indented children, and one brand-colored active state. The visual canvas is pale gray with flat white content panels and abundant surrounding space (client-supplied screenshot, `codex-clipboard-a1ad4035-2dd8-442a-a80f-3e546c196bda.png`).

First-party Daraz routes confirm the primary destinations: [Manage My Account](https://member.daraz.com.bd/user/profile), [My Orders](https://my.daraz.com.bd/customer/order/index/), [My Wishlist & Followed Stores](https://my.daraz.com.bd/wishlist/index), [My Reviews](https://my.daraz.com.bd/customer/myReview/my-reviews), and [Returns](https://my.daraz.com.bd/customer/returns/index?requestType=return). Protected destinations preserve the requested account destination through login, so these are account-level workflows rather than unrelated marketing links.

Daraz's first-party address instructions explicitly use **Manage My Account → Address Book → Add a New Address → Save This Address**, validating the screenshot's overview-to-detail pattern ([Daraz address-management instructions](https://blog.daraz.com.bd/2021/09/18/daraz-pickup-point-list/)). Its return instructions start from a specific order/item, then ask for a return reason, refund method, and pickup or drop-off choice. That supports contextual Returns and Cancellations views under My Orders rather than unrelated generic forms ([Daraz return workflow](https://www.daraz.com.bd/wow/i/bd/help-pages/how-to-return/)). Daraz's official help page similarly foregrounds tracking, returns, cancellation, and order questions as actions ([Daraz Help](https://pages.daraz.com.bd/wow/i/bd/help-pages/contact?hybrid=1)).

The useful pattern is therefore:

1. a stable account shell;
2. a compact identity-and-address overview;
3. grouped destinations with order outcomes nested under orders; and
4. actions initiated from the relevant order or summary card.

It is **not** a mandate to copy Daraz's orange/cyan palette, exact spacing, Wallet feature, or every label.

## Current Bikalpo account surface

### Canonical public route inventory

| Current route | Current purpose | Audit note |
|---|---|---|
| `/account` | Stats-first overview plus recent orders and To-Let shortcut | Uses profile and order data, but gives four KPI cards priority over profile/address management (`apps/web/components/shop/account-overview-client.tsx:41-203`). |
| `/account/profile` | Consumer personal information | Real form for email, name, phone, and WhatsApp (`apps/web/components/account/consumer-profile-client.tsx:12-207`). |
| `/account/addresses` | Address list, add, edit, delete, and default selection | Real workflow; already a strong match for Daraz's Address Book concept (`apps/web/components/account/address-list.tsx:14-74`; `apps/web/components/account/address-card.tsx:17-91`). |
| `/account/orders` and `/account/orders/[id]` | All consumer orders, status tabs, detail/tracking | Real workflow. Tabs expose All, Pending, Active, Delivered, and Closed, but state is not URL-addressable (`apps/web/components/account/order-tabs.tsx:24-150`). |
| `/account/open-orders` | Bikalpo Open Order history | Real, Bikalpo-specific capability (`apps/web/app/(public)/account/open-orders/page.tsx:1-5`). |
| `/account/track` | Redirect to active order or orders list | Not an independent page; it should be an order action, not a permanent sibling destination (`apps/web/components/shop/active-order-redirect.tsx:8-27`). |
| `/account/estimates` and `/account/estimates/[id]` | Customer estimates and conversion | Real, Bikalpo-specific buying workflow (`apps/web/app/(public)/account/estimates/page.tsx:162-169`; `apps/web/app/(public)/account/estimates/[id]/page.tsx:58-86`). |
| `/account/requests` | Requested-item history | Real workflow, though the sidebar copy “My Request Item” is awkward (`apps/web/app/(public)/account/requests/page.tsx:7-24`). |
| `/account/to-let/*` | Bookings, properties, posts, units, and listings | Real, capability-dependent rental workflow; it warrants its own group (`apps/web/app/(public)/account/to-let/page.tsx:1-11`; `apps/web/components/account/account-sidebar.tsx:112-137`). |
| `/account/security` | Password change and tips | Real workflow (`apps/web/app/(public)/account/security/page.tsx:4-60`). |
| `/account/complaints/*` | Complaint list and details | Real workflow (`apps/web/app/(public)/account/complaints/page.tsx:114-390`). |
| `/account/support/*` | Help, tickets, and ticket detail | Real workflow (`apps/web/app/(public)/account/support/page.tsx:3-8`; `apps/web/app/(public)/account/support/[ticketId]/page.tsx:9-30`). |
| `/account/payments` | Payment methods | Coming-soon stub, despite being exposed in the user dropdown (`apps/web/app/(public)/account/payments/page.tsx:3-15`; `apps/web/components/layout/user-dropdown.tsx:194-199`). |
| `/checkout` | Cart and checkout | The sidebar calls this “My Cart,” but cart is already a global navbar action and does not belong in account management (`apps/web/components/account/account-sidebar.tsx:82-87`; `apps/web/components/layout/navbar.tsx:240-253`). |

### Duplicate `/shop/account` surface

The shop storefront tree contains duplicate pages for overview, orders, addresses, Open Orders, payments, requests, security, and tracking, plus near-duplicates for layouts, estimates, profile, and support. The two profile pages even diverge semantically: public `/account/profile` uses the consumer personal form, while `/shop/account/profile` uses a business-profile form (`apps/web/app/(public)/account/profile/page.tsx:1-8`; `apps/web/app/shop/(storefront)/account/profile/page.tsx:1-8`; `apps/web/components/shop/profile-client.tsx:46-68`).

This is not useful Daraz-like separation. It is route ownership ambiguity. Consumers enter `/account`, sellers enter `/shop/account` from the dropdown, shared overview links force `/shop/account`, and shared order/detail components force `/account` (`apps/web/components/layout/user-dropdown.tsx:137-213`; `apps/web/components/shop/account-overview-client.tsx:148-172`; `apps/web/components/account/order-card.tsx:56-73`; `apps/web/components/shop/active-order-redirect.tsx:8-19`). The proxy adds an important distinction: on the shop subdomain, a user-facing `/account/...` request is internally rewritten to the `apps/web/app/shop/(storefront)/account` tree (`apps/web/proxy.ts:178-223`). Recommended ownership:

- `/account/*` is the canonical user-facing buyer-account URL family on both the public and shop origins;
- seller business settings belong in the seller dashboard/settings surface, not a second consumer profile route; and
- the `shop/(storefront)/account` tree remains an internal subdomain adapter until the proxy is deliberately migrated, but it should render shared buyer-account components rather than maintain divergent copies. Direct `/shop/account/*` callers should migrate to user-facing `/account/*` URLs; any compatibility redirect must be host-aware to avoid a rewrite loop.

### Capability gaps versus the reference

| Daraz concept | Repository reality | Recommendation |
|---|---|---|
| Payment options | The route is a coming-soon card only (`apps/web/app/(public)/account/payments/page.tsx:3-15`). | Do not promote it in the sidebar until users can view or manage something real. |
| Wallet | No equivalent consumer wallet capability was found. | Omit it; do not invent parity. |
| My Reviews | Product review read/create/update primitives exist, but there is no current-user review list query or `/account/reviews` page (`packages/api/src/routers/customer.ts:2238-2270`; `packages/api/src/routers/customer.ts:5965-6065`; `apps/web/hooks/use-customer-api.ts:264-293`). | Add a current-user list endpoint and management page before adding the nav item. |
| Followed Stores | A consumer can follow/unfollow a shop and the follower relation is persisted, but there is no followed-stores list query/page (`packages/api/src/routers/customer.ts:4023-4030`; `packages/api/src/routers/customer.ts:4630-4683`; `packages/db/src/schema/shop-follower.ts:11-47`). | Ship “Followed Stores” once a consumer-scoped list endpoint exists. |
| Wishlist | No wishlist model, API, or consumer page was found. | Treat as a new product feature, not UI scope. It can later share a Saved & Followed page with tabs. |
| Cancellations | The customer API can cancel an order before invoicing, and the routed order list can display cancelled/returned history in Closed; the routed `OrdersClient`/`OrderTabs` flow does not surface a cancellation action or URL-addressable cancellations view. A separate, currently unused `OrpcMyOrders` component already contains cancellation UI and can inform the implementation (`packages/api/src/routers/customer.ts:5885-5963`; `apps/web/hooks/use-customer-api.ts:250-261`; `apps/web/components/shop/orders-client.tsx:1-47`; `apps/web/components/account/order-tabs.tsx:24-46`; `apps/web/components/features/orders/orpc-my-orders.tsx:67-208`). | Expose cancellation contextually on eligible order detail and link the sidebar to a URL-backed order filter. |
| Returns | Return records and consumer-scoped list/get behavior exist, but the processing lookup explicitly permits staff only; submit loads an arbitrary order without a consumer ownership predicate before using that order's user ID (`packages/api/src/routers/returns.ts:83-128`; `packages/api/src/routers/returns.ts:208-256`; `packages/api/src/routers/returns.ts:297-374`). | Do not expose consumer return submission yet. First define eligibility, ownership, item/quantity validation, refund policy, and consumer-safe endpoints; then initiate return from order detail and list it under My Orders. |

## Recommended information architecture

Use one typed, capability-aware navigation model to render the desktop sidebar, mobile account menu, and compact user dropdown. Do not maintain three arrays of hard-coded hrefs.

```text
Hello, [customer]

Manage My Account
  Overview                 /account
  Personal Profile         /account/profile
  Address Book             /account/addresses
  Security                 /account/security
  Payment Options          /account/payments       [only when functional]

My Orders
  All Orders               /account/orders
  Open Orders              /account/open-orders
  Cancellations            /account/orders?view=cancelled
  Returns                  /account/returns         [after backend hardening]

My Activity
  My Reviews               /account/reviews         [new]
  Saved & Followed         /account/saved           [new; phase by capability]
  Estimates                /account/estimates
  Requested Items          /account/requests

Rentals                    [only when applicable]
  My Bookings              /account/to-let
  My Properties            dynamic existing route
  My Posts                 /account/to-let/posts

Help
  Complaints               /account/complaints
  Customer Support         /account/support

Sell on Bikalpo            /b2b/register
```

Important scoping decisions:

- Remove **Track Order** from the permanent sidebar; retain it as an active-order navbar indicator and order action. The existing navbar/status components already link directly to the active order (`apps/web/components/shop/layout/order-status-badge.tsx:10-68`).
- Remove **My Cart** from account navigation; keep the persistent global cart action.
- Keep **Open Orders**, **Estimates**, **Requested Items**, and **Rentals** because they express Bikalpo's domain. Daraz is a navigation reference, not Bikalpo's product specification.
- Show only destinations supported for the current role/capabilities. In particular, To-Let owner links are already dynamic and should remain so (`apps/web/components/account/account-sidebar.tsx:112-137`).
- Keep Logout as a destructive utility at the bottom, visually separated from navigation.

## Recommended account overview

Replace the current stats-first hierarchy with an overview-first composition:

1. **Page title:** “Manage My Account,” followed by one short sentence. Move “Hello, [name]” into the sidebar header on desktop. Avoid repeating a large “Your Account” header plus “Welcome back” inside the content (`apps/web/app/(public)/account/layout.tsx:18-38`; `apps/web/components/shop/account-overview-client.tsx:80-90`).
2. **Primary summary row:**
   - Personal Profile: name, masked or omitted email, phone/WhatsApp completeness, inline **Edit**.
   - Address Book: default delivery address, another address count or billing/delivery distinction only if Bikalpo actually models it, inline **Add** or **Manage**.
3. **Order activity row:** active order first, then compact recent orders with **View all**. Retain useful order counts as small metadata rather than four dominant KPI cards.
4. **Capability shortcuts:** Open Orders, Estimates, Requested Items, and To-Let only when useful to that account.

This reuses existing profile, address, active-order, and recent-order data rather than creating a parallel account API (`apps/web/components/shop/account-overview-client.tsx:41-78`; `apps/web/hooks/use-customer-api.ts:127-171`).

## Visual translation into Bikalpo's design system

Borrow Daraz's density and hierarchy, not its visual identity:

- retain the existing approximately 256 px desktop sidebar (`apps/web/components/account/account-sidebar.tsx:153-180`);
- use the existing neutral page canvas, white panels, 1 px structural borders, 8 px radius, and no decorative shadow (`DESIGN.md:94-111`);
- replace hard-coded emerald account accents with semantic `primary`/Registry Blue and keep the accent below the system's restrained-use threshold (`DESIGN.md:62-71`; `apps/web/app/globals.css:104-122`);
- use text weight, indentation, and spacing for group hierarchy; icons may remain small supporting cues, but must not flatten parent and child items into identical rows;
- do not introduce Daraz orange, cyan, exact typography, or a colored side stripe—the product explicitly rejects generic consumer templates, heavy shadows, and side-stripe cards (`PRODUCT.md:16-28`);
- use `font-mono tabular-nums` for order numbers, amounts, and counts in line with the data metric rule (`DESIGN.md:73-91`); and
- render the same grouped model as an accessible disclosure/sheet on small screens. Current mobile menu disclosure behavior is a viable base, but it should not use a separately maintained destination list (`apps/web/components/account/account-sidebar.tsx:153-183`).

The active state should be a restrained blue-tinted background plus stronger text, with `aria-current="page"`; avoid both Daraz cyan and the current emerald hard-coding. Focus visibility, 44 px minimum touch targets, and semantic headings must remain intact.

## Phased scope

### Phase 0 — route and navigation integrity

- Declare user-facing `/account/*` canonical on both public and shop origins; document the shop tree as an internal rewrite target.
- Replace hard-coded links with route helpers and a typed, grouped, capability-aware navigation model.
- Migrate direct `/shop/account/*` callers; retain the internal shop route adapter until the subdomain proxy is migrated, and make any compatibility redirects host-aware.
- Fix active state resolution for URL-backed order filters.
- Remove sidebar destinations that are redirects, global actions, stubs, or unavailable for the current surface.

### Phase 1 — Daraz-informed shell and overview

- Rebuild the shell with greeting, grouped sidebar, consistent mobile disclosure, and one content title.
- Replace KPI-first account landing with Personal Profile, Address Book, active/recent orders, and Bikalpo capability shortcuts.
- Restyle existing account pages using semantic design tokens rather than gray/emerald literals.

### Phase 2 — expose existing near-capabilities

- Add URL-backed Cancellations/Closed order views and contextual cancellation where eligible.
- Add current-user review list/edit management.
- Add followed-stores listing.
- Preserve Open Orders, Estimates, Requested Items, complaints/support, and To-Let in their new groups.

### Phase 3 — new or unsafe-to-expose capabilities

- Harden consumer return eligibility and ownership, then add initiation from order detail plus return history.
- Implement payment-method management before showing Payment Options.
- Treat Wishlist as a separate product/data feature; combine with followed stores only after both are real.

## Acceptance criteria for the redesign

- `/account/*` is the single user-facing buyer account URL family; internal shop-subdomain rewrites are not exposed as competing navigation URLs.
- Desktop sidebar, mobile account menu, and user dropdown derive from one grouped, capability-aware source.
- No visible destination is a coming-soon stub, missing route, redirect-only page, or unauthorized workflow.
- Account landing shows profile and address summaries with inline Edit/Add/Manage actions before analytics.
- Order cancellation and returns begin from an eligible order; Cancellations and Returns are also discoverable under My Orders.
- Bikalpo-specific Open Orders, Estimates, Requested Items, support/complaints, and rental flows remain discoverable.
- Registry Blue semantic tokens replace emerald account-navigation state; cards are flat, bordered, and shadow-free.
- Mobile preserves the same labels, grouping, active state, and route ownership as desktop.
- Keyboard focus, current-page semantics, high contrast, touch target sizing, and loading/empty/error states are verified.

## Sources

### Repository primary sources

- `DESIGN.md`
- `PRODUCT.md`
- `apps/web/app/globals.css`
- `apps/web/app/(public)/account/**`
- `apps/web/app/shop/(storefront)/account/**`
- `apps/web/components/account/**`
- `apps/web/components/shop/account-overview-client.tsx`
- `apps/web/components/layout/navbar.tsx`
- `apps/web/components/layout/user-dropdown.tsx`
- `apps/web/components/shop/layout/order-status-badge.tsx`
- `apps/web/hooks/use-customer-api.ts`
- `packages/api/src/routers/customer.ts`
- `packages/api/src/routers/returns.ts`
- `packages/db/src/schema/shop-follower.ts`

### Daraz first-party sources

- Client-supplied Daraz Manage My Account screenshot.
- [Manage My Account](https://member.daraz.com.bd/user/profile)
- [My Orders](https://my.daraz.com.bd/customer/order/index/)
- [My Wishlist & Followed Stores](https://my.daraz.com.bd/wishlist/index)
- [My Reviews](https://my.daraz.com.bd/customer/myReview/my-reviews)
- [Returns](https://my.daraz.com.bd/customer/returns/index?requestType=return)
- [Address-management instructions](https://blog.daraz.com.bd/2021/09/18/daraz-pickup-point-list/)
- [Return workflow](https://www.daraz.com.bd/wow/i/bd/help-pages/how-to-return/)
- [Help and contact](https://pages.daraz.com.bd/wow/i/bd/help-pages/contact?hybrid=1)

**Source limitation.** Logged-in Daraz interiors are protected. The client-supplied screenshot is therefore the strongest primary source for the detailed desktop layout; first-party public Daraz pages validate the destination names and workflows.
