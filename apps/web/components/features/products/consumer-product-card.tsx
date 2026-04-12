"use client";

import { Eye, Package, Star, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Consumer Product Card — standalone card for the public/consumer storefront.
 * Accepts a loose product shape to avoid type mismatches with various API responses.
 */

interface ConsumerProductCardProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: string | number;
    image: string;
    size?: string | null;
    inStock?: boolean;
    category?: { name?: string; slug?: string } | null;
    reviewStats?: { averageRating: number; totalReviews: number } | null;
    sellerCount?: number | null;
  };
}

export function ConsumerProductCard({ product }: ConsumerProductCardProps) {
  const [imageError, setImageError] = useState(false);

  const categorySlug = product.category?.slug ?? "all";
  const categoryName = product.category?.name;
  const productHref = `/products/${categorySlug}/${product.slug}`;
  const hasValidImage =
    product.image && !imageError && product.image.trim() !== "";

  const rawPrice = typeof product.price === "string" ? parseFloat(product.price) : Number(product.price);
  const price = isNaN(rawPrice) ? 0 : rawPrice;

  const rating = product.reviewStats?.averageRating ?? 0;
  const reviewCount = product.reviewStats?.totalReviews ?? 0;
  const sellerCount = product.sellerCount ?? 0;
  const hasRating = rating > 0 && reviewCount > 0;

  return (
    <Link
      href={productHref}
      className="group block"
      id={`consumer-product-${product.id}`}
    >
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-emerald-100/40 hover:border-emerald-200 hover:-translate-y-1 h-full flex flex-col">
        {/* Product Image */}
        <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          {hasValidImage ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
              onError={() => setImageError(true)}
              unoptimized={product.image?.startsWith("http")}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-300" />
            </div>
          )}

          {/* Out of Stock Overlay */}
          {product.inStock === false && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Badge variant="destructive" className="text-[10px] font-bold">
                OUT OF STOCK
              </Badge>
            </div>
          )}

          {/* Category Badge */}
          {categoryName && (
            <div className="absolute top-3 left-3">
              <Badge
                variant="secondary"
                className="bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] font-medium shadow-sm"
              >
                {categoryName}
              </Badge>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-3 sm:p-4 space-y-2 flex-1 flex flex-col">
          {/* Product Name */}
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-snug">
            {product.name}
          </h3>

          {/* Starting Price */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold text-gray-900">
              {price > 0
                ? `৳ ${price.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : "৳ —"}
            </span>
            {price > 0 && (
              <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium">
                Starting From
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1.5">
            {hasRating ? (
              <>
                <div className="flex items-center gap-0.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-gray-800">
                    {rating.toFixed(1)}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400">
                  ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span className="text-[11px] text-gray-400 italic">
                No ratings yet
              </span>
            )}
          </div>

          {/* Seller Count */}
          {sellerCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs text-gray-600">
                <span className="font-semibold text-gray-800">
                  {sellerCount}
                </span>
                {" "}{sellerCount === 1 ? "Seller" : "Sellers"} Available
              </span>
            </div>
          )}

          {/* View Details Button — always at the bottom */}
          <div className="pt-1 mt-auto">
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
