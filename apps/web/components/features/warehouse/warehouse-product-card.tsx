"use client";

import { Eye, Package, ShoppingCart, Star } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";


export interface WarehouseProduct {
  id: number;
  name: string;
  brand: string;
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
}

interface WarehouseProductCardProps {
  product: WarehouseProduct;
  onViewDetails?: (product: WarehouseProduct) => void;
  onBuyNow?: (product: WarehouseProduct) => void;
}

function getStockColor(status: "high" | "medium" | "low") {
  switch (status) {
    case "high":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "medium":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "low":
      return "text-red-700 bg-red-50 border-red-200";
  }
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

export function WarehouseProductCard({ product, onViewDetails, onBuyNow }: WarehouseProductCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="group bg-white rounded-lg border border-zinc-200 overflow-hidden hover:border-zinc-400 transition-colors duration-200 flex flex-col shadow-none">
      {/* Product Image */}
      <div className="relative aspect-[16/11] bg-zinc-50 border-b border-zinc-100 overflow-hidden flex-shrink-0">
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
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-mono tracking-wider uppercase font-bold shadow-none ${getStockColor(product.stockStatus)}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${getStockDot(product.stockStatus)}`}
            />
            {product.availableQty} {product.unit}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          {/* Name & Brand */}
          <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest block mb-1">
            {product.brand || "Product"}
          </span>
          <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug min-h-[40px] hover:text-zinc-700 transition-colors">
            {product.name}
          </h3>
        </div>

        <div>
          {/* Data spec grid */}
          <div className="space-y-2 mt-4 pt-2.5 border-t border-zinc-100">
            <div className="flex justify-between items-center text-[10px] text-zinc-500">
              <span>Min. Order Qty</span>
              <span className="font-mono text-zinc-700 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/50">
                {product.moq} {product.moqUnit}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-1.5 mb-3.5">
              <span className="text-xs font-semibold text-zinc-400">Price</span>
              <div className="flex items-baseline gap-0.5">
                <span className="font-mono font-bold text-base text-zinc-900 tabular-nums">
                  ৳ {product.pricePerUnit}
                </span>
                <span className="text-[10px] text-zinc-500">/{product.unit}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white gap-1 rounded transition-colors"
              onClick={() => onBuyNow?.(product)}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Buy Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs font-semibold border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 gap-1 rounded transition-colors"
              onClick={() => onViewDetails?.(product)}
            >
              <Eye className="w-3.5 h-3.5" />
              Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WarehouseProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden flex flex-col h-full">
      {/* Image Skeleton */}
      <div className="aspect-[16/11] bg-zinc-50 relative border-b border-zinc-100 overflow-hidden flex-shrink-0">
        <Skeleton className="w-full h-full rounded-none" />
      </div>

      {/* Product Info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-4 w-5/6 mb-1.5" />
          <Skeleton className="h-4 w-2/3 mb-1" />
        </div>

        <div>
          {/* Data spec grid */}
          <div className="space-y-2 mt-4 pt-2.5 border-t border-zinc-100">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex justify-between items-baseline pt-1.5 mb-3.5">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Skeleton className="flex-1 h-8 rounded" />
            <Skeleton className="flex-1 h-8 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

