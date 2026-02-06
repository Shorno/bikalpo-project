"use client";

import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { CartDrawer } from "./cart-drawer";

interface CartButtonProps {
  variant?: "default" | "emerald";
}

export function CartButton({ variant = "default" }: CartButtonProps) {
  const { totalItems, isHydrated } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const isEmerald = variant === "emerald";

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
