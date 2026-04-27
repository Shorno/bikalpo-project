"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// CATALOG QUERY HOOKS (Public)
// ────────────────────────────────────────────────────────────────

/** Browse the full catalog hierarchy with cascading filters */
export function useCatalogHierarchy(filters: {
  typeId?: number;
  categoryId?: number;
  subCategoryId?: number;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getPublicCatalogHierarchy.queryOptions({
      input: {
        typeId: filters.typeId,
        categoryId: filters.categoryId,
        subCategoryId: filters.subCategoryId,
        search: filters.search || undefined,
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
      },
      staleTime: 1000 * 60 * 5,
    }),
  );
}

/** Get detailed view of a core product (variants, brands, sellers) */
export function useCoreProductDetail(coreProductId: number | null) {
  return useQuery(
    orpc.shopOwner.getCoreProductDetail.queryOptions({
      input: { coreProductId: coreProductId! },
      enabled: !!coreProductId,
      staleTime: 1000 * 60 * 5,
    }),
  );
}

/** Get filter dropdown options (types, categories, subcategories) */
export function useFilterOptions() {
  return useQuery(
    orpc.shopOwner.getPublicFilterOptions.queryOptions({
      staleTime: 1000 * 60 * 10,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// PRODUCT REQUEST HOOKS (Shop Owner Only)
// ────────────────────────────────────────────────────────────────

/** Submit a product identity request */
export function useSubmitProductRequest() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.shopOwner.submitProductIdentityRequest.mutationOptions(),
    onSuccess: () => {
      toast.success("Product request submitted! Admin will review it.");
      qc.invalidateQueries({
        queryKey: orpc.shopOwner.getMyProductRequests.key(),
      });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Get my product identity requests */
export function useMyProductRequests(status?: "pending" | "approved" | "rejected") {
  return useQuery(
    orpc.shopOwner.getMyProductRequests.queryOptions({
      input: { status },
      staleTime: 1000 * 60 * 2,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// PRODUCT CREATION HOOKS (Retailer Wizard)
// ────────────────────────────────────────────────────────────────

/**
 * Cascading filter options for the 8-step retailer product creation wizard.
 * Returns types, categories, subcategories, core products, brands, variant options.
 */
export function useCreateProductOptions(params?: {
  typeId?: number;
  categoryId?: number;
  subCategoryId?: number;
}) {
  return useQuery(
    orpc.shopOwner.getCreateProductOptions.queryOptions({
      input: {
        typeId: params?.typeId,
        categoryId: params?.categoryId,
        subCategoryId: params?.subCategoryId,
      },
      staleTime: 1000 * 60 * 5,
    }),
  );
}

/** Create a new retailer shop product (full 8-step wizard submission) */
export function useCreateShopProduct() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.shopOwner.createShopProduct.mutationOptions(),
    onSuccess: () => {
      toast.success("Product created successfully!");
      qc.invalidateQueries({ queryKey: orpc.shopOwner.getShopProducts.key() });
      qc.invalidateQueries({ queryKey: orpc.shopOwner.getShopProductKPIs.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}
