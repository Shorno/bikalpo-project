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

/** Aggregated stock overview KPIs for the dashboard */
export function useStockOverview() {
  return useQuery(
    orpc.shopOwner.getStockOverview.queryOptions({
      input: undefined,
      staleTime: 1000 * 60 * 2, // 2 min cache
    }),
  );
}

/** Real-time stock grouped by product with pack/loose breakdown */
export function useRealtimeStock(params?: {
  search?: string;
  categoryId?: number;
  status?: "all" | "in_stock" | "low" | "out_of_stock";
}) {
  return useQuery(
    orpc.shopOwner.getRealtimeStock.queryOptions({
      input: {
        search: params?.search,
        categoryId: params?.categoryId,
        status: params?.status ?? "all",
      },
      staleTime: 1000 * 30, // 30s for real-time feel
    }),
  );
}

/** Low stock products with variant-level detail */
export function useLowStockProducts() {
  return useQuery(
    orpc.shopOwner.getLowStockProducts.queryOptions({
      input: undefined,
      staleTime: 1000 * 60, // 1 min cache
    }),
  );
}

/** Expired products from damage entries + expiry watchlist */
export function useExpiredProducts() {
  return useQuery(
    orpc.shopOwner.getExpiredProducts.queryOptions({
      input: undefined,
      staleTime: 1000 * 60 * 2, // 2 min cache
    }),
  );
}

/** Empty pack collection and return tracking */
export function useEmptyPackSummary() {
  return useQuery(
    orpc.shopOwner.getEmptyPackSummary.queryOptions({
      input: undefined,
      staleTime: 1000 * 60 * 2, // 2 min cache
    }),
  );
}

/** B2B → B2C conversion history */
export function useConversionHistory() {
  return useQuery(
    orpc.shopOwner.getConversionHistory.queryOptions({
      input: undefined,
      staleTime: 1000 * 60 * 2, // 2 min cache
    }),
  );
}

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

/** Purchase orders with search, filters, and KPIs */
export function usePurchaseOrders(params?: {
  search?: string;
  status?: "pending" | "confirmed" | "processing" | "delivered" | "cancelled";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getPurchaseOrders.queryOptions({
      input: {
        search: params?.search || undefined,
        status: params?.status,
        dateFrom: params?.dateFrom,
        dateTo: params?.dateTo,
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
      staleTime: 1000 * 30,
    }),
  );
}

/** Full detail for a single purchase order */
export function usePurchaseOrderDetail(orderId: number | null) {
  return useQuery(
    orpc.shopOwner.getPurchaseOrderDetail.queryOptions({
      input: { orderId: orderId! },
      enabled: !!orderId,
      staleTime: 1000 * 30,
    }),
  );
}

/** Mark a purchase order as received */
export function useMarkPurchaseReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      orderId: number;
      receivedItems?: { itemId: number; receivedQty: number }[];
    }) => orpc.shopOwner.markPurchaseReceived.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Order received successfully");
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrders"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrderDetail"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getMyOrders"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to receive order");
    },
  });
}

/** Cancel a purchase order */
export function useCancelPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: number }) =>
      orpc.shopOwner.cancelPurchaseOrder.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Order cancelled");
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrders"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrderDetail"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getMyOrders"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel order");
    },
  });
}

/** Purchase order tracking with delivery progress and timelines */
export function usePurchaseTracking(params?: {
  search?: string;
  status?: "pending" | "confirmed" | "processing" | "delivered" | "cancelled";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getPurchaseTracking.queryOptions({
      input: {
        search: params?.search || undefined,
        status: params?.status,
        dateFrom: params?.dateFrom,
        dateTo: params?.dateTo,
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
      staleTime: 1000 * 15,
    }),
  );
}

/** Accept wholesaler's modifications */
export function useAcceptPurchaseModification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: number }) =>
      orpc.shopOwner.acceptPurchaseModification.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Modifications accepted");
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseTracking"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrders"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrderDetail"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to accept modifications");
    },
  });
}

/** Reject wholesaler's modifications (cancels order) */
export function useRejectPurchaseModification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: number }) =>
      orpc.shopOwner.rejectPurchaseModification.call(input),
    onSuccess: (data) => {
      toast.success(data.message || "Order cancelled");
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseTracking"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrders"] });
      qc.invalidateQueries({ queryKey: ["shopOwner", "getPurchaseOrderDetail"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject modifications");
    },
  });
}

/** Purchase history with stock impact and trends */
export function usePurchaseHistory(params?: {
  search?: string;
  status?: "delivered" | "cancelled" | "returned";
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.shopOwner.getPurchaseHistory.queryOptions({
      input: {
        search: params?.search || undefined,
        status: params?.status,
        warehouseId: params?.warehouseId,
        dateFrom: params?.dateFrom,
        dateTo: params?.dateTo,
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      },
      staleTime: 1000 * 30,
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

// ────────────────────────────────────────────────────────────────
// STOCK ADJUSTMENT HOOKS
// ────────────────────────────────────────────────────────────────

/** Search shop variants for stock adjustment product picker */
export function useSearchShopVariantsForAdjustment(search?: string) {
  return useQuery(
    orpc.shopOwner.searchShopVariantsForAdjustment.queryOptions({
      input: { search: search || undefined, limit: 20 },
      staleTime: 1000 * 60,
    }),
  );
}

/** Create a stock adjustment (auto-submitted, applies to inventory) */
export function useCreateShopAdjustment() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.shopOwner.createShopAdjustment.mutationOptions({
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
          queryKey: [["shopOwner", "getShopAdjustments"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyStorePreview"]],
        });
      },
    }),
  );
}

/** List shop adjustment history (paginated) */
export function useShopAdjustments(params?: {
  search?: string;
  adjustmentType?: string;
  page?: number;
}) {
  return useQuery(
    orpc.shopOwner.getShopAdjustments.queryOptions({
      input: {
        search: params?.search || undefined,
        adjustmentType: params?.adjustmentType as any,
        page: params?.page ?? 1,
        pageSize: 20,
      },
      staleTime: 1000 * 30,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// DAMAGE MANAGEMENT HOOKS
// ────────────────────────────────────────────────────────────────

/** Create a damage entry (deducts inventory, calculates loss) */
export function useCreateDamageEntry() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.shopOwner.createDamageEntry.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyRetailProducts"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyInventory"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getDamageEntries"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getDamageSummary"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["shopOwner", "getMyStorePreview"]],
        });
      },
    }),
  );
}

/** List damage entries (paginated) */
export function useDamageEntries(params?: {
  search?: string;
  damageType?: string;
  page?: number;
}) {
  return useQuery(
    orpc.shopOwner.getDamageEntries.queryOptions({
      input: {
        search: params?.search || undefined,
        damageType: params?.damageType as any,
        page: params?.page ?? 1,
        pageSize: 20,
      },
      staleTime: 1000 * 30,
    }),
  );
}

/** Get single damage entry detail */
export function useDamageEntryDetail(id: number) {
  return useQuery(
    orpc.shopOwner.getDamageEntryDetail.queryOptions({
      input: { id },
      staleTime: 1000 * 60,
    }),
  );
}

/** KPI summary for damage management */
export function useDamageSummary() {
  return useQuery(
    orpc.shopOwner.getDamageSummary.queryOptions({
      input: undefined,
      staleTime: 1000 * 60 * 2,
    }),
  );
}
