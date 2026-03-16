/**
 * ORPC-powered React hooks for the customer-facing API.
 *
 * Uses `orpc` TanStack Query utils from @/utils/orpc for
 * auto-generated query keys, type-safe inputs, and skipToken.
 */

"use client";

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { type client, orpc } from "@/utils/orpc";

/** Inferred type for a single verified user from the ORPC response */
export type VerifiedUser = Awaited<
  ReturnType<typeof client.customer.getVerifiedUsers>
>["users"][number];

// ────────────────────────────────────────────────────────────────
// QUERY HOOKS
// ────────────────────────────────────────────────────────────────

/** Paginated, filterable product listing */
export function useCustomerProducts(filters: {
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
    orpc.customer.getCustomerProducts.queryOptions({
      input: filters,
      staleTime: 1000 * 60 * 2,
    }),
  );
}

/** Quick product search (max 10 results) */
export function useSearchProducts(query: string) {
  return useQuery(
    orpc.customer.searchProducts.queryOptions({
      input: query.trim().length > 0 ? { query } : skipToken,
      staleTime: 1000 * 30,
    }),
  );
}

/** Product detail by slug */
export function useProductDetails(slug: string) {
  return useQuery(
    orpc.customer.getProductDetails.queryOptions({
      input: slug ? { slug } : skipToken,
      staleTime: 1000 * 60 * 5,
    }),
  );
}

/** Product reviews */
export function useProductReviews(productId: number | undefined) {
  return useQuery(
    orpc.customer.getProductReviews.queryOptions({
      input: productId != null ? { productId } : skipToken,
    }),
  );
}

/** Active categories with subcategories */
export function useActiveCategories() {
  return useQuery(
    orpc.customer.getActiveCategories.queryOptions({
      staleTime: 1000 * 60 * 10,
    }),
  );
}

/** Category by slug */
export function useCategoryBySlug(slug: string) {
  return useQuery(
    orpc.customer.getCategoryBySlug.queryOptions({
      input: slug ? { slug } : skipToken,
    }),
  );
}

/** Categories with products (home page) */
export function useCategoriesWithProducts(limit?: number) {
  return useQuery(
    orpc.customer.getCategoriesWithProducts.queryOptions({
      input: { limit: limit ?? 8 },
      staleTime: 1000 * 60 * 5,
    }),
  );
}

/** Curated customer home tabs with products */
export function useCustomerHomeProductTabs() {
  return useQuery(
    orpc.customer.getHomeProductTabs.queryOptions({
      staleTime: 1000 * 60 * 5,
    }),
  );
}

/** Subcategories by category slug */
export function useSubcategoriesByCategory(slug: string) {
  return useQuery(
    orpc.customer.getSubcategoriesByCategory.queryOptions({
      input: slug ? { slug } : skipToken,
    }),
  );
}

/** Active brands */
export function useActiveBrands() {
  return useQuery(
    orpc.customer.getActiveBrands.queryOptions({
      staleTime: 1000 * 60 * 10,
    }),
  );
}

/** Customer orders */
export function useMyOrders() {
  return useQuery(orpc.customer.getMyOrders.queryOptions());
}

/** Order by order number */
export function useOrderByNumber(orderNumber: string) {
  return useQuery(
    orpc.customer.getOrderByNumber.queryOptions({
      input: orderNumber ? { orderNumber } : skipToken,
    }),
  );
}

/** Order status with payment */
export function useOrderStatus(orderId: number | undefined) {
  return useQuery(
    orpc.customer.getOrderStatus.queryOptions({
      input: orderId != null ? { orderId } : skipToken,
    }),
  );
}

/** Active order */
export function useActiveOrder() {
  return useQuery(orpc.customer.getActiveOrder.queryOptions());
}

/** Cart */
export function useCartQuery() {
  return useQuery(orpc.customer.getCart.queryOptions());
}

/** Customer profile */
export function useProfile() {
  return useQuery(orpc.customer.getProfile.queryOptions());
}

/** Customer addresses */
export function useMyAddresses() {
  return useQuery(orpc.customer.getMyAddresses.queryOptions());
}

/** Active announcements */
export function useAnnouncements() {
  return useQuery(
    orpc.customer.getAnnouncements.queryOptions({
      staleTime: 1000 * 60 * 5,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// MUTATION HOOKS
// ────────────────────────────────────────────────────────────────

/** Add to cart */
export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.addToCart.mutationOptions(),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: orpc.customer.getCart.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Update cart item */
export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.updateCartItem.mutationOptions(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: orpc.customer.getCart.key() }),
    onError: (err) => toast.error(err.message),
  });
}

/** Remove from cart */
export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.removeFromCart.mutationOptions(),
    onSuccess: () => {
      toast.success("Item removed from cart");
      qc.invalidateQueries({ queryKey: orpc.customer.getCart.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Clear cart */
export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.clearCart.mutationOptions(),
    onSuccess: () => {
      toast.success("Cart cleared");
      qc.invalidateQueries({ queryKey: orpc.customer.getCart.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Place order */
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.placeOrder.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.customer.getCart.key() });
      qc.invalidateQueries({ queryKey: orpc.customer.getMyOrders.key() });
      qc.invalidateQueries({ queryKey: orpc.customer.getActiveOrder.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Cancel order */
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.cancelOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: orpc.customer.getMyOrders.key() });
      qc.invalidateQueries({ queryKey: orpc.customer.getActiveOrder.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Create review */
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.createReview.mutationOptions(),
    onSuccess: (_, variables) => {
      toast.success("Review submitted!");
      qc.invalidateQueries({
        queryKey: orpc.customer.getProductReviews.key({
          input: { productId: variables.productId },
        }),
      });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Add address */
export function useAddAddress() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.addAddress.mutationOptions(),
    onSuccess: () => {
      toast.success("Address added");
      qc.invalidateQueries({ queryKey: orpc.customer.getMyAddresses.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Update address */
export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.updateAddress.mutationOptions(),
    onSuccess: () => {
      toast.success("Address updated");
      qc.invalidateQueries({ queryKey: orpc.customer.getMyAddresses.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Delete address */
export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.deleteAddress.mutationOptions(),
    onSuccess: () => {
      toast.success("Address deleted");
      qc.invalidateQueries({ queryKey: orpc.customer.getMyAddresses.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Set default address */
export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.setDefaultAddress.mutationOptions(),
    onSuccess: () => {
      toast.success("Default address updated");
      qc.invalidateQueries({ queryKey: orpc.customer.getMyAddresses.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Update profile */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.updateProfile.mutationOptions(),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: orpc.customer.getProfile.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

// ────────────────────────────────────────────────────────────────
// MIGRATED PAGE QUERY HOOKS
// ────────────────────────────────────────────────────────────────

/** Customer estimates (approved/converted) */
export function useCustomerEstimates() {
  return useQuery(orpc.customer.getEstimatesByCustomer.queryOptions());
}

/** Single estimate by ID */
export function useEstimateById(id: number | undefined) {
  return useQuery(
    orpc.customer.getEstimateById.queryOptions({
      input: id != null ? { id } : skipToken,
    }),
  );
}

/** Estimated delivery cost based on area */
export function useEstimatedDeliveryCost(area?: string) {
  return useQuery(
    orpc.customer.getEstimatedDeliveryCost.queryOptions({
      input: { area },
      staleTime: 1000 * 60 * 2,
    }),
  );
}

/** Reorder items for a delivered order */
export function useReorderItems(orderId: number | undefined) {
  return useQuery(
    orpc.customer.getReorderItems.queryOptions({
      input: orderId != null ? { orderId } : skipToken,
    }),
  );
}

/** Customer support tickets (paginated) */
export function useCustomerTickets(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  return useQuery(
    orpc.customer.getCustomerTickets.queryOptions({
      input: params ?? {},
    }),
  );
}

/** Ticket details with replies */
export function useTicketDetails(ticketId: number | undefined) {
  return useQuery(
    orpc.customer.getTicketDetails.queryOptions({
      input: ticketId != null ? { ticketId } : skipToken,
    }),
  );
}

/** Customer item requests (paginated) */
export function useCustomerItemRequests(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  return useQuery(
    orpc.customer.getCustomerItemRequests.queryOptions({
      input: params ?? {},
    }),
  );
}

/** Verified users for home page (top 3) */
export function useVerifiedUsersForHome() {
  return useQuery(
    orpc.verifiedUser.getForHome.queryOptions({
      staleTime: 1000 * 60 * 5,
    }),
  );
}

// ────────────────────────────────────────────────────────────────
// MIGRATED PAGE MUTATION HOOKS
// ────────────────────────────────────────────────────────────────

/** Place reorder from a previous order */
export function usePlaceReorder() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.placeReorder.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.customer.getMyOrders.key() });
      qc.invalidateQueries({ queryKey: orpc.customer.getActiveOrder.key() });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Create a support ticket */
export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.createSupportTicket.mutationOptions(),
    onSuccess: () => {
      toast.success("Ticket created");
      qc.invalidateQueries({
        queryKey: orpc.customer.getCustomerTickets.key(),
      });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Add a reply to a support ticket */
export function useAddTicketReply() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.addTicketReply.mutationOptions(),
    onSuccess: (_, variables) => {
      toast.success("Reply sent");
      qc.invalidateQueries({
        queryKey: orpc.customer.getTicketDetails.key({
          input: { ticketId: variables.ticketId },
        }),
      });
    },
    onError: (err) => toast.error(err.message),
  });
}

// ────────────────────────────────────────────────────────────────
// PHASE 2 HOOKS
// ────────────────────────────────────────────────────────────────

/** Active brand updates */
export function useBrandUpdates() {
  return useQuery(
    orpc.customer.getBrandUpdates.queryOptions({
      staleTime: 1000 * 60 * 5,
    }),
  );
}

/** Verified users with filtering & pagination */
export function useVerifiedUsers(params?: {
  search?: string;
  area?: string;
  sortBy?: "top_buyers" | "most_orders" | "newest";
  page?: number;
  limit?: number;
}) {
  return useQuery(
    orpc.customer.getVerifiedUsers.queryOptions({
      input: params ?? {},
    }),
  );
}

/** Count of verified users */
export function useVerifiedUsersCount() {
  return useQuery(orpc.customer.getVerifiedUsersCount.queryOptions());
}

/** Convert an estimate to an order */
export function useConvertEstimateToOrder() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.convertEstimateToOrder.mutationOptions(),
    onSuccess: () => {
      toast.success("Estimate converted to order successfully!");
      qc.invalidateQueries({
        queryKey: orpc.customer.getEstimatesByCustomer.key(),
      });
      qc.invalidateQueries({
        queryKey: orpc.customer.getMyOrders.key(),
      });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Create a new item request */
export function useCreateItemRequest() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.customer.createItemRequest.mutationOptions(),
    onSuccess: () => {
      toast.success("Request submitted successfully!");
      qc.invalidateQueries({
        queryKey: orpc.customer.getCustomerItemRequests.key(),
      });
    },
    onError: (err) => toast.error(err.message),
  });
}
