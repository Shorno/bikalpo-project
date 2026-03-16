"use client";

import { ShoppingCart } from "lucide-react";
import { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { CartContext } from "@/hooks/use-orpc-cart";
import { CartDrawer } from "./cart-drawer";

interface CartButtonProps {
  variant?: "default" | "emerald";
}

export function CartButton({ variant = "default" }: CartButtonProps) {
  const context = useContext(CartContext);
  const [isOpen, setIsOpen] = useState(false);
  const isEmerald = variant === "emerald";

  // If context is not available, render a placeholder
  if (!context) {
    return (
      <Button
        variant="ghost"
        className={`relative ${isEmerald ? "text-emerald-950 hover:bg-emerald-50 hover:text-emerald-700" : ""}`}
        disabled
      >
        <ShoppingCart className="size-5" />
        Cart
        <span className="sr-only">Shopping Cart</span>
      </Button>
    );
  }

  const { totalItems, isHydrated } = context;

  return (
    <>
      <Button
        variant="ghost"
        className={`relative ${isEmerald ? "text-emerald-950 hover:bg-emerald-50 hover:text-emerald-700" : ""}`}
        onClick={() => setIsOpen(true)}
      >
        <ShoppingCart className="size-5" />
        {isHydrated && totalItems > 0 && (
          <span
            className={`absolute -top-1 -right-1 h-5 w-5 rounded-full ${isEmerald ? "bg-emerald-600" : "bg-blue-600"} text-[11px] font-medium text-white flex items-center justify-center`}
          >
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        )}
        Cart
        <span className="sr-only">Shopping Cart</span>
      </Button>
      <CartDrawer open={isOpen} onOpenChange={setIsOpen} variant={variant} />
    </>
  );
}
