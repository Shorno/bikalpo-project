"use client";

import { ArrowRight, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProductWithRelations } from "@/db/schema";

interface PublicProductCardProps {
  product: ProductWithRelations;
}

export function PublicProductCard({ product }: PublicProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const productHref = `/products/${product.category.slug}/${product.slug}`;
  const hasValidImage =
    product.image && !imageError && product.image.trim() !== "";

  return (
    <Link href={productHref} className="group block">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-gray-100/50 hover:border-gray-200 hover:-translate-y-0.5">
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
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {product.name}
          </h3>

          {product.size && (
            <p className="text-xs text-gray-500 mb-3">{product.size}</p>
          )}

          {/* View Details Link */}
          <div className="flex items-center text-xs font-medium text-blue-600 group-hover:text-blue-700">
            View Details
            <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}
