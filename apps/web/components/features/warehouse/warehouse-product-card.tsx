"use client";

import { Eye, Package, ShoppingCart, Star } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
      return "text-emerald-600 bg-emerald-50";
    case "medium":
      return "text-amber-600 bg-amber-50";
    case "low":
      return "text-red-600 bg-red-50";
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
    <div className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300">
      {/* Product Image */}
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {!imageError && product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
            unoptimized={product.image.startsWith("http")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package className="w-14 h-14 text-gray-300" />
          </div>
        )}

        {/* Stock badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStockColor(product.stockStatus)}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${getStockDot(product.stockStatus)}`}
            />
            {product.availableQty} {product.availableUnit}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3.5">
        {/* Name & Brand */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mb-0.5">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500 mb-2">{product.brand}</p>

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-1.5">
          <span className="text-base font-bold text-gray-900">
            ৳ {product.pricePerUnit}
          </span>
          <span className="text-xs text-gray-500">/ {product.unit}</span>
        </div>

        {/* MOQ */}
        <p className="text-xs text-gray-600 mb-2">
          MOQ:{" "}
          <span className="font-medium">
            {product.moq} {product.moqUnit}
          </span>
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="text-xs font-medium text-gray-700">
            {product.rating}
          </span>
          <span className="text-xs text-gray-400">
            ({product.reviewCount} reviews)
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white gap-1"
            onClick={() => onBuyNow?.(product)}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Buy Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs font-medium border-gray-200 text-gray-700 hover:bg-gray-50 gap-1"
            onClick={() => onViewDetails?.(product)}
          >
            <Eye className="w-3.5 h-3.5" />
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}
