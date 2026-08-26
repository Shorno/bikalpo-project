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
import { getProductCardSelectionKey } from "@/lib/product-card-cart-item";

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
  cylinderSale?: {
    exchangeEnabled: boolean;
    mode: "new" | "exchange";
    defaultMode: "new" | "exchange";
    exchangeCreditAmount: number;
    newUnitPrice: number;
    effectiveUnitPrice: number;
    expectedReturnQty: number;
    selectionValid: boolean;
  } | null;
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
    cylinderSaleMode?: "new" | "exchange",
  ) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  updateCylinderSaleMode: (
    cartItemId: number,
    mode: "new" | "exchange",
  ) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  isHydrated: boolean;
  isLoading: boolean;
  pendingAddSelectionKeys: ReadonlySet<string>;
  pendingCartItemIds: ReadonlySet<number>;
}

export const CartContext = createContext<CartContextType | undefined>(
  undefined,
);

export function OrpcCartProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const { showLoginModal } = useLoginRequired();
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [pendingAddSelectionKeys, setPendingAddSelectionKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [pendingCartItemIds, setPendingCartItemIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
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
    cylinderSaleMode?: "new" | "exchange",
  ) => {
    if (!session) {
      showLoginModal();
      return;
    }
    const selectionKey =
      variantId != null
        ? getProductCardSelectionKey({
            productId,
            variantId,
            shopId: shopId ?? null,
            cylinderSaleMode: cylinderSaleMode ?? "new",
          })
        : null;
    const request = {
      productId,
      quantity,
      variantId,
      shopId,
      purchaseMode:
        purchaseMode ??
        (shopId ? ("direct" as const) : ("open_order" as const)),
      ...(cylinderSaleMode ? { cylinderSaleMode } : {}),
    };
    if (selectionKey) {
      setPendingAddSelectionKeys((current) =>
        new Set(current).add(selectionKey),
      );
    }
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
    } finally {
      if (selectionKey) {
        setPendingAddSelectionKeys((current) => {
          const next = new Set(current);
          next.delete(selectionKey);
          return next;
        });
      }
    }
  };

  const removeItem = async (cartItemId: number) => {
    await removeMutation.mutateAsync({ cartItemId });
  };

  const updateQuantity = async (cartItemId: number, quantity: number) => {
    setPendingCartItemIds((current) => new Set(current).add(cartItemId));
    try {
      if (quantity <= 0) {
        await removeItem(cartItemId);
        return;
      }
      await updateMutation.mutateAsync({ cartItemId, quantity });
    } finally {
      setPendingCartItemIds((current) => {
        const next = new Set(current);
        next.delete(cartItemId);
        return next;
      });
    }
  };

  const updateCylinderSaleMode = async (
    cartItemId: number,
    cylinderSaleMode: "new" | "exchange",
  ) => {
    const item = items.find((row) => row.id === cartItemId);
    if (!item) return;
    await updateMutation.mutateAsync({
      cartItemId,
      quantity: item.quantity,
      cylinderSaleMode,
    });
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
        updateCylinderSaleMode,
        clearCart: clearCartFn,
        refreshCart,
        totalItems,
        totalPrice,
        isHydrated: !isSessionPending && (isFetched || !session),
        isLoading,
        pendingAddSelectionKeys,
        pendingCartItemIds,
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
