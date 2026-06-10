"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, ShoppingCart, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WarehouseProductCard,
  WarehouseProductCardSkeleton,
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
      return { text: "In Stock", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    case "medium":
      return { text: "Limited Stock", color: "text-amber-700 bg-amber-50 border-amber-200" };
    case "low":
      return { text: "Low Stock", color: "text-red-700 bg-red-50 border-red-200" };
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-md bg-white/95 hover:bg-zinc-100 border border-zinc-200 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-500" />
        </button>
        <div className="relative aspect-[16/9] bg-zinc-50 border-b border-zinc-100 overflow-hidden">
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
            <div className="w-full h-full flex items-center justify-center bg-zinc-50">
              <Package className="w-16 h-16 text-zinc-300" />
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="mb-4">
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block mb-1">
              {product.brand || "Product Details"}
            </span>
            <h2 className="text-lg font-bold text-zinc-900 mb-1 leading-snug">{product.name}</h2>
          </div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="text-2xl font-extrabold text-zinc-900 font-mono">৳ {product.pricePerUnit}</span>
              <span className="text-xs text-zinc-500 font-medium ml-1">/ {product.unit}</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase font-bold border ${stock.color}`}>
              {stock.text}
            </span>
          </div>

          {/* Logistics Grid Dividers */}
          <div className="grid grid-cols-2 gap-px bg-zinc-200 border border-zinc-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-white p-3.5">
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">Minimum Order Qty</p>
              <p className="text-sm font-mono text-zinc-900 font-bold">{product.moq} {product.moqUnit}</p>
            </div>
            <div className="bg-white p-3.5">
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">Available Qty</p>
              <p className="text-sm font-mono text-zinc-900 font-bold">{product.availableQty} {product.unit}</p>
            </div>
            <div className="bg-white p-3.5">
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">Unit Price</p>
              <p className="text-sm font-mono text-zinc-900 font-bold">৳ {product.pricePerUnit} / {product.unit}</p>
            </div>
            <div className="bg-white p-3.5">
              <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-1">Category</p>
              <p className="text-sm font-mono text-zinc-900 font-bold">{product.brand || "—"}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button className="flex-1 h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold gap-2 rounded transition-colors shadow-none">
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </Button>
            <Button variant="outline" className="h-11 px-6 border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-semibold rounded transition-colors" onClick={onClose}>
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
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
}

export function WarehouseProductGrid({
  products: rawProducts = [],
  isLoading = false,
  warehouseSlug = "",
  pagination,
  onPageChange,
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <WarehouseProductCardSkeleton key={i} />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {products.map((product) => (
            <WarehouseProductCard
              key={product.id}
              product={product}
              onViewDetails={setSelectedProduct}
              onBuyNow={handleBuyNow}
            />
          ))}
        </div>

        {/* Pagination controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 border-t border-zinc-200 pt-6">
            <p className="text-xs font-medium text-zinc-400 font-mono">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} products)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => onPageChange?.(Math.max(1, pagination.page - 1))}
                className="h-8 px-3 text-xs font-semibold border-zinc-200 text-zinc-600 font-mono rounded bg-white hover:bg-zinc-50"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => onPageChange?.(Math.min(pagination.totalPages, pagination.page + 1))}
                className="h-8 px-3 text-xs font-semibold border-zinc-200 text-zinc-600 font-mono rounded bg-white hover:bg-zinc-50"
              >
                Next
              </Button>
            </div>
          </div>
        )}
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
