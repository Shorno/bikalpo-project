"use client";

import { ArrowRight, Package, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CylinderTypePreview } from "@/components/features/products/cylinder-type-radios";
import { withCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";

interface ConsumerProductCardProps {
  product: {
    id: number;
    name: string;
    slug: string;
    price: string | number;
    image: string;
    size?: string | null;
    inStock?: boolean;
    canExchange?: boolean | null;
    category?: { name?: string; slug?: string } | null;
    brand?: { name?: string; slug?: string; logo?: string | null } | null;
    reviewStats?: { averageRating: number; totalReviews: number } | null;
    sellerCount?: number | null;
  };
  previewMode?: boolean;
}

export function ConsumerProductCard({
  product,
  previewMode = false,
}: ConsumerProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const categorySlug = product.category?.slug ?? "all";
  const productHref = withCustomerStorefrontPreview(
    `/products/${categorySlug}/${product.slug}`,
    previewMode,
  );
  const hasValidImage = Boolean(
    product.image && !imageError && product.image.trim() !== "",
  );
  const rawPrice =
    typeof product.price === "string"
      ? Number.parseFloat(product.price)
      : Number(product.price);
  const price = Number.isFinite(rawPrice) ? rawPrice : 0;
  const rating = product.reviewStats?.averageRating ?? 0;
  const reviewCount = product.reviewStats?.totalReviews ?? 0;
  const context = [product.brand?.name, product.category?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={productHref}
      id={`consumer-product-${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-square overflow-hidden border-b border-border/70 bg-[oklch(0.975_0.006_250)]">
        {hasValidImage ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-5 transition-transform duration-300 ease-out group-hover:scale-[1.035]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImageError(true)}
            unoptimized={product.image.startsWith("http")}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/55">
            <Package className="size-10" />
            <span className="text-[11px] font-medium">Image unavailable</span>
          </div>
        )}

        {product.inStock === false ? (
          <span className="absolute top-3 right-3 rounded-md bg-[oklch(0.25_0.012_250)] px-2.5 py-1 text-[10px] font-semibold text-slate-100 shadow-sm">
            Out of stock
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {context ? (
          <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground">
            {context}
          </p>
        ) : null}

        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-foreground sm:text-[15px]">
          {product.name}
        </h3>

        {product.canExchange ? (
          <div className="mt-3">
            <CylinderTypePreview />
          </div>
        ) : null}

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">
              {price > 0 ? "Reference price" : "Price"}
            </p>
            <p className="mt-0.5 text-lg font-bold tracking-[-0.02em] tabular-nums text-foreground sm:text-xl">
              {price > 0
                ? `৳ ${price.toLocaleString("en-BD", {
                    maximumFractionDigits: 0,
                  })}`
                : "Unavailable"}
            </p>
          </div>
        </div>

        {rating > 0 ? (
          <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {rating > 0 && reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="font-semibold tabular-nums text-foreground">
                  {rating.toFixed(1)}
                </span>
                <span>({reviewCount})</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <span className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-colors duration-200 ease-out group-hover:bg-primary/90 sm:text-sm">
          View details
          <ArrowRight className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
