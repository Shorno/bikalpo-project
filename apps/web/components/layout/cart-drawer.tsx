"use client";

import { Loader2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { CartItem } from "./cart-item";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "default" | "emerald";
}

export function CartDrawer({
  open,
  onOpenChange,
  variant = "default",
}: CartDrawerProps) {
  const {
    items,
    removeItem,
    updateQuantity,
    totalPrice,
    clearCart,
    isLoading,
    isHydrated,
  } = useCart();

  const isEmerald = variant === "emerald";

  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString("en-BD")}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-2xl font-serif flex items-center gap-2">
              <ShoppingBag
                className={`h-5 w-5 ${isEmerald ? "text-emerald-600" : ""}`}
              />
              Cart
              {items.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({items.length} {items.length === 1 ? "item" : "items"})
                </span>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto">
          {!isHydrated ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className={`h-8 w-8 animate-spin ${isEmerald ? "text-emerald-500" : "text-gray-400"}`}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${isEmerald ? "bg-emerald-50" : "bg-gray-100"}`}
              >
                <ShoppingBag
                  className={`w-12 h-12 ${isEmerald ? "text-emerald-400" : "text-gray-400"}`}
                />
              </div>
              <h3 className="text-xl font-medium mb-6">Your cart is empty</h3>
              <SheetClose asChild>
                <Button
                  className={`px-8 rounded-full ${isEmerald ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                  asChild
                >
                  <Link href="/products">CONTINUE SHOPPING</Link>
                </Button>
              </SheetClose>
            </div>
          ) : (
            <div className="overflow-auto">
              {items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onQuantityChange={updateQuantity}
                  onRemove={removeItem}
                  onLinkClick={() => onOpenChange(false)}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {isHydrated && items.length > 0 && (
          <div className="border-t px-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-lg">
                <span className="font-medium">SUBTOTAL</span>
                <span className="font-bold">{formatPrice(totalPrice)}</span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 py-6 rounded-full text-base"
                  onClick={clearCart}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "CLEAR CART"
                  )}
                </Button>

                <SheetClose asChild>
                  <Button
                    className={`flex-1 py-6 rounded-full text-base ${isEmerald ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                    asChild
                  >
                    <Link
                      href={"/checkout"}
                      onClick={() => onOpenChange(false)}
                    >
                      CHECKOUT
                    </Link>
                  </Button>
                </SheetClose>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
