"use client";

import { useState } from "react";
import {
  type StorefrontAddSelection,
  type StorefrontProduct,
  StorefrontProductCard,
} from "@/components/storefront/retailer-storefront";
import { useCart } from "@/hooks/use-orpc-cart";
import { addRetailerProductToCart } from "@/lib/retailer-quick-add";

interface StoreRelatedProductsGridProps {
  products: StorefrontProduct[];
  storeSlug: string;
  shopId: string;
  previewMode: boolean;
}

export function StoreRelatedProductsGrid({
  products,
  storeSlug,
  shopId,
  previewMode,
}: StoreRelatedProductsGridProps) {
  const { addItem } = useCart();
  const [addingProductId, setAddingProductId] = useState<number | null>(null);

  const handleQuickAdd = async (
    product: StorefrontProduct,
    selection: StorefrontAddSelection,
  ) => {
    if (previewMode) return;

    setAddingProductId(product.id);
    try {
      await addRetailerProductToCart(addItem, {
        productId: product.id,
        variantId: selection.variantId,
        shopId,
        cylinderSaleMode: selection.cylinderSaleMode,
      });
    } finally {
      setAddingProductId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <StorefrontProductCard
          key={product.id}
          product={product}
          shopSlug={storeSlug}
          previewMode={previewMode}
          isAdding={addingProductId === product.id}
          onQuickAdd={handleQuickAdd}
        />
      ))}
    </div>
  );
}
