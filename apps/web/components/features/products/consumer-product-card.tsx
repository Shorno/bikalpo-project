"use client";

import { Eye, Package, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CylinderTypePreview } from "@/components/features/products/cylinder-type-radios";
import { Button } from "@/components/ui/button";
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
    cylinderSale?: {
      supportsNew: boolean;
      exchangeAvailable: boolean;
    } | null;
    category?: { name?: string; slug?: string } | null;
    subCategory?: { name?: string; slug?: string } | null;
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
  const sellerCount = product.sellerCount ?? 0;
  const shouldHideCategoryContext = [
    product.category?.name,
    product.category?.slug,
    product.subCategory?.name,
    product.subCategory?.slug,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const normalized = value.toLowerCase().replace(/[_-]+/g, " ").trim();
      return normalized === "lpg" || normalized === "industrial lpg";
    });
  const categoryContext = [product.category?.name, product.subCategory?.name]
    .filter(Boolean)
    .join(" / ");

  return (
    <article
      id={`consumer-product-${product.id}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white transition-colors hover:border-slate-400 focus-within:border-primary"
    >
      <Link href={productHref} className="block border-b bg-slate-50">
        <div className="relative aspect-[4/3] overflow-hidden p-4 sm:p-5">
          {hasValidImage ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.02]"
              sizes="(max-width: 559px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onError={() => setImageError(true)}
              unoptimized={product.image.startsWith("http")}
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Package className="size-10 text-slate-300" aria-hidden="true" />
              <span className="sr-only">No product image available</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {!shouldHideCategoryContext && (
          <p className="min-h-4 truncate text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
            {categoryContext || "Reference product"}
          </p>
        )}

        <Link
          href={productHref}
          className={`focus-visible:outline-none ${
            shouldHideCategoryContext ? "mt-0" : "mt-1.5"
          }`}
        >
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-950 transition-colors hover:text-primary group-focus-within:text-primary">
            {product.name}
          </h3>
        </Link>

        {rating > 0 && reviewCount > 0 ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Star
                className="size-3 fill-amber-400 text-amber-400"
                aria-hidden="true"
              />
              <span className="font-medium tabular-nums text-slate-700">
                {rating.toFixed(1)}
              </span>
              <span className="text-slate-400">
                ({reviewCount.toLocaleString("en-BD")})
              </span>
            </span>
          </div>
        ) : null}

        <div className="mt-3">
          <p className="font-mono text-lg font-semibold tabular-nums text-slate-950">
            {price > 0
              ? `৳${price.toLocaleString("en-BD", {
                  maximumFractionDigits: 0,
                })}`
              : "Unavailable"}
            {price > 0 && product.size ? (
              <span className="ml-1 font-sans text-xs font-normal text-slate-500">
                / {product.size}
              </span>
            ) : null}
          </p>
          {price > 0 ? (
            <p className="mt-0.5 text-[11px] text-slate-400">Reference price</p>
          ) : null}
        </div>

        {product.cylinderSale?.supportsNew ? (
          <div className="mt-3">
            <CylinderTypePreview
              exchangeAvailable={product.cylinderSale.exchangeAvailable}
            />
          </div>
        ) : null}

        <p className="mt-3 text-xs text-slate-500">
          {product.inStock === false ? (
            "Currently unavailable"
          ) : sellerCount > 0 ? (
            <>
              Available from{" "}
              <span className="font-mono tabular-nums text-slate-700">
                {sellerCount.toLocaleString("en-BD")}
              </span>{" "}
              {sellerCount === 1 ? "retailer" : "retailers"}
            </>
          ) : (
            "Available for request"
          )}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Button asChild className="h-9 flex-1 text-xs">
            <Link href={productHref}>
              <Eye className="size-3.5" aria-hidden="true" />
              View details
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
