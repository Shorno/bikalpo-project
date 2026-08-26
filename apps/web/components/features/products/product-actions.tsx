"use client";

import { Loader2, Minus, PackagePlus, Plus, ShoppingCart } from "lucide-react";
import { type ReactNode, useState } from "react";
import { RequestFormModal } from "@/components/features/item-request/request-form-modal";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-orpc-cart";

interface ProductActionsProps {
  product: {
    id: number;
    name: string;
    price: number;
    image: string;
    size: string;
    inStock: boolean;
    stockQuantity: number;
  };
  variantId?: number;
  orderMin?: number;
  orderMax?: number;
  orderIncrement?: number;
  variant?: "default" | "emerald";
  categoryName?: string;
  brandName?: string;
  shopId?: string;
  purchaseMode?: "open_order" | "direct";
  cylinderSaleMode?: "new" | "exchange";
  onQuantityChange?: (quantity: number) => void;
  actionLabel?: string;
  secondaryAction?: ReactNode;
}

export function ProductActions({
  product,
  variantId,
  orderMin = 1,
  orderMax,
  orderIncrement = 1,
  variant = "default",
  categoryName,
  brandName,
  shopId,
  purchaseMode = shopId ? "direct" : "open_order",
  cylinderSaleMode,
  onQuantityChange,
  actionLabel,
  secondaryAction,
}: ProductActionsProps) {
  const effectiveMin = Math.max(1, orderMin);
  const effectiveMax =
    purchaseMode === "open_order"
      ? (orderMax ?? 999)
      : orderMax
        ? Math.min(orderMax, product.stockQuantity)
        : product.stockQuantity;
  const step = Math.max(1, orderIncrement);

  const [quantity, setQuantity] = useState(effectiveMin);
  const [isAdding, setIsAdding] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const { addItem } = useCart();

  const handleIncrement = () => {
    const next = quantity + step;
    if (next <= effectiveMax) {
      setQuantity(next);
      onQuantityChange?.(next);
    }
  };

  const handleDecrement = () => {
    const next = quantity - step;
    if (next >= effectiveMin) {
      setQuantity(next);
      onQuantityChange?.(next);
    }
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addItem(
        product.id,
        quantity,
        variantId,
        shopId,
        purchaseMode,
        cylinderSaleMode,
      );
    } finally {
      setIsAdding(false);
    }
  };

  const isOutOfStock =
    purchaseMode === "direct" &&
    (!product.inStock || product.stockQuantity === 0);
  const isEmerald = variant === "emerald";

  return (
    <div className="space-y-4">
      {/* Quantity Selector - hidden when out of stock */}
      {!isOutOfStock && (
        <div className="flex items-center gap-4">
          <span className="text-gray-600 font-medium">Quantity:</span>
          <div className="flex items-center border rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-r-none"
              onClick={handleDecrement}
              disabled={quantity <= effectiveMin || isAdding}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center font-medium">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-l-none"
              onClick={handleIncrement}
              disabled={quantity >= effectiveMax || isAdding}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isOutOfStock ? (
          <>
            <Button
              className={`flex-1 h-12 text-base ${isEmerald ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              onClick={() => setRequestModalOpen(true)}
            >
              <PackagePlus className="mr-2 h-5 w-5" />
              Request Item
            </Button>
            <RequestFormModal
              open={requestModalOpen}
              onOpenChange={setRequestModalOpen}
              initialValues={{
                itemName: product.name,
                brand: brandName ?? "",
                category: categoryName ?? "",
                quantity: 1,
                image: product.image,
              }}
            />
          </>
        ) : (
          <Button
            className={`flex-1 h-12 text-base ${isEmerald ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
            onClick={handleAddToCart}
            disabled={isAdding || (purchaseMode === "direct" && !shopId)}
          >
            {isAdding ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-5 w-5" />
            )}
            {purchaseMode === "direct" && !shopId
              ? "Choose a retailer"
              : isAdding
                ? "Adding..."
                : (actionLabel ??
                  (purchaseMode === "open_order"
                    ? "Add to open order"
                    : "Add to cart"))}
          </Button>
        )}
        {secondaryAction}
      </div>

      {/* Total Price - Only shown when in stock for authenticated customers */}
      {!isOutOfStock && isEmerald && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">
              {purchaseMode === "open_order"
                ? "Reference subtotal:"
                : "Total price:"}
            </span>
            <span className="text-2xl font-bold text-gray-900">
              ৳{(product.price * quantity).toLocaleString("en-BD")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
