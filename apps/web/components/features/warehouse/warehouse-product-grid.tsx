"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, ShoppingCart, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WarehouseProductCard,
  type WarehouseProduct,
} from "./warehouse-product-card";

const mockProducts: WarehouseProduct[] = [
  {
    id: 1,
    name: "Miniket Rice (Premium)",
    brand: "IFAD Agro",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop",
    pricePerUnit: "2,450",
    unit: "Carton",
    moq: 1,
    moqUnit: "Carton",
    availableQty: 240,
    availableUnit: "Carton Available",
    rating: 4.5,
    reviewCount: 210,
    stockStatus: "high",
  },
  {
    id: 2,
    name: "Cotton T-Shirt (Round Neck)",
    brand: "Texstyle BD",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=300&fit=crop",
    pricePerUnit: "1,850",
    unit: "Carton",
    moq: 1,
    moqUnit: "Carton",
    availableQty: 60,
    availableUnit: "Carton Available",
    rating: 4.3,
    reviewCount: 85,
    stockStatus: "medium",
  },
  {
    id: 3,
    name: "Casual Sneakers (Unisex)",
    brand: "Apex Footwear",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop",
    pricePerUnit: "3,200",
    unit: "Carton",
    moq: 1,
    moqUnit: "Carton",
    availableQty: 35,
    availableUnit: "Carton Available",
    rating: 4.5,
    reviewCount: 120,
    stockStatus: "medium",
  },
  {
    id: 4,
    name: "Smartphone Device (4G)",
    brand: "Symphony Ltd",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop",
    pricePerUnit: "8,500",
    unit: "Box",
    moq: 1,
    moqUnit: "Box",
    availableQty: 20,
    availableUnit: "Box Available",
    rating: 4.7,
    reviewCount: 95,
    stockStatus: "low",
  },
  {
    id: 5,
    name: "LPG Cylinder (12.5kg)",
    brand: "Omera Gas",
    image: "https://images.unsplash.com/photo-1585011664466-b7bbe92f34ef?w=400&h=300&fit=crop",
    pricePerUnit: "1,350",
    unit: "Unit",
    moq: 1,
    moqUnit: "Unit",
    availableQty: 120,
    availableUnit: "Unit Available",
    rating: 4.6,
    reviewCount: 210,
    stockStatus: "high",
  },
  {
    id: 6,
    name: "Soybean Oil (Drum 18L)",
    brand: "Teer Refined",
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=300&fit=crop",
    pricePerUnit: "3,800",
    unit: "Drum",
    moq: 1,
    moqUnit: "Drum",
    availableQty: 80,
    availableUnit: "Drum Available",
    rating: 4.5,
    reviewCount: 90,
    stockStatus: "high",
  },
];

function getStockLabel(status: "high" | "medium" | "low") {
  switch (status) {
    case "high":
      return { text: "In Stock", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
    case "medium":
      return { text: "Limited Stock", color: "text-amber-600 bg-amber-50 border-amber-200" };
    case "low":
      return { text: "Low Stock", color: "text-red-600 bg-red-50 border-red-200" };
  }
}

function ProductDetailModal({
  product,
  onClose,
}: {
  product: WarehouseProduct;
  onClose: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const stock = getStockLabel(product.stockStatus);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 border border-gray-200 transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {/* Image */}
        <div className="relative aspect-[16/9] bg-gray-50 rounded-t-2xl overflow-hidden">
          {!imageError && product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              unoptimized={product.image.startsWith("http")}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <Package className="w-20 h-20 text-gray-300" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 md:p-6">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {product.name}
            </h2>
            <p className="text-sm text-gray-500">{product.brand}</p>
          </div>

          {/* Price & Stock */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="text-2xl font-bold text-gray-900">
                ৳ {product.pricePerUnit}
              </span>
              <span className="text-sm text-gray-500 ml-1">
                / {product.unit}
              </span>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${stock.color}`}
            >
              {stock.text}
            </span>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">
                Minimum Order Qty
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {product.moq} {product.moqUnit}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Available</p>
              <p className="text-sm font-semibold text-gray-900">
                {product.availableQty} {product.availableUnit.replace(" Available", "")}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Unit Price</p>
              <p className="text-sm font-semibold text-gray-900">
                ৳ {product.pricePerUnit} / {product.unit}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Rating</p>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-semibold text-gray-900">
                  {product.rating}
                </span>
                <span className="text-xs text-gray-400">
                  ({product.reviewCount})
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </Button>
            <Button
              variant="outline"
              className="h-11 px-6 border-gray-200 font-medium"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface WarehouseProductGridProps {
  products?: WarehouseProduct[];
}

export function WarehouseProductGrid({
  products = mockProducts,
}: WarehouseProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<WarehouseProduct | null>(null);

  return (
    <>
      <section className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Products
          </h2>
          <span className="text-sm text-gray-500">
            {products.length} items available
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {products.map((product) => (
            <WarehouseProductCard
              key={product.id}
              product={product}
              onViewDetails={setSelectedProduct}
            />
          ))}
        </div>
      </section>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
