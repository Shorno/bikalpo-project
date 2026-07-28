"use client";

import { Loader2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-orpc-cart";
import { cn } from "@/lib/utils";
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
    totalItems,
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
        className="flex flex-col gap-0 bg-white p-0 data-[side=right]:w-full sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-200 px-5 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <ShoppingBag
              className={cn(
                "size-4.5 text-slate-700",
                isEmerald && "text-emerald-600",
              )}
              aria-hidden="true"
            />
            <span>Cart</span>
            {totalItems > 0 && (
              <span className="text-xs font-normal text-slate-500">
                ({totalItems} {totalItems === 1 ? "item" : "items"})
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review the products in your cart and continue to checkout.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!isHydrated ? (
            <div className="flex h-full min-h-48 items-center justify-center">
              <Loader2
                className={cn(
                  "size-5 animate-spin text-slate-400",
                  isEmerald && "text-emerald-500",
                )}
                aria-hidden="true"
              />
              <span className="sr-only">Loading cart</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <ShoppingBag
                  className={cn(
                    "size-5 text-slate-500",
                    isEmerald && "text-emerald-600",
                  )}
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">
                Your cart is empty
              </h3>
              <p className="mt-1 max-w-64 text-sm leading-5 text-slate-500">
                Add products to your cart to review quantities and continue to
                checkout.
              </p>
              <SheetClose asChild>
                <Button variant="outline" className="mt-5 h-10" asChild>
                  <Link href="/products">Continue shopping</Link>
                </Button>
              </SheetClose>
            </div>
          ) : (
            <ul aria-label="Cart items">
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
            </ul>
          )}
        </div>

        {isHydrated && items.length > 0 && (
          <footer className="border-t border-slate-200 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Subtotal</p>
                <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-slate-950">
                  {formatPrice(totalPrice)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:bg-red-50 hover:text-destructive"
                onClick={clearCart}
                disabled={isLoading}
              >
                Clear cart
              </Button>
            </div>

            <SheetClose asChild>
              <Button
                className={cn(
                  "mt-4 h-11 w-full text-sm font-semibold",
                  isEmerald && "bg-emerald-600 hover:bg-emerald-700",
                )}
                asChild
              >
                <Link href="/checkout" onClick={() => onOpenChange(false)}>
                  Checkout
                </Link>
              </Button>
            </SheetClose>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}
