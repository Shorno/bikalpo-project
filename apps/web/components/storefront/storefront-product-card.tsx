"use client";

import { Eye, Minus, Package, Plus, ShoppingCart, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  type CylinderSaleMode,
  CylinderTypeRadios,
  shortVariantLabel,
} from "@/components/features/products/cylinder-type-radios";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CartItem } from "@/hooks/use-orpc-cart";
import { getRetailerProductHref } from "@/lib/retailer-storefront-url";
import { cn } from "@/lib/utils";

export interface StorefrontProduct {
  id: number;
  name: string;
  slug: string;
  image: string;
  images: Array<{ imageUrl: string }>;
  category: { name: string; slug: string } | null;
  subCategory: { name: string; slug: string } | null;
  lowestRetailPrice?: number;
  lowestDisplayPrice?: number;
  variantCount: number;
  totalAvailableQty: number;
  averageRating?: number;
  totalReviews?: number;
  soldOrderCount?: number;
  variants: Array<{
    variantId: number;
    sku: string | null;
    unitLabel: string | null;
    quantitySelectorLabel: string | null;
    basePrice?: string | null;
    retailPrice?: string;
    displayPrice?: string;
    availableQty?: string;
    sortOrder?: number;
    exchangeEnabled?: boolean;
    exchangeCreditAmount?: string | number;
    canExchange?: boolean;
  }>;
}

export interface StorefrontAddSelection {
  variantId: number;
  cylinderSaleMode: CylinderSaleMode;
}

interface ProductCardProps {
  product: StorefrontProduct;
  shopSlug?: string;
  shopId?: string | null;
  previewMode?: boolean;
  isAdding?: boolean;
  cartItems?: CartItem[];
  pendingCartItemIds?: ReadonlySet<number>;
  onQuickAdd?: (
    product: StorefrontProduct,
    selection: StorefrontAddSelection,
  ) => void;
  onUpdateQuantity?: (cartItemId: number, quantity: number) => Promise<void>;
  mode?: "storefront" | "reference";
  detailHref?: string;
}

export function StorefrontProductCard({
  product,
  shopSlug = "",
  shopId,
  previewMode = false,
  isAdding = false,
  cartItems = [],
  pendingCartItemIds,
  onQuickAdd,
  onUpdateQuantity,
  mode = "storefront",
  detailHref: detailHrefOverride,
}: ProductCardProps) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.variantId,
  );
  const [cylinderSaleMode, setCylinderSaleMode] =
    useState<CylinderSaleMode>("exchange");
  const selectedVariant =
    product.variants.find(
      (variant) => variant.variantId === selectedVariantId,
    ) ?? product.variants[0];
  const listingCanExchange = Boolean(
    selectedVariant?.canExchange ?? selectedVariant?.exchangeEnabled,
  );
  const effectiveCylinderSaleMode: CylinderSaleMode = listingCanExchange
    ? cylinderSaleMode
    : "new";
  const image = product.images?.[0]?.imageUrl || product.image;
  const detailHref =
    detailHrefOverride ??
    getRetailerProductHref({
      shopSlug,
      productSlug: product.slug,
      previewMode,
    });
  const shouldHideCategoryContext = [
    product.category?.name,
    product.category?.slug,
    product.subCategory?.name,
    product.subCategory?.slug,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const normalized = value.toLowerCase().replace(/[_-]+/g, " ").trim();
      return normalized === "lpg" || normalized === "industrial lpg";
    });
  const categoryContext = [product.category?.name, product.subCategory?.name]
    .filter(Boolean)
    .join(" / ");
  const unitLabel = selectedVariant?.unitLabel;
  const selectedPrice = Number(
    selectedVariant?.displayPrice ??
      selectedVariant?.retailPrice ??
      product.lowestDisplayPrice ??
      product.lowestRetailPrice ??
      0,
  );
  const selectedAvailableQty = Number(
    selectedVariant?.availableQty ?? product.totalAvailableQty,
  );
  const cartItem =
    mode === "storefront" && shopId && selectedVariant
      ? cartItems.find(
          (item) =>
            item.productId === product.id &&
            item.variantId === selectedVariant.variantId &&
            item.shopId === shopId &&
            (item.cylinderSale?.mode ?? "new") === effectiveCylinderSaleMode,
        )
      : undefined;
  const isUpdating = cartItem
    ? pendingCartItemIds?.has(cartItem.id) === true
    : false;
  const totalReviews = product.totalReviews ?? 0;
  const soldOrderCount = product.soldOrderCount ?? 0;
  const averageRating = product.averageRating ?? 0;
  const showRatings = totalReviews > 0;
  const showSold = soldOrderCount > 0;

  const handleSizeChange = (variantId: number) => {
    const nextVariant = product.variants.find(
      (variant) => variant.variantId === variantId,
    );
    setSelectedVariantId(variantId);
    setCylinderSaleMode(
      nextVariant?.canExchange || nextVariant?.exchangeEnabled
        ? "exchange"
        : "new",
    );
  };

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white transition-colors hover:border-slate-400 focus-within:border-primary">
      <Link href={detailHref} className="block border-b bg-slate-50">
        <div className="relative aspect-[4/3] overflow-hidden p-4 sm:p-5">
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              sizes="(max-width: 430px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Package className="size-10 text-slate-300" aria-hidden="true" />
              <span className="sr-only">No product image available</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {!shouldHideCategoryContext && (
          <p className="min-h-4 truncate text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
            {categoryContext || "Retail product"}
          </p>
        )}
        <Link
          href={detailHref}
          className={cn(
            "focus-visible:outline-none",
            shouldHideCategoryContext ? "mt-0" : "mt-1.5",
          )}
        >
          <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-950 transition-colors hover:text-slate-600 group-focus-within:text-slate-600">
            {product.name}
          </h2>
        </Link>

        {(showRatings || showSold) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            {showRatings && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-slate-500 text-slate-500" />
                <span className="font-mono font-medium tabular-nums text-slate-700">
                  {averageRating.toFixed(1)}
                </span>
                <span className="font-mono tabular-nums text-slate-400">
                  ({totalReviews.toLocaleString("en-BD")})
                </span>
              </span>
            )}
            {showSold && (
              <span className="font-mono tabular-nums">
                Sold {soldOrderCount.toLocaleString("en-BD")}{" "}
                {soldOrderCount === 1 ? "order" : "orders"}
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <p className="font-mono text-lg font-semibold tabular-nums text-slate-950">
            ৳{selectedPrice.toLocaleString("en-BD")}
            {unitLabel ? (
              <span className="ml-1 font-sans text-xs font-normal text-slate-500">
                / {shortVariantLabel(unitLabel, product.name)}
              </span>
            ) : null}
          </p>
        </div>

        {product.variants.length > 1 && (
          <div className="mt-3">
            <span
              className="mb-1.5 block text-[11px] font-medium text-slate-400"
              id={`product-${product.id}-size-label`}
            >
              Size
            </span>
            <RadioGroup
              aria-labelledby={`product-${product.id}-size-label`}
              className="flex w-auto flex-wrap gap-x-4 gap-y-2"
              onValueChange={(variantId) => handleSizeChange(Number(variantId))}
              value={String(selectedVariant?.variantId ?? "")}
            >
              {product.variants.map((variant) => {
                const label =
                  variant.quantitySelectorLabel ||
                  variant.unitLabel ||
                  variant.sku ||
                  `Size ${variant.variantId}`;
                const optionId = `product-${product.id}-size-${variant.variantId}`;
                return (
                  <label
                    className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"
                    htmlFor={optionId}
                    key={variant.variantId}
                  >
                    <RadioGroupItem
                      id={optionId}
                      value={String(variant.variantId)}
                    />
                    <span>{shortVariantLabel(label, product.name)}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>
        )}

        {listingCanExchange && (
          <div className="mt-3">
            <CylinderTypeRadios
              appearance="radio"
              value={effectiveCylinderSaleMode}
              onChange={setCylinderSaleMode}
            />
          </div>
        )}

        {mode === "storefront" ? (
          <p className="mt-3 text-xs text-slate-500">
            Available{" "}
            <span className="font-mono tabular-nums text-slate-700">
              {selectedAvailableQty.toLocaleString("en-BD")}
            </span>
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-4">
          {mode === "reference" ? (
            <Button asChild className="h-9 flex-1 text-xs">
              <Link href={detailHref}>
                <Eye className="size-3.5" aria-hidden="true" />
                View details
              </Link>
            </Button>
          ) : previewMode ? (
            <Button
              type="button"
              className="h-9 flex-1 text-xs"
              disabled
              aria-label="Add to cart unavailable in preview"
            >
              <ShoppingCart className="size-3.5" aria-hidden="true" />
              Add to cart
            </Button>
          ) : cartItem && onUpdateQuantity ? (
            <div
              className="flex h-9 flex-1 items-center justify-between rounded-md border border-slate-200 bg-white px-1"
              role="group"
              aria-label={`Quantity for ${product.name}`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                onClick={() =>
                  void onUpdateQuantity(cartItem.id, cartItem.quantity - 1)
                }
                disabled={isUpdating}
                aria-label={`Decrease ${product.name} quantity`}
              >
                <Minus className="size-3.5" aria-hidden="true" />
              </Button>
              <span
                className="min-w-8 text-center font-mono text-sm font-semibold tabular-nums text-slate-950"
                aria-live="polite"
              >
                {cartItem.quantity}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                onClick={() =>
                  void onUpdateQuantity(cartItem.id, cartItem.quantity + 1)
                }
                disabled={
                  isUpdating || cartItem.quantity >= selectedAvailableQty
                }
                aria-label={`Increase ${product.name} quantity`}
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              className="h-9 flex-1 text-xs"
              disabled={
                isAdding ||
                !selectedVariant ||
                selectedAvailableQty <= 0 ||
                !onQuickAdd
              }
              onClick={() => {
                if (!selectedVariant || !onQuickAdd) return;
                onQuickAdd(product, {
                  variantId: selectedVariant.variantId,
                  cylinderSaleMode: effectiveCylinderSaleMode,
                });
              }}
              aria-label={`Add ${product.name} to cart`}
            >
              <ShoppingCart className="size-3.5" aria-hidden="true" />
              {isAdding ? "Adding…" : "Add to cart"}
            </Button>
          )}
          {mode === "storefront" ? (
            <Button asChild variant="outline" className="h-9 px-3 text-xs">
              <Link href={detailHref}>
                <Eye className="size-3.5" aria-hidden="true" />
                Details
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
