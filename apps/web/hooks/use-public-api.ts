/**
 * ORPC-powered React hooks for the public / customer-facing API.
 *
 * Uses the existing `orpc` TanStack Query utils from @/utils/orpc
 * which is already wired into the app's QueryClientProvider.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// QUERY HOOKS
// ────────────────────────────────────────────────────────────────

/** Paginated, filterable product listing */
export function usePublicProducts(filters: {
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
  return useQuery({
    queryKey: ["public-products", filters],
    queryFn: () => client.public.getPublicProducts(filters),
    staleTime: 1000 * 60 * 2,
  });
}

/** Quick product search (max 10 results) */
export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ["public-search", query],
    queryFn: () => client.public.searchProducts({ query }),
    enabled: query.trim().length > 0,
    staleTime: 1000 * 30,
  });
}

/** Product detail by slug */
export function useProductDetails(slug: string) {
  return useQuery({
    queryKey: ["public-product", slug],
    queryFn: () => client.public.getProductDetails({ slug }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}

/** Product reviews */
export function useProductReviews(productId: number | undefined) {
  return useQuery({
    queryKey: ["public-reviews", productId],
    queryFn: () => client.public.getProductReviews({ productId: productId! }),
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Active categories with subcategories */
export function useActiveCategories() {
  return useQuery({
    queryKey: ["public-categories"],
    queryFn: () => client.public.getActiveCategories(),
    staleTime: 1000 * 60 * 10,
  });
}

/** Category by slug */
export function useCategoryBySlug(slug: string) {
  return useQuery({
    queryKey: ["public-category", slug],
    queryFn: () => client.public.getCategoryBySlug({ slug }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

/** Categories with products (home page) */
export function useCategoriesWithProducts(limit?: number) {
  return useQuery({
    queryKey: ["public-categories-products", limit],
    queryFn: () =>
      client.public.getCategoriesWithProducts(limit ? { limit } : undefined),
    staleTime: 1000 * 60 * 5,
  });
}

/** Subcategories by category slug */
export function useSubcategoriesByCategory(slug: string) {
  return useQuery({
    queryKey: ["public-subcategories", slug],
    queryFn: () => client.public.getSubcategoriesByCategory({ slug }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

/** Active brands */
export function useActiveBrands() {
  return useQuery({
    queryKey: ["public-brands"],
    queryFn: () => client.public.getActiveBrands(),
    staleTime: 1000 * 60 * 10,
  });
}

/** Customer orders */
export function useMyOrders() {
  return useQuery({
    queryKey: ["public-orders"],
    queryFn: () => client.public.getMyOrders(),
  });
}

/** Order by order number */
export function useOrderByNumber(orderNumber: string) {
  return useQuery({
    queryKey: ["public-order", orderNumber],
    queryFn: () => client.public.getOrderByNumber({ orderNumber }),
    enabled: !!orderNumber,
  });
}

/** Order status with payment */
export function useOrderStatus(orderId: number | undefined) {
  return useQuery({
    queryKey: ["public-order-status", orderId],
    queryFn: () => client.public.getOrderStatus({ orderId: orderId! }),
    enabled: !!orderId,
    refetchInterval: 30000, // poll every 30s
  });
}

/** Active order */
export function useActiveOrder() {
  return useQuery({
    queryKey: ["public-active-order"],
    queryFn: () => client.public.getActiveOrder(),
  });
}

/** Cart */
export function useCartQuery() {
  return useQuery({
    queryKey: ["public-cart"],
    queryFn: () => client.public.getCart(),
  });
}

/** Customer profile */
export function useProfile() {
  return useQuery({
    queryKey: ["public-profile"],
    queryFn: () => client.public.getProfile(),
  });
}

/** Customer addresses */
export function useMyAddresses() {
  return useQuery({
    queryKey: ["public-addresses"],
    queryFn: () => client.public.getMyAddresses(),
  });
}

/** Active announcements */
export function useAnnouncements() {
  return useQuery({
    queryKey: ["public-announcements"],
    queryFn: () => client.public.getAnnouncements(),
    staleTime: 1000 * 60 * 5,
  });
}

// ────────────────────────────────────────────────────────────────
// MUTATION HOOKS
// ────────────────────────────────────────────────────────────────

/** Add to cart */
export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      productId: number;
      quantity?: number;
      variantId?: number;
    }) => client.public.addToCart(input),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["public-cart"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Update cart item */
export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cartItemId: number; quantity: number }) =>
      client.public.updateCartItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-cart"] }),
    onError: (err) => toast.error(err.message),
  });
}

/** Remove from cart */
export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cartItemId: number }) =>
      client.public.removeFromCart(input),
    onSuccess: () => {
      toast.success("Item removed from cart");
      qc.invalidateQueries({ queryKey: ["public-cart"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Clear cart */
export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.public.clearCart(),
    onSuccess: () => {
      toast.success("Cart cleared");
      qc.invalidateQueries({ queryKey: ["public-cart"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Place order */
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      shippingInfo: {
        name: string;
        phone: string;
        email?: string;
        address: string;
        city: string;
        area?: string;
        postalCode?: string;
        customerNote?: string;
      };
      paymentMethod?:
        | "cash_on_delivery"
        | "bkash"
        | "nagad"
        | "bank_transfer"
        | "card";
    }) => client.public.placeOrder(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-cart"] });
      qc.invalidateQueries({ queryKey: ["public-orders"] });
      qc.invalidateQueries({ queryKey: ["public-active-order"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Cancel order */
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: number }) =>
      client.public.cancelOrder(input),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["public-orders"] });
      qc.invalidateQueries({ queryKey: ["public-active-order"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Create review */
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      productId: number;
      rating: number;
      title?: string;
      comment: string;
    }) => client.public.createReview(input),
    onSuccess: (_, variables) => {
      toast.success("Review submitted!");
      qc.invalidateQueries({
        queryKey: ["public-reviews", variables.productId],
      });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Add address */
export function useAddAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      label: string;
      recipientName: string;
      phone: string;
      address: string;
      city: string;
      area?: string;
      postalCode?: string;
      isDefault?: boolean;
    }) => client.public.addAddress(input),
    onSuccess: () => {
      toast.success("Address added");
      qc.invalidateQueries({ queryKey: ["public-addresses"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Update address */
export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: number;
      label: string;
      recipientName: string;
      phone: string;
      address: string;
      city: string;
      area?: string;
      postalCode?: string;
      isDefault?: boolean;
    }) => client.public.updateAddress(input),
    onSuccess: () => {
      toast.success("Address updated");
      qc.invalidateQueries({ queryKey: ["public-addresses"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Delete address */
export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number }) => client.public.deleteAddress(input),
    onSuccess: () => {
      toast.success("Address deleted");
      qc.invalidateQueries({ queryKey: ["public-addresses"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Set default address */
export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number }) =>
      client.public.setDefaultAddress(input),
    onSuccess: () => {
      toast.success("Default address updated");
      qc.invalidateQueries({ queryKey: ["public-addresses"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Update profile */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      businessName: string;
      ownerName: string;
      phoneNumber?: string | null;
      vatNumber?: string | null;
      address?: string | null;
      facebook?: string | null;
      whatsapp?: string | null;
    }) => client.public.updateProfile(input),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["public-profile"] });
    },
    onError: (err) => toast.error(err.message),
  });
}
