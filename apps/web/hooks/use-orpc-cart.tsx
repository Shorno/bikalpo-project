/**
 * ORPC-backed Cart Provider – replaces the server-action-based CartProvider.
 *
 * Uses TanStack React Query under the hood (via useCartQuery, useAddToCart, etc.)
 * but exposes the same CartContextType interface so all existing consumers
 * (`useCart()`) continue to work without changes.
 */
"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLoginRequired } from "@/components/features/auth/login-required-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  mode: "open_order" | "direct" | null;
  directShopId: string | null;
  items: CartItem[];
  addItem: (
    productId: number,
    quantity?: number,
    variantId?: number,
    shopId?: string,
    purchaseMode?: "open_order" | "direct",
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
  const [replacementOpen, setReplacementOpen] = useState(false);
  const replacementResolver = useRef<((replace: boolean) => void) | null>(null);

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
    purchaseMode?: "open_order" | "direct",
  ) => {
    if (!session) {
      showLoginModal();
      return;
    }
    const request = {
      productId,
      quantity,
      variantId,
      shopId,
      purchaseMode:
        purchaseMode ??
        (shopId ? ("direct" as const) : ("open_order" as const)),
    };
    try {
      await addToCartMutation.mutateAsync({ ...request, replaceCart: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Item could not be added.";
      if (!/replace/i.test(message)) {
        toast.error(message);
        return;
      }
      const replace = await new Promise<boolean>((resolve) => {
        replacementResolver.current = resolve;
        setReplacementOpen(true);
      });
      if (!replace) return;
      await addToCartMutation.mutateAsync({ ...request, replaceCart: true });
    }
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

  const resolveReplacement = (replace: boolean) => {
    replacementResolver.current?.(replace);
    replacementResolver.current = null;
    setReplacementOpen(false);
  };

  return (
    <CartContext.Provider
      value={{
        mode: cartData?.mode ?? null,
        directShopId: cartData?.directShopId ?? null,
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
      <AlertDialog
        open={replacementOpen}
        onOpenChange={(open) => {
          if (!open) resolveReplacement(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Open-order items and direct retailer items cannot be mixed.
              Replacing the cart removes its current items before adding this
              one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveReplacement(false)}>
              Keep current cart
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => resolveReplacement(true)}
            >
              Replace and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
