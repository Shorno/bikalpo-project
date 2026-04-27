/**
 * ORPC-powered React hooks for the Shop Owner API.
 *
 * B2B queries: product browsing with TRADE variant filtering.
 * Management queries: retail product catalog and inventory.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// B2B QUERY HOOKS (Shop Owner as Buyer)
// ────────────────────────────────────────────────────────────────

/** Paginated wholesale product listing (TRADE variants only) */
export function useShopOwnerProducts(filters: {
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
  return useQuery(
    orpc.shopOwner.getProducts.queryOptions({
      input: filters,
      staleTime: 1000 * 60 * 2,
    }),
  );
}

/** Product detail with TRADE variants only */
export function useShopOwnerProductDetails(slug: string) {
  return useQuery(
    orpc.shopOwner.getProductDetails.queryOptions({
      input: { slug },
      enabled: !!slug,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// MANAGEMENT QUERY HOOKS (Shop Owner as Seller)
// ────────────────────────────────────────────────────────────────

/** Shop owner's retail product catalog (RETAIL variants) */
export function useMyRetailProducts(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getMyRetailProducts.queryOptions({
      input: {
        search: params?.search,
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
      staleTime: 1000 * 60 * 2,
    }),
  );
}

/** Shop owner's inventory summary */
export function useMyInventory() {
  return useQuery(
    orpc.shopOwner.getMyInventory.queryOptions({
      input: undefined,
      staleTime: 1000 * 60 * 2,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// ORDER & DASHBOARD HOOKS
// ────────────────────────────────────────────────────────────────

/** Shop owner's B2B purchase orders */
export function useMyOrders(params?: {
  status?: "pending" | "confirmed" | "processing" | "delivered" | "returned" | "cancelled";
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getMyOrders.queryOptions({
      input: {
        status: params?.status,
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
      staleTime: 1000 * 60,
    }),
  );
}

/** Dashboard summary stats */
export function useDashboardStats() {
  return useQuery(
    orpc.shopOwner.getDashboardStats.queryOptions({
      input: undefined,
      staleTime: 1000 * 60,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// MUTATION HOOKS
// ────────────────────────────────────────────────────────────────

/** Update retail price for an inventory item */
export function useUpdateRetailPrice() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.shopOwner.updateRetailPrice.mutationOptions({
      onSuccess: () => {
        // Invalidate retail products and inventory caches
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyRetailProducts"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyInventory"]],
        });
      },
    }),
  );
}

/** Update shop location */
export function useUpdateShopLocation() {
  return useMutation({
    ...orpc.shopOwner.updateShopLocation.mutationOptions(),
    onSuccess: () => {
      toast.success("Shop location updated!");
    },
    onError: (err) => toast.error(err.message),
  });
}

// ────────────────────────────────────────────────────────────────
// INCOMING B2C ORDER HOOKS
// ────────────────────────────────────────────────────────────────

/** Incoming B2C consumer orders for this shop */
export function useIncomingOrders(params?: {
  status?:
    | "all"
    | "pending"
    | "confirmed"
    | "processing"
    | "delivered"
    | "cancelled";
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getIncomingOrders.queryOptions({
      input: {
        status: params?.status ?? "all",
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
      staleTime: 1000 * 30,
    }),
  );
}

/** Update status of an incoming B2C order */
export function useUpdateIncomingOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.shopOwner.updateIncomingOrderStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.shopOwner.getIncomingOrders.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.shopOwner.getDashboardStats.key(),
        });
      },
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// OPEN ORDER HOOKS
// ────────────────────────────────────────────────────────────────

/** Available open order broadcasts for this shop */
export function useOpenOrderPool() {
  return useQuery(
    orpc.shopOwner.getOpenOrderPool.queryOptions({
      staleTime: 1000 * 5,
      refetchInterval: 1000 * 10,
    }),
  );
}

/** Lock an open order bid */
export function useLockOpenOrder() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.shopOwner.lockOpenOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Order locked! You have 100 seconds to submit your offer.");
      qc.invalidateQueries({ queryKey: orpc.shopOwner.getOpenOrderPool.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Submit a bid offer */
export function useSubmitOffer() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.shopOwner.submitOffer.mutationOptions(),
    onSuccess: () => {
      toast.success("Offer submitted!");
      qc.invalidateQueries({ queryKey: orpc.shopOwner.getOpenOrderPool.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Release a locked order */
export function useReleaseOpenOrder() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.shopOwner.releaseOpenOrder.mutationOptions(),
    onSuccess: () => {
      toast.info("Order released back to pool.");
      qc.invalidateQueries({ queryKey: orpc.shopOwner.getOpenOrderPool.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

// ────────────────────────────────────────────────────────────────
// STOCK MANAGEMENT HOOKS
// ────────────────────────────────────────────────────────────────

/** Search shop products for stock entry (with current stock info) */
export function useShopProductsForStock(search?: string) {
  return useQuery(
    orpc.shopOwner.getShopProductsForStock.queryOptions({
      input: { search: search || undefined, limit: 30 },
      staleTime: 1000 * 60,
    }),
  );
}

/** Add stock to one or more inventory variants */
export function useAddShopStock() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.shopOwner.addShopStock.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyRetailProducts"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyInventory"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getShopProductsForStock"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyStorePreview"]],
        });
      },
    }),
  );
}
