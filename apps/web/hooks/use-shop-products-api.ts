"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// Shop Product Queries
// ────────────────────────────────────────────────────────────────

/** Get shop products (aggregated by product, with stock levels) */
export function useShopProducts(filters: {
  search?: string;
  categoryId?: number;
  stockStatus?: "all" | "in_stock" | "low" | "out_of_stock";
  brandId?: number;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getShopProducts.queryOptions({
      input: {
        search: filters.search || undefined,
        categoryId: filters.categoryId,
        stockStatus: filters.stockStatus ?? "all",
        brandId: filters.brandId,
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
      },
    }),
  );
}

/** KPI summary: total products, in-stock, low, out-of-stock */
export function useShopProductKPIs() {
  return useQuery(
    orpc.shopOwner.getShopProductKPIs.queryOptions({
      staleTime: 1000 * 60 * 2,
    }),
  );
}

/** Get detailed product view with per-variant stock */
export function useShopProductDetail(productId: number | null) {
  return useQuery(
    orpc.shopOwner.getShopProductDetail.queryOptions({
      input: { productId: productId! },
      enabled: !!productId,
    }),
  );
}

/** Get cascading options for the Create Product form */
export function useCreateProductOptions(filters: {
  typeId?: number;
  categoryId?: number;
  subCategoryId?: number;
}) {
  return useQuery(
    orpc.shopOwner.getCreateProductOptions.queryOptions({
      input: {
        typeId: filters.typeId,
        categoryId: filters.categoryId,
        subCategoryId: filters.subCategoryId,
      },
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// Shop Product Mutations
// ────────────────────────────────────────────────────────────────

/** Create a new shop product */
export function useCreateShopProduct() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.shopOwner.createShopProduct.mutationOptions(),
    onSuccess: (data) => {
      toast.success(`Product created with ${data.variantsCreated} variant(s)!`);
      qc.invalidateQueries({ queryKey: orpc.shopOwner.getShopProducts.key() });
      qc.invalidateQueries({ queryKey: orpc.shopOwner.getShopProductKPIs.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}
