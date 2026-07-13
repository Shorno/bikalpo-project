"use client";

import { Eye, Package, ShoppingCart, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface WarehouseProductVariantOption {
  inventoryId: number;
  variantId: number;
  sku?: string | null;
  label: string;
  pricePerUnit: string;
  unit: string;
  availableQty: number;
  moq: number;
  weightKg?: number;
  innerPackSizeKg?: number;
  packType?: string;
}

export interface WarehouseProduct {
  id: number;
  name: string;
  brand: string;
  sku?: string | null;
  image: string;
  pricePerUnit: string;
  unit: string;
  moq: number;
  moqUnit: string;
  availableQty: number;
  availableUnit: string;
  rating: number;
  reviewCount: number;
  stockStatus: "high" | "medium" | "low";
  variants: WarehouseProductVariantOption[];
  selectedVariant?: WarehouseProductVariantOption;
}

interface WarehouseProductCardProps {
  product: WarehouseProduct;
  onViewDetails?: (product: WarehouseProduct) => void;
  onBuyNow?: (product: WarehouseProduct) => void;
  mode?: "default" | "w2w" | "view-only";
  cart?: any[];
  onAddToCart?: (product: WarehouseProduct) => void;
  onUpdateQuantity?: (variantId: number, delta: number) => void;
}

/**
 * Compact display label for a variant chip: drops words already present in the
 * product name (e.g. "Cylinder") and removes redundant duplicate tokens so
 * "45 KG Cylinder · 45" reads as "45 KG". Display-only — cart keys off variantId.
 */
export function shortVariantLabel(label: string, productName: string): string {
  const nameWords = new Set(
    productName.toLowerCase().split(/\s+/).filter(Boolean),
  );
  const parts = label
    .split("·")
    .map((part) =>
      part
        .trim()
        .split(/\s+/)
        .filter((word) => !nameWords.has(word.toLowerCase()))
        .join(" ")
        .trim(),
    )
    .filter(Boolean);
  const deduped = parts.filter(
    (part, i) =>
      !parts.some(
        (other, j) =>
          j !== i &&
          other.length > part.length &&
          other.toLowerCase().includes(part.toLowerCase()),
      ),
  );
  return deduped.join(" · ").trim() || label;
}

function getStockDot(status: "high" | "medium" | "low") {
  switch (status) {
    case "high":
      return "bg-emerald-500";
    case "medium":
      return "bg-amber-500";
    case "low":
      return "bg-red-500";
  }
}

export function WarehouseProductCard({
  product,
  onViewDetails,
  onBuyNow,
  mode = "default",
  cart = [],
  onAddToCart,
  onUpdateQuantity,
}: WarehouseProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.selectedVariant?.variantId ?? product.variants[0]?.variantId,
  );
  const selectedVariant =
    product.variants.find(
      (variant) => variant.variantId === selectedVariantId,
    ) ??
    product.selectedVariant ??
    product.variants[0];
  const displayProduct = selectedVariant
    ? {
        ...product,
        id: selectedVariant.inventoryId,
        sku: selectedVariant.sku,
        pricePerUnit: selectedVariant.pricePerUnit,
        unit: selectedVariant.unit,
        moq: selectedVariant.moq,
        moqUnit: selectedVariant.unit,
        availableQty: selectedVariant.availableQty,
        availableUnit: `${selectedVariant.unit} Available`,
        selectedVariant,
      }
    : product;

  const inCart = cart?.find(
    (i) => i.variantId === (displayProduct.selectedVariant?.variantId || displayProduct.id)
  );

  return (
    <div className="group flex flex-col bg-white rounded-xl border border-zinc-200 overflow-hidden hover:border-zinc-300 hover:shadow-sm transition-all duration-200">
      {/* Product Image */}
      <div className="relative aspect-[4/3] bg-zinc-50 border-b border-zinc-100 overflow-hidden shrink-0">
        {!imageError && product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
            onError={() => setImageError(true)}
            unoptimized={product.image.startsWith("http")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-50">
            <Package className="w-12 h-12 text-zinc-300" />
          </div>
        )}

        {/* Stock badge */}
        <div className="absolute top-2.5 right-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full ${getStockDot(product.stockStatus)}`}
            />
            {displayProduct.availableQty} in stock
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand + name */}
        <div>
          {product.brand && (
            <span className="block text-[11px] font-medium text-zinc-400">
              {product.brand}
            </span>
          )}
          <h3 className="mt-0.5 text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 min-h-[40px]">
            {product.name}
          </h3>
          {displayProduct.sku && (
            <span className="mt-1 block text-[11px] text-zinc-400">
              SKU {displayProduct.sku}
            </span>
          )}
        </div>

        {/* Variant selector */}
        {product.variants.length > 1 && (
          <div className="mt-3">
            <span className="mb-1.5 block text-[11px] font-medium text-zinc-400">
              Type
            </span>
            <div className="flex flex-wrap gap-1.5">
              {product.variants.map((variant) => {
                const active = variant.variantId === selectedVariantId;
                return (
                  <button
                    key={variant.variantId}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.variantId)}
                    className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    {shortVariantLabel(variant.label, product.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Price + MOQ */}
        <div className="mt-3 pt-3 border-t border-zinc-100 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[11px] text-zinc-400">Price</span>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-lg font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                ৳ {displayProduct.pricePerUnit}
              </span>
              <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                / {shortVariantLabel(displayProduct.unit, product.name)}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-[11px] text-zinc-400">Min. order</span>
            <span className="mt-0.5 block text-xs font-medium text-zinc-700 tabular-nums whitespace-nowrap">
              {displayProduct.moq}{" "}
              {shortVariantLabel(displayProduct.moqUnit, product.name)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4">
          {mode === "view-only" ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs font-medium border-zinc-200 text-zinc-400 gap-1.5 rounded-lg cursor-not-allowed"
                disabled
              >
                Access Required
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 gap-1.5 rounded-lg transition-colors"
                onClick={() => onViewDetails?.(displayProduct)}
              >
                <Eye className="w-3.5 h-3.5" />
                Details
              </Button>
            </div>
          ) : mode === "w2w" ? (
            <div className="flex items-center gap-2">
              {inCart ? (
                <div className="flex flex-1 items-center justify-between border border-zinc-200 rounded-lg h-9 bg-white px-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateQuantity?.(displayProduct.selectedVariant?.variantId || displayProduct.id, -1);
                    }}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                    {inCart.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateQuantity?.(displayProduct.selectedVariant?.variantId || displayProduct.id, 1);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="flex-1 h-9 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart?.(displayProduct);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Cart
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 gap-1.5 rounded-lg transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails?.(displayProduct);
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                Details
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-9 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white gap-1.5 rounded-lg transition-colors"
                onClick={() => onBuyNow?.(displayProduct)}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Buy Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 gap-1.5 rounded-lg transition-colors"
                onClick={() => onViewDetails?.(displayProduct)}
              >
                <Eye className="w-3.5 h-3.5" />
                Details
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WarehouseProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-white rounded-xl border border-zinc-200 overflow-hidden h-full">
      {/* Image Skeleton */}
      <div className="aspect-[4/3] bg-zinc-50 relative border-b border-zinc-100 overflow-hidden shrink-0">
        <Skeleton className="w-full h-full rounded-none" />
      </div>

      {/* Product Info */}
      <div className="flex flex-1 flex-col p-4">
        <div>
          <Skeleton className="h-3 w-14 mb-2" />
          <Skeleton className="h-4 w-5/6 mb-1.5" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Variant chips */}
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-7 w-14 rounded-md" />
          <Skeleton className="h-7 w-14 rounded-md" />
        </div>

        {/* Price + MOQ */}
        <div className="mt-3 pt-3 border-t border-zinc-100 flex items-end justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Skeleton className="flex-1 h-9 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
