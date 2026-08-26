"use client";

import {
  type StorefrontAddSelection,
  type StorefrontProduct,
  StorefrontProductCard,
} from "@/components/storefront/storefront-product-card";
import { useCart } from "@/hooks/use-orpc-cart";
import { withCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { addReferenceProductToCart } from "@/lib/reference-quick-add";

interface ConsumerProductCardProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: string | number;
    image: string;
    images?: Array<{ imageUrl: string }> | null;
    size?: string | null;
    inStock?: boolean;
    canExchange?: boolean | null;
    cylinderSale?: {
      supportsNew: boolean;
      exchangeAvailable: boolean;
    } | null;
    category?: { name?: string; slug?: string } | null;
    subCategory?: { name?: string; slug?: string } | null;
    brand?: { name?: string; slug?: string; logo?: string | null } | null;
    reviewStats?: { averageRating: number; totalReviews: number } | null;
    sellerCount?: number | null;
    variants?: Array<{
      variantId: number;
      sku?: string | null;
      unitLabel?: string | null;
      quantitySelectorLabel?: string | null;
      referencePrice: string | number;
      sortOrder?: number;
      exchangeEnabled?: boolean | null;
      exchangeCreditAmount?: string | number | null;
    }> | null;
  };
  previewMode?: boolean;
}

function asPrice(value: string | number): number {
  const price =
    typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(price) ? price : 0;
}

export function ConsumerProductCard({
  product,
  previewMode = false,
}: ConsumerProductCardProps) {
  const {
    addItem,
    isHydrated: isCartHydrated,
    items: cartItems,
    pendingAddSelectionKeys,
    pendingCartItemIds,
    updateQuantity,
  } = useCart();
  const categorySlug = product.category?.slug ?? "all";
  const productHref = withCustomerStorefrontPreview(
    `/products/${categorySlug}/${product.slug}`,
    previewMode,
  );
  const fallbackPrice = asPrice(product.price);
  const variants =
    product.variants && product.variants.length > 0
      ? product.variants.map((variant) => ({
          variantId: variant.variantId,
          sku: variant.sku ?? null,
          unitLabel: variant.unitLabel ?? null,
          quantitySelectorLabel: variant.quantitySelectorLabel ?? null,
          displayPrice: String(asPrice(variant.referencePrice)),
          sortOrder: variant.sortOrder,
          exchangeEnabled: Boolean(variant.exchangeEnabled),
          exchangeCreditAmount: variant.exchangeCreditAmount ?? 0,
          canExchange: Boolean(variant.exchangeEnabled),
        }))
      : [];

  const handleQuickAdd = async (
    selectedProduct: StorefrontProduct,
    selection: StorefrontAddSelection,
  ) => {
    if (previewMode) return;

    await addReferenceProductToCart(addItem, {
      productId: selectedProduct.id,
      variantId: selection.variantId,
      cylinderSaleMode: selection.cylinderSaleMode,
    });
  };

  const handleQuantityUpdate = async (cartItemId: number, quantity: number) => {
    await updateQuantity(cartItemId, quantity);
  };

  return (
    <StorefrontProductCard
      mode="reference"
      detailHref={productHref}
      previewMode={previewMode}
      cartReady={isCartHydrated}
      cartItems={cartItems}
      pendingAddSelectionKeys={pendingAddSelectionKeys}
      pendingCartItemIds={pendingCartItemIds}
      onQuickAdd={handleQuickAdd}
      onUpdateQuantity={handleQuantityUpdate}
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.image,
        images: product.images ?? [],
        category: product.category?.slug
          ? {
              name: product.category.name ?? "",
              slug: product.category.slug,
            }
          : null,
        subCategory: product.subCategory?.name
          ? {
              name: product.subCategory.name,
              slug: product.subCategory.slug ?? "",
            }
          : null,
        lowestDisplayPrice: fallbackPrice,
        variantCount: variants.length,
        totalAvailableQty: 0,
        averageRating: product.reviewStats?.averageRating ?? 0,
        totalReviews: product.reviewStats?.totalReviews ?? 0,
        variants,
      }}
    />
  );
}
