"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CartItem as CartItemType } from "@/hooks/use-cart";

interface CartItemProps {
  item: CartItemType;
  onQuantityChange: (id: number, quantity: number) => void;
  onRemove: (id: number) => void;
  onLinkClick?: () => void;
  isLoading?: boolean;
}

export function CartItem({
  item,
  onQuantityChange,
  onRemove,
  onLinkClick,
  isLoading = false,
}: CartItemProps) {
  const formatPrice = (price: number) => {
    return `৳${price.toLocaleString("en-BD")}`;
  };

  // Product link format: /products/{categorySlug}/{productSlug}
  const productLink = `/products/${item.categorySlug}/${item.slug}`;

  return (
    <div className="flex items-center gap-4 p-4 border-b rounded-xs shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Product Image */}
      <div className="flex-shrink-0 relative">
        <Link
          href={productLink}
          className="relative overflow-hidden rounded-lg border-2 block"
          onClick={onLinkClick}
        >
          <Image
            src={item.image || "/placeholder.svg"}
            alt={item.name}
            width={80}
            height={80}
            className="w-20 h-20 object-cover"
          />
        </Link>
        {item.quantity > 1 && (
          <Badge
            variant="secondary"
            className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center p-0 text-xs font-bold rounded-full border-2"
          >
            {item.quantity}
          </Badge>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0 space-y-2">
        <Link href={productLink} onClick={onLinkClick}>
          <h3 className="text-sm font-semibold line-clamp-2">
            {item.name}{" "}
            <span className="text-muted-foreground font-normal">
              ({item.size})
            </span>
          </h3>
        </Link>

        <div className="flex items-center gap-3">
          {/* Quantity Controls */}
          <div className="flex items-center border rounded-lg bg-muted/50">
            <Button
              onClick={() => onQuantityChange(item.id, item.quantity - 1)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-l-lg rounded-r-none"
              disabled={item.quantity <= 1 || isLoading}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center justify-center min-w-[40px] h-8 px-2 text-sm font-medium bg-background border-x">
              {item.quantity}
            </div>

            <Button
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-r-lg rounded-l-none"
              disabled={isLoading}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Remove Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => onRemove(item.id)}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right">
        <p className="text-base font-bold">
          {formatPrice(item.price * item.quantity)}
        </p>
      </div>
    </div>
  );
}
