"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, ShoppingCart, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WarehouseProductCard,
  type WarehouseProduct,
} from "./warehouse-product-card";
import { WarehouseOrderDialog } from "./warehouse-order-dialog";

/** Map API storefront product to the card-compatible shape */
function mapApiProduct(item: any): WarehouseProduct {
  const variant = item.variant;
  const product = item.product || variant?.product;
  const image = product?.images?.[0]?.imageUrl || product?.images?.[0]?.url || product?.image || "";
  const unitLabel = variant?.unitLabel || variant?.packType || "Unit";
  const qty = Number(item.availableQty) || 0;

  let stockStatus: "high" | "medium" | "low" = "high";
  if (qty <= 10) stockStatus = "low";
  else if (qty <= 50) stockStatus = "medium";

  return {
    id: item.inventoryId || variant?.id || 0,
    name: product?.name || "Unknown Product",
    brand: (variant as any)?.brand?.name || product?.category?.name || "",
    image,
    pricePerUnit: item.retailPrice || variant?.price || "0",
    unit: unitLabel,
    moq: Number(variant?.orderMin) || 1,
    moqUnit: unitLabel,
    availableQty: qty,
    availableUnit: `${unitLabel} Available`,
    rating: 0,
    reviewCount: 0,
    stockStatus,
  };
}

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 border border-gray-200 transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
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
        <div className="p-5 md:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{product.name}</h2>
            {product.brand && <p className="text-sm text-gray-500">{product.brand}</p>}
          </div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="text-2xl font-bold text-gray-900">৳ {product.pricePerUnit}</span>
              <span className="text-sm text-gray-500 ml-1">/ {product.unit}</span>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${stock.color}`}>
              {stock.text}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Minimum Order Qty</p>
              <p className="text-sm font-semibold text-gray-900">{product.moq} {product.moqUnit}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Available</p>
              <p className="text-sm font-semibold text-gray-900">{product.availableQty} {product.unit}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Unit Price</p>
              <p className="text-sm font-semibold text-gray-900">৳ {product.pricePerUnit} / {product.unit}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Category</p>
              <p className="text-sm font-semibold text-gray-900">{product.brand || "—"}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2">
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </Button>
            <Button variant="outline" className="h-11 px-6 border-gray-200 font-medium" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface WarehouseProductGridProps {
  products?: any[];
  isLoading?: boolean;
  warehouseSlug?: string;
}

export function WarehouseProductGrid({
  products: rawProducts = [],
  isLoading = false,
  warehouseSlug = "",
}: WarehouseProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<WarehouseProduct | null>(null);
  const [orderProduct, setOrderProduct] = useState<any>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  // Map API data to card shape
  const products: WarehouseProduct[] = rawProducts.map(mapApiProduct);

  const handleBuyNow = (cardProduct: WarehouseProduct) => {
    // Find raw API item to get variant-level data for order
    const raw = rawProducts.find(
      (r: any) => (r.inventoryId || r.variant?.id) === cardProduct.id
    );
    if (!raw) return;
    const variant = raw.variant;
    setOrderProduct({
      inventoryId: raw.inventoryId,
      variantId: variant?.id,
      productName: cardProduct.name,
      unit: cardProduct.unit,
      pricePerUnit: cardProduct.pricePerUnit,
      availableQty: cardProduct.availableQty,
      moq: cardProduct.moq,
      weightKg: Number(variant?.weightKg) || 0,
      innerPackSizeKg: Number(variant?.innerPackSizeKg || variant?.pieceWeightKg) || 0,
      packType: variant?.packType || cardProduct.unit,
    });
    setOrderOpen(true);
  };

  if (isLoading) {
    return (
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-gray-100" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-5 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="container mx-auto px-4 py-12">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-600">No products available</p>
          <p className="text-sm text-gray-400">This warehouse has no products in stock yet.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Products</h2>
          <span className="text-sm text-gray-500">{products.length} items available</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {products.map((product) => (
            <WarehouseProductCard
              key={product.id}
              product={product}
              onViewDetails={setSelectedProduct}
              onBuyNow={handleBuyNow}
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

      <WarehouseOrderDialog
        product={orderProduct}
        warehouseSlug={warehouseSlug}
        open={orderOpen}
        onOpenChange={setOrderOpen}
      />
    </>
  );
}
