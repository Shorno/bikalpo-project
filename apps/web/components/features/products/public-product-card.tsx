"use client";

import type { ProductWithRelations } from "@bikalpo-project/db/schema";
import { Eye, Package, Star, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface PublicProductCardProps {
  product: ProductWithRelations & {
    reviewStats?: { averageRating: number; totalReviews: number };
    sellerCount?: number;
  };
}

export function PublicProductCard({ product }: PublicProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const productHref = `/products/${product.category.slug}/${product.slug}`;
  const hasValidImage =
    product.image && !imageError && product.image.trim() !== "";

  const rating = product.reviewStats?.averageRating ?? 0;
  const reviewCount = product.reviewStats?.totalReviews ?? 0;
  const sellerCount = product.sellerCount ?? 0;
  const hasRating = rating > 0 && reviewCount > 0;
  const price = typeof product.price === "string" ? parseFloat(product.price) : product.price;

  return (
    <Link href={productHref} className="group block" id={`product-card-${product.id}`}>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/40 hover:border-emerald-200 hover:-translate-y-1">
        {/* Product Image */}
        <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          {hasValidImage ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImageError(true)}
              unoptimized={product.image.startsWith("http")}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-300" />
            </div>
          )}

          {/* Category Badge */}
          <div className="absolute top-3 left-3">
            <Badge
              variant="secondary"
              className="bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] font-medium shadow-sm"
            >
              {product.category.name}
            </Badge>
          </div>
        </div>

        {/* Product Info */}
        <div className="p-4 space-y-2.5">
          {/* Product Name (Core Identity) */}
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-snug">
            {product.name}
          </h3>

          {/* Starting Price */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-gray-900">
              ৳ {price.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">Starting From</span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1.5">
            {hasRating ? (
              <>
                <div className="flex items-center gap-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-gray-800">{rating.toFixed(1)}</span>
                </div>
                <span className="text-[11px] text-gray-400">
                  ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span className="text-[11px] text-gray-400 italic">No ratings yet</span>
            )}
          </div>

          {/* Seller Count */}
          {sellerCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs text-gray-600">
                <span className="font-semibold text-gray-800">{sellerCount}</span>
                {" "}{sellerCount === 1 ? "Seller" : "Sellers"} Available
              </span>
            </div>
          )}

          {/* View Details Button */}
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 w-full justify-center py-2 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold transition-all duration-200 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-md">
              <Eye className="w-3.5 h-3.5" />
              View Details
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
