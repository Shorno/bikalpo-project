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
  const { addItem, items: cartItems, updateQuantity } = useCart();
  const [addingProductIds, setAddingProductIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [pendingCartItemIds, setPendingCartItemIds] = useState<
    ReadonlySet<number>
  >(() => new Set());

  const handleQuickAdd = async (
    product: StorefrontProduct,
    selection: StorefrontAddSelection,
  ) => {
    if (previewMode) return;

    setAddingProductIds((current) => new Set(current).add(product.id));
    try {
      await addRetailerProductToCart(addItem, {
        productId: product.id,
        variantId: selection.variantId,
        shopId,
        cylinderSaleMode: selection.cylinderSaleMode,
      });
    } finally {
      setAddingProductIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleQuantityUpdate = async (
    cartItemId: number,
    quantity: number,
  ) => {
    setPendingCartItemIds((current) => new Set(current).add(cartItemId));
    try {
      await updateQuantity(cartItemId, quantity);
    } finally {
      setPendingCartItemIds((current) => {
        const next = new Set(current);
        next.delete(cartItemId);
        return next;
      });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <StorefrontProductCard
          key={product.id}
          product={product}
          shopSlug={storeSlug}
          shopId={shopId}
          previewMode={previewMode}
          isAdding={addingProductIds.has(product.id)}
          cartItems={cartItems}
          onQuickAdd={handleQuickAdd}
          pendingCartItemIds={pendingCartItemIds}
          onUpdateQuantity={handleQuantityUpdate}
        />
      ))}
    </div>
  );
}
