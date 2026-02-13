"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLoginRequired } from "@/components/features/auth/login-required-modal";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export interface CartItem {
  id: number; // cart item id
  productId: number;
  name: string;
  slug: string;
  categorySlug: string;
  price: number;
  currentPrice: number;
  image: string;
  size: string;
  quantity: number;
  inStock: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (productId: number, quantity?: number) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  isHydrated: boolean;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
type CartData = Awaited<ReturnType<typeof orpc.customer.getCart.call>>;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showLoginModal } = useLoginRequired();
  const { data: session } = authClient.useSession();

  const isMounted = useRef(false);

  // Fetch cart from database on mount
  const refreshCart = useCallback(async () => {
    try {
      const cartData = await orpc.customer.getCart.call();
      if (isMounted.current) {
        setItems((cartData as CartData).items as CartItem[]);
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    } finally {
      if (isMounted.current) {
        setIsHydrated(true);
      }
    }
  }, []);

  // Handle session changes and fetch/clear cart accordingly
  useEffect(() => {
    isMounted.current = true;

    if (session) {
      // User is logged in - fetch cart
      refreshCart();
    } else {
      // User is logged out - clear cart immediately
      setItems([]);
      setIsHydrated(true);
    }

    return () => {
      isMounted.current = false;
    };
  }, [session, refreshCart]);

  const addItem = async (productId: number, quantity: number = 1) => {
    setIsLoading(true);
    try {
      const result = await orpc.customer.addToCart.call({
        productId,
        quantity,
      });
      await refreshCart();
      toast.success(result.message || "Item added to cart");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add item to cart";
      const msg = message.toLowerCase();
      if (msg.includes("login") || msg.includes("unauthorized")) {
        showLoginModal();
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (cartItemId: number) => {
    setIsLoading(true);
    try {
      await orpc.customer.removeFromCart.call({ cartItemId });
      await refreshCart();
      toast.success("Item removed from cart");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove item";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (cartItemId: number, quantity: number) => {
    setIsLoading(true);
    try {
      await orpc.customer.updateCartItem.call({ cartItemId, quantity });
      await refreshCart();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update cart";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async () => {
    setIsLoading(true);
    try {
      await orpc.customer.clearCart.call({});
      setItems([]);
      toast.success("Cart cleared");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to clear cart";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        refreshCart,
        totalItems,
        totalPrice,
        isHydrated,
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
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
