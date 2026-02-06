"use client";

import { Eye, Loader2, Package, PackagePlus, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { RequestFormModal } from "@/components/features/item-request/request-form-modal";
import { Button } from "@/components/ui/button";
import type { ProductWithRelations } from "@/db/schema";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/utils/currency";

interface ProductCardProps {
  product: ProductWithRelations;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const isOutOfStock = !product.inStock || product.stockQuantity === 0;

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addItem(Number(product.id), 1);
    } finally {
      setIsAdding(false);
    }
  };

  const productHref = `/products/${product.category.slug}/${product.slug}`;
  const hasValidImage =
    product.image && !imageError && product.image.trim() !== "";

  return (
    <div className="group bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-200">
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {isOutOfStock && (
          <span className="absolute top-2 right-2 z-10 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Stock out
          </span>
        )}
        <Link href={productHref} className="block w-full h-full">
          {hasValidImage ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
              unoptimized={product.image.startsWith("http")}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
          )}
        </Link>
      </div>

      {/* Product Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2 transition-colors hover:text-emerald-600">
          {product.name}
        </h3>

        <p className="text-xs text-gray-500 mb-1.5">{product.size}</p>

        <p className="text-base font-semibold text-gray-900 mb-2">
          {formatPrice(product.price)}
        </p>

        {/* Actions */}
        <div className="flex gap-1.5">
          {isOutOfStock ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs font-medium border-emerald-100 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={() => setRequestModalOpen(true)}
              >
                <PackagePlus className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Request</span>
              </Button>
              <RequestFormModal
                open={requestModalOpen}
                onOpenChange={setRequestModalOpen}
                initialValues={{
                  itemName: product.name,
                  brand: product.brand?.name ?? "",
                  category: product.category?.name ?? "",
                  quantity: 1,
                  image: product.image,
                }}
              />
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs font-medium border-emerald-100 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={handleAddToCart}
              disabled={isAdding}
            >
              {isAdding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Add</span>
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1 h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
            asChild
          >
            <Link href={productHref}>
              <Eye className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Details</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
