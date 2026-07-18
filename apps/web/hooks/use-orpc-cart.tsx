/**
 * ORPC-backed Cart Provider – replaces the server-action-based CartProvider.
 *
 * Uses TanStack React Query under the hood (via useCartQuery, useAddToCart, etc.)
 * but exposes the same CartContextType interface so all existing consumers
 * (`useCart()`) continue to work without changes.
 */
"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useLoginRequired } from "@/components/features/auth/login-required-modal";
import {
  useAddToCart,
  useCartQuery,
  useClearCart,
  useRemoveFromCart,
  useUpdateCartItem,
} from "@/hooks/use-customer-api";
import { authClient } from "@/lib/auth-client";

export interface CartItem {
  id: number;
  productId: number;
  variantId?: number | null;
  name: string;
  slug: string;
  categorySlug?: string;
  price: number;
  currentPrice: number;
  image: string;
  size: string;
  quantity: number;
  inStock: boolean;
  shopId?: string | null;
  shopName?: string | null;
  shopSlug?: string | null;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (
    productId: number,
    quantity?: number,
    variantId?: number,
    shopId?: string,
  ) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  isHydrated: boolean;
  isLoading: boolean;
}

export const CartContext = createContext<CartContextType | undefined>(
  undefined,
);

export function OrpcCartProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const { showLoginModal } = useLoginRequired();

  const {
    data: cartData,
    isLoading: isFetching,
    isFetched,
    refetch,
  } = useCartQuery(!!session);

  const addToCartMutation = useAddToCart();
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveFromCart();
  const clearMutation = useClearCart();

  const items: CartItem[] = useMemo(() => {
    if (!session || !cartData?.items) return [];
    return cartData.items as unknown as CartItem[];
  }, [session, cartData]);

  const isLoading =
    isFetching ||
    addToCartMutation.isPending ||
    updateMutation.isPending ||
    removeMutation.isPending ||
    clearMutation.isPending;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const addItem = async (
    productId: number,
    quantity = 1,
    variantId?: number,
    shopId?: string,
  ) => {
    if (!session) {
      showLoginModal();
      return;
    }
    await addToCartMutation.mutateAsync({
      productId,
      quantity,
      variantId,
      shopId,
    });
  };

  const removeItem = async (cartItemId: number) => {
    await removeMutation.mutateAsync({ cartItemId });
  };

  const updateQuantity = async (cartItemId: number, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(cartItemId);
      return;
    }
    await updateMutation.mutateAsync({ cartItemId, quantity });
  };

  const clearCartFn = async () => {
    await clearMutation.mutateAsync({});
  };

  const refreshCart = async () => {
    await refetch();
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart: clearCartFn,
        refreshCart,
        totalItems,
        totalPrice,
        isHydrated: isFetched || !session,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within an OrpcCartProvider");
  }
  return context;
}
