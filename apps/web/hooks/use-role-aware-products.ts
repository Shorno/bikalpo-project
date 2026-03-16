/**
 * Role-aware product hooks that automatically switch between
 * customer API (RETAIL variants) and shop owner API (TRADE variants)
 * based on the current user's role.
 *
 * Usage: drop-in replacement for useCustomerProducts / useProductDetails
 * in components that should show role-appropriate variants.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

/**
 * Returns products filtered by user role:
 * - shop_owner → TRADE variants (wholesale catalog from shopOwner.getProducts)
 * - everyone else → all variants (from customer.getCustomerProducts)
 */
export function useRoleAwareProducts(filters: {
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  inStock?: string | null;
  search?: string | null;
  sort?: string | null;
  page?: string;
  limit?: string;
}) {
  const { data: session } = authClient.useSession();
  const isShopOwner = session?.user?.role === "shop_owner";

  // Shop owner → use shopOwner router (TRADE variants)
  const shopOwnerQuery = useQuery(
    orpc.shopOwner.getProducts.queryOptions({
      input: filters,
      staleTime: 1000 * 60 * 2,
      enabled: isShopOwner,
    }),
  );

  // Everyone else → use customer router (all variants)
  const customerQuery = useQuery(
    orpc.customer.getCustomerProducts.queryOptions({
      input: filters,
      staleTime: 1000 * 60 * 2,
      enabled: !isShopOwner,
    }),
  );

  return isShopOwner ? shopOwnerQuery : customerQuery;
}

/**
 * Returns product details with role-appropriate variants:
 * - shop_owner → TRADE variants only
 * - everyone else → all variants
 */
export function useRoleAwareProductDetails(slug: string) {
  const { data: session } = authClient.useSession();
  const isShopOwner = session?.user?.role === "shop_owner";

  // Shop owner → TRADE variants only
  const shopOwnerQuery = useQuery(
    orpc.shopOwner.getProductDetails.queryOptions({
      input: { slug },
      enabled: isShopOwner && !!slug,
    }),
  );

  // Everyone else → all variants
  const customerQuery = useQuery(
    orpc.customer.getProductDetails.queryOptions({
      input: { slug },
      enabled: !isShopOwner && !!slug,
    }),
  );

  return isShopOwner ? shopOwnerQuery : customerQuery;
}
