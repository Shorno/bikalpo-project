"use client";

import { StorefrontProductCard } from "@/components/storefront/storefront-product-card";
import { withCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";

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

  return (
    <StorefrontProductCard
      mode="reference"
      detailHref={productHref}
      previewMode={previewMode}
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
