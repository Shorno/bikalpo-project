# ORPC Public API — Integration Guide

This document explains how the ORPC public API layer works and how to integrate
it into your Next.js pages. All server actions for the **customer-facing** views
have been converted to type-safe ORPC procedures.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ packages/api/src/routers/public.ts   ← ORPC Router (queries + mutations)
│                                                                 │
│ packages/api/src/routers/index.ts    ← Registered as appRouter.public
│                                                                 │
│ apps/server/src/index.ts             ← Hono serves at /rpc      │
└────────────────────────┬────────────────────────────────────────┘
                         │  RPCLink (credentials: "include")
┌────────────────────────▼────────────────────────────────────────┐
│ apps/web/utils/orpc.ts               ← ORPC client (already existed)
│                                                                 │
│ apps/web/hooks/use-public-api.ts     ← 30+ React hooks          │
│                                                                 │
│ apps/web/components/...              ← ORPC-powered components   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Created / Modified

### Backend

| File                                 | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `packages/api/src/routers/public.ts` | All public ORPC procedures (18 queries + 14 mutations) |
| `packages/api/src/routers/index.ts`  | **Modified** — added `public: publicRouter`            |

### Client Hooks

| File                               | Description                                                       |
| ---------------------------------- | ----------------------------------------------------------------- |
| `apps/web/hooks/use-public-api.ts` | All ORPC React hooks (TanStack Query)                             |
| `apps/web/hooks/use-orpc-cart.tsx` | ORPC-backed CartProvider (drop-in replacement for `use-cart.tsx`) |

### Components

| File                                                     | Replaces                               |
| -------------------------------------------------------- | -------------------------------------- |
| `components/features/products/orpc-products-grid.tsx`    | Products grid (paginated, filterable)  |
| `components/features/products/orpc-product-detail.tsx`   | Product detail page with reviews       |
| `components/features/products/orpc-category-listing.tsx` | Home page categories with products     |
| `components/features/orders/orpc-my-orders.tsx`          | Orders list with tabs & cancel         |
| `components/features/orders/orpc-order-detail.tsx`       | Order detail with progress tracker     |
| `components/features/account/orpc-profile-page.tsx`      | Profile view & edit                    |
| `components/features/account/orpc-address-manager.tsx`   | Address CRUD (add/edit/delete/default) |
| `components/features/account/orpc-account-overview.tsx`  | Account dashboard with stats           |
| `components/checkout/orpc-checkout.tsx`                  | Full checkout flow                     |
| `components/checkout/orpc-address-selector.tsx`          | Address picker for checkout            |
| `components/features/home/search/orpc-search-modal.tsx`  | Product search with debounce           |
| `components/features/home/orpc-announcement-banner.tsx`  | Active announcements                   |
| `components/features/home/orpc-brands-grid.tsx`          | Brands grid for home page              |
| `components/features/home/orpc-categories-grid.tsx`      | Category circles for home page         |

---

## How to Integrate

### 1. Switch Cart Provider

In your layout or providers file, replace `CartProvider` with `OrpcCartProvider`:

```tsx
// apps/web/app/providers.tsx (or wherever CartProvider is mounted)
import { OrpcCartProvider } from "@/hooks/use-orpc-cart";

// Replace:
// import { CartProvider } from "@/hooks/use-cart";
// <CartProvider>{children}</CartProvider>

// With:
<OrpcCartProvider>{children}</OrpcCartProvider>;
```

The `useCart()` hook interface is identical, so all existing cart consumers work.

### 2. Swap Page Components

#### Product Listing Page

```tsx
// app/customer/products/page.tsx
import { OrpcProductsGrid } from "@/components/features/products/orpc-products-grid";

export default function ProductsPage() {
  return <OrpcProductsGrid />;
}
```

#### Product Detail Page

```tsx
// app/customer/products/[category]/[slug]/page.tsx
import { OrpcProductDetail } from "@/components/features/products/orpc-product-detail";

export default function ProductDetailPage({
  params,
}: {
  params: { slug: string; category: string };
}) {
  return (
    <OrpcProductDetail slug={params.slug} categorySlug={params.category} />
  );
}
```

#### Checkout Page

```tsx
// app/customer/checkout/page.tsx
import { OrpcCheckout } from "@/components/checkout/orpc-checkout";

export default function CheckoutPage() {
  return <OrpcCheckout />;
}
```

#### My Orders Page

```tsx
// app/customer/account/orders/page.tsx
import { OrpcMyOrders } from "@/components/features/orders/orpc-my-orders";

export default function OrdersPage() {
  return <OrpcMyOrders />;
}
```

#### Order Detail Page

```tsx
// app/customer/account/orders/[id]/page.tsx  OR  /order-confirmation/[orderNumber]/page.tsx
import { OrpcOrderDetail } from "@/components/features/orders/orpc-order-detail";

export default function OrderPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  return <OrpcOrderDetail orderNumber={params.orderNumber} />;
}
```

#### Account Overview

```tsx
// app/customer/account/page.tsx
import { OrpcAccountOverview } from "@/components/features/account/orpc-account-overview";

export default function AccountPage() {
  return <OrpcAccountOverview />;
}
```

#### Profile Page

```tsx
import { OrpcProfilePage } from "@/components/features/account/orpc-profile-page";

export default function ProfilePage() {
  return <OrpcProfilePage />;
}
```

#### Address Management

```tsx
// app/customer/account/addresses/page.tsx
import { OrpcAddressManager } from "@/components/features/account/orpc-address-manager";

export default function AddressesPage() {
  return <OrpcAddressManager />;
}
```

#### Home Page

```tsx
import { OrpcCategoryListing } from "@/components/features/products/orpc-category-listing";
import { OrpcBrandsGrid } from "@/components/features/home/orpc-brands-grid";
import { OrpcCategoriesGrid } from "@/components/features/home/orpc-categories-grid";
import { OrpcAnnouncementBanner } from "@/components/features/home/orpc-announcement-banner";
import { OrpcSearchTrigger } from "@/components/features/home/search/orpc-search-modal";

// Use in your home page:
<OrpcAnnouncementBanner />
<OrpcSearchTrigger variant="customer" />
<OrpcCategoriesGrid />
<OrpcBrandsGrid />
<OrpcCategoryListing limit={6} />
```

---

## ORPC Procedures Reference

### Queries (publicProcedure — no auth required)

| Procedure                    | Input                                                                                                | Returns                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `getPublicProducts`          | `{ category?, subcategory?, brand?, minPrice?, maxPrice?, inStock?, search?, sort?, page?, limit? }` | `{ products, totalProducts, page, totalPages }` |
| `searchProducts`             | `{ query }`                                                                                          | `{ products }` (max 10)                         |
| `getProductDetails`          | `{ slug }`                                                                                           | `{ product, variants, reviewStats }`            |
| `getProductReviews`          | `{ productId }`                                                                                      | `{ reviews, stats }`                            |
| `getActiveCategories`        | —                                                                                                    | `{ categories }`                                |
| `getCategoryBySlug`          | `{ slug }`                                                                                           | `{ category }`                                  |
| `getCategoriesWithProducts`  | `{ limit? }`                                                                                         | `{ categories }` (with nested products)         |
| `getSubcategoriesByCategory` | `{ slug }`                                                                                           | `{ subcategories }`                             |
| `getActiveBrands`            | —                                                                                                    | `{ brands }`                                    |
| `getAnnouncements`           | —                                                                                                    | `{ announcements }`                             |

### Queries (protectedProcedure — requires auth)

| Procedure          | Input             | Returns                  |
| ------------------ | ----------------- | ------------------------ |
| `getCart`          | —                 | `{ cart, items }`        |
| `getMyOrders`      | —                 | `{ orders }`             |
| `getOrderByNumber` | `{ orderNumber }` | `{ order }` (with items) |
| `getOrderStatus`   | `{ orderId }`     | `{ status, payment }`    |
| `getActiveOrder`   | —                 | `{ order }` or `null`    |
| `getProfile`       | —                 | `{ profile }`            |
| `getMyAddresses`   | —                 | `{ addresses }`          |

### Mutations (protectedProcedure)

| Procedure           | Input                                                                            | Returns                    |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------- |
| `addToCart`         | `{ productId, quantity?, variantId? }`                                           | `{ success, message }`     |
| `updateCartItem`    | `{ cartItemId, quantity }`                                                       | `{ success }`              |
| `removeFromCart`    | `{ cartItemId }`                                                                 | `{ success }`              |
| `clearCart`         | —                                                                                | `{ success }`              |
| `placeOrder`        | `{ shippingInfo, paymentMethod? }`                                               | `{ orderNumber, orderId }` |
| `cancelOrder`       | `{ orderId }`                                                                    | `{ success }`              |
| `createReview`      | `{ productId, rating, title?, comment }`                                         | `{ review }`               |
| `addAddress`        | `{ label, recipientName, phone, address, city, area?, postalCode?, isDefault? }` | `{ address }`              |
| `updateAddress`     | `{ id, ... }`                                                                    | `{ address }`              |
| `deleteAddress`     | `{ id }`                                                                         | `{ success }`              |
| `setDefaultAddress` | `{ id }`                                                                         | `{ success }`              |
| `updateProfile`     | `{ businessName, ownerName, phoneNumber?, ... }`                                 | `{ profile }`              |

---

## UI States

All ORPC components handle these states:

- **Loading** — Skeleton placeholders matching the component layout
- **Empty** — Friendly empty state with CTA to browse products
- **Error** — Error message with retry suggestion
- **No seller / out of stock** — Shown as overlay badges on product cards

---

## Environment

The ORPC client reads `NEXT_PUBLIC_SERVER_URL` from `packages/env/src/web.ts`.
The backend Hono server runs on **port 3001** and serves ORPC at `/rpc`.
