/**
 * ORPC-powered React hooks for the customer-facing API.
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
  return useQuery({
    queryKey: ["customer-products", filters],
    queryFn: () => client.customer.getCustomerProducts(filters),
    staleTime: 1000 * 60 * 2,
  });
}

/** Quick product search (max 10 results) */
export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: ["customer-search", query],
    queryFn: () => client.customer.searchProducts({ query }),
    enabled: query.trim().length > 0,
    staleTime: 1000 * 30,
  });
}

/** Product detail by slug */
export function useProductDetails(slug: string) {
  return useQuery({
    queryKey: ["customer-product", slug],
    queryFn: () => client.customer.getProductDetails({ slug }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}

/** Product reviews */
export function useProductReviews(productId: number | undefined) {
  return useQuery({
    queryKey: ["customer-reviews", productId],
    queryFn: () => client.customer.getProductReviews({ productId: productId! }),
    enabled: !!productId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Active categories with subcategories */
export function useActiveCategories() {
  return useQuery({
    queryKey: ["customer-categories"],
    queryFn: () => client.customer.getActiveCategories(),
    staleTime: 1000 * 60 * 10,
  });
}

/** Category by slug */
export function useCategoryBySlug(slug: string) {
  return useQuery({
    queryKey: ["customer-category", slug],
    queryFn: () => client.customer.getCategoryBySlug({ slug }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

/** Categories with products (home page) */
export function useCategoriesWithProducts(limit?: number) {
  return useQuery({
    queryKey: ["customer-categories-products", limit],
    queryFn: () =>
      client.customer.getCategoriesWithProducts(limit ? { limit } : undefined),
    staleTime: 1000 * 60 * 5,
  });
}

/** Subcategories by category slug */
export function useSubcategoriesByCategory(slug: string) {
  return useQuery({
    queryKey: ["customer-subcategories", slug],
    queryFn: () => client.customer.getSubcategoriesByCategory({ slug }),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

/** Active brands */
export function useActiveBrands() {
  return useQuery({
    queryKey: ["customer-brands"],
    queryFn: () => client.customer.getActiveBrands(),
    staleTime: 1000 * 60 * 10,
  });
}

/** Customer orders */
export function useMyOrders() {
  return useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => client.customer.getMyOrders(),
  });
}

/** Order by order number */
export function useOrderByNumber(orderNumber: string) {
  return useQuery({
    queryKey: ["customer-order", orderNumber],
    queryFn: () => client.customer.getOrderByNumber({ orderNumber }),
    enabled: !!orderNumber,
  });
}

/** Order status with payment */
export function useOrderStatus(orderId: number | undefined) {
  return useQuery({
    queryKey: ["customer-order-status", orderId],
    queryFn: () => client.customer.getOrderStatus({ orderId: orderId! }),
    enabled: !!orderId,
    refetchInterval: 30000, // poll every 30s
  });
}

/** Active order */
export function useActiveOrder() {
  return useQuery({
    queryKey: ["customer-active-order"],
    queryFn: () => client.customer.getActiveOrder(),
  });
}

/** Cart */
export function useCartQuery() {
  return useQuery({
    queryKey: ["customer-cart"],
    queryFn: () => client.customer.getCart(),
  });
}

/** Customer profile */
export function useProfile() {
  return useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => client.customer.getProfile(),
  });
}

/** Customer addresses */
export function useMyAddresses() {
  return useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => client.customer.getMyAddresses(),
  });
}

/** Active announcements */
export function useAnnouncements() {
  return useQuery({
    queryKey: ["customer-announcements"],
    queryFn: () => client.customer.getAnnouncements(),
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
    }) => client.customer.addToCart(input),
    onSuccess: (data) => {
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["customer-cart"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Update cart item */
export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cartItemId: number; quantity: number }) =>
      client.customer.updateCartItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-cart"] }),
    onError: (err) => toast.error(err.message),
  });
}

/** Remove from cart */
export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { cartItemId: number }) =>
      client.customer.removeFromCart(input),
    onSuccess: () => {
      toast.success("Item removed from cart");
      qc.invalidateQueries({ queryKey: ["customer-cart"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Clear cart */
export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.customer.clearCart(),
    onSuccess: () => {
      toast.success("Cart cleared");
      qc.invalidateQueries({ queryKey: ["customer-cart"] });
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
    }) => client.customer.placeOrder(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-cart"] });
      qc.invalidateQueries({ queryKey: ["customer-orders"] });
      qc.invalidateQueries({ queryKey: ["customer-active-order"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Cancel order */
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: number }) =>
      client.customer.cancelOrder(input),
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["customer-orders"] });
      qc.invalidateQueries({ queryKey: ["customer-active-order"] });
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
    }) => client.customer.createReview(input),
    onSuccess: (_, variables) => {
      toast.success("Review submitted!");
      qc.invalidateQueries({
        queryKey: ["customer-reviews", variables.productId],
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
    }) => client.customer.addAddress(input),
    onSuccess: () => {
      toast.success("Address added");
      qc.invalidateQueries({ queryKey: ["customer-addresses"] });
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
    }) => client.customer.updateAddress(input),
    onSuccess: () => {
      toast.success("Address updated");
      qc.invalidateQueries({ queryKey: ["customer-addresses"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Delete address */
export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number }) => client.customer.deleteAddress(input),
    onSuccess: () => {
      toast.success("Address deleted");
      qc.invalidateQueries({ queryKey: ["customer-addresses"] });
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Set default address */
export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number }) =>
      client.customer.setDefaultAddress(input),
    onSuccess: () => {
      toast.success("Default address updated");
      qc.invalidateQueries({ queryKey: ["customer-addresses"] });
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
    }) => client.customer.updateProfile(input),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["customer-profile"] });
    },
    onError: (err) => toast.error(err.message),
  });
}
