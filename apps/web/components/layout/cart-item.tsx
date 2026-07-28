"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CartItem as CartItemType } from "@/hooks/use-orpc-cart";
import { getCartItemProductHref } from "@/lib/retailer-storefront-url";
import { CartRetailerLabel } from "./cart-retailer-label";

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

  const productLink = getCartItemProductHref({
    shopSlug: item.shopSlug,
    productSlug: item.slug,
    categorySlug: item.categorySlug,
  });
  const variantLabel = item.size?.trim();
  const generatedVariantSuffix = variantLabel ? ` — ${variantLabel}` : "";
  const productName =
    generatedVariantSuffix && item.name.endsWith(generatedVariantSuffix)
      ? item.name.slice(0, -generatedVariantSuffix.length)
      : item.name;

  return (
    <li className="border-b border-slate-200 px-4 py-4 last:border-b-0 sm:px-5">
      <div className="flex items-start gap-3">
        <Link
          href={productLink}
          className="relative block size-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          onClick={onLinkClick}
        >
          <Image
            src={item.image || "/placeholder-image.svg"}
            alt={productName}
            width={64}
            height={64}
            className="size-full object-contain p-1.5"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={productLink}
              className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={onLinkClick}
            >
              <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950 hover:text-primary">
                {productName}
              </h3>
            </Link>
            <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-slate-950">
              {formatPrice(item.price * item.quantity)}
            </p>
          </div>

          {variantLabel && (
            <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-slate-600">
              {variantLabel}
            </p>
          )}
          <CartRetailerLabel
            shopName={item.shopName}
            className="mt-0.5 text-[11px] font-normal text-slate-500"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <div
              className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white"
              role="group"
              aria-label={`Quantity for ${productName}`}
            >
              <Button
                type="button"
                onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                variant="ghost"
                size="icon"
                className="size-10 rounded-none text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                disabled={item.quantity <= 1 || isLoading}
                aria-label={`Decrease ${productName} quantity`}
              >
                <Minus className="size-3.5" aria-hidden="true" />
              </Button>

              <span
                className="flex h-full min-w-10 items-center justify-center border-x border-slate-200 px-2 font-mono text-sm font-medium tabular-nums text-slate-950"
                aria-live="polite"
              >
                {item.quantity}
              </span>

              <Button
                type="button"
                onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                variant="ghost"
                size="icon"
                className="size-10 rounded-none text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                disabled={isLoading}
                aria-label={`Increase ${productName} quantity`}
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-slate-500 hover:bg-red-50 hover:text-destructive"
              onClick={() => onRemove(item.id)}
              disabled={isLoading}
              aria-label={`Remove ${productName} from cart`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
