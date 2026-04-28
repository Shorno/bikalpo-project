"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// My Store Preview Hooks (Consumer View)
// ────────────────────────────────────────────────────────────────

/**
 * Full store preview data: store identity, categories, products with variants/brands.
 * Used by the "My Store" page to render the consumer-facing store view.
 */
export function useMyStorePreview() {
  return useQuery(
    orpc.shopOwner.getMyStorePreview.queryOptions({
      staleTime: 1000 * 60 * 2,
    }),
  );
}

/**
 * Store KPIs: total orders, customers, average rating.
 * Separate from preview data to allow independent caching.
 */
export function useMyStoreStats() {
  return useQuery(
    orpc.shopOwner.getMyStoreStats.queryOptions({
      staleTime: 1000 * 60 * 5,
    }),
  );
}
