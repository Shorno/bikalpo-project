/**
 * ORPC-powered React hooks for the Shop Owner API.
 *
 * B2B queries: product browsing with TRADE variant filtering.
 * Management queries: retail product catalog and inventory.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    status?: "pending" | "confirmed" | "processing" | "delivered" | "cancelled";
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

