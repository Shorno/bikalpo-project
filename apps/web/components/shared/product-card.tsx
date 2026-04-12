"use client";

import { Eye, Package, Star, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: string | number | null;
    originalPrice?: string | number | null;
    image: string | null;
    inStock: boolean;
    size?: string | null;
    discountPercent?: number;
    category?: { slug: string; name?: string } | null;
    reviewStats?: { averageRating: number; totalReviews: number };
    sellerCount?: number;
  };
  href?: string;
  showDeliveryTime?: boolean;
  onAddToCart?: (productId: number) => void;
  isLoading?: boolean;
}

export function ProductCard({
  product,
  href,
}: ProductCardProps) {
  const productUrl =
    href || `/products/${product.category?.slug ?? "all"}/${product.slug}`;

  const price = Number(product.price || 0);
  const rating = product.reviewStats?.averageRating ?? 0;
  const reviewCount = product.reviewStats?.totalReviews ?? 0;
  const sellerCount = product.sellerCount ?? 0;
  const hasRating = rating > 0 && reviewCount > 0;

  return (
    <Link href={productUrl} className="group block">
      <Card className="overflow-hidden border border-gray-100 hover:shadow-xl hover:shadow-emerald-100/40 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300 rounded-xl h-full p-0 gap-0">
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Package className="w-12 h-12 text-gray-300" />
            </div>
          )}
          {!product.inStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Badge variant="destructive" className="text-[10px] font-bold">
                OUT OF STOCK
              </Badge>
            </div>
          )}
          {product.discountPercent && product.discountPercent > 0 && (
            <Badge className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
              {product.discountPercent}% OFF
            </Badge>
          )}
          {/* Category Badge */}
          {product.category?.name && (
            <div className="absolute top-2 right-2">
              <Badge
                variant="secondary"
                className="bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] font-medium shadow-sm"
              >
                {product.category.name}
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-3 space-y-2">
          {/* Product Name */}
          <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-emerald-600 transition-colors">
            {product.name}
          </h3>

          {/* Starting Price */}
          <div className="flex items-baseline gap-1">
            {product.originalPrice && (
              <span className="text-[10px] text-gray-400 line-through">
                ৳{Number(product.originalPrice).toLocaleString("en-BD")}
              </span>
            )}
            <span className="text-base font-bold text-gray-900">
              ৳{price > 0 ? price.toLocaleString("en-BD") : "—"}
            </span>
            {price > 0 && (
              <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                Starting From
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1">
            {hasRating ? (
              <>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-semibold text-gray-800">
                  {rating.toFixed(1)}
                </span>
                <span className="text-[10px] text-gray-400">
                  ({reviewCount})
                </span>
              </>
            ) : (
              <span className="text-[10px] text-gray-400 italic">
                No ratings yet
              </span>
            )}
          </div>

          {/* Seller Count */}
          {sellerCount > 0 && (
            <div className="flex items-center gap-1">
              <Store className="w-3 h-3 text-blue-500" />
              <span className="text-[11px] text-gray-600">
                <span className="font-semibold text-gray-800">
                  {sellerCount}
                </span>{" "}
                {sellerCount === 1 ? "Seller" : "Sellers"}
              </span>
            </div>
          )}

          {/* View Details Button */}
          <span className="inline-flex items-center gap-1.5 w-full justify-center py-1.5 px-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold transition-all duration-200 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-md mt-1">
            <Eye className="w-3 h-3" />
            View Details
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
