"use client";

import {
  CheckCircle2,
  ChevronRight,
  MapPin,
  PackageCheck,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductActions } from "@/components/features/products/product-actions";
import { ProductImageGallery } from "@/components/features/products/product-image-gallery";
import { ProductSpecs } from "@/components/features/products/product-specs";
import { Badge } from "@/components/ui/badge";
import { withCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { cn } from "@/lib/utils";
import type { client } from "@/utils/orpc";

type RetailerProductDetailData = Awaited<
  ReturnType<typeof client.customer.getShopProductBySlug>
>;

export function RetailerProductDetail({
  data,
  previewMode,
}: {
  data: RetailerProductDetailData;
  previewMode: boolean;
}) {
  const { product, shop } = data;
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id,
  );
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ??
    product.variants[0];

  if (!selectedVariant) return null;

  const shopName = shop.shopName || shop.name;
  const shopHref = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(shop.shopSlug || "")}`,
    previewMode,
  );
  const categoryHref = withCustomerStorefrontPreview(
    `${shopHref.split("?")[0]}?category=${encodeURIComponent(product.category.slug)}`,
    previewMode,
  );
  const images = Array.from(
    new Set(
      [product.image, ...product.images.map((image) => image.imageUrl)].filter(
        Boolean,
      ),
    ),
  );
  const availableQuantity = Math.max(
    0,
    Math.floor(Number(selectedVariant.availableQty)),
  );
  const retailPrice = Number(selectedVariant.retailPrice);
  const displayUnit =
    selectedVariant.quantitySelectorLabel ||
    selectedVariant.unitLabel ||
    selectedVariant.orderUnit;

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-3">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500"
          >
            <Link href="/" className="hover:text-slate-950">
              Home
            </Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <Link
              href={withCustomerStorefrontPreview("/stores", previewMode)}
              className="hover:text-slate-950"
            >
              Stores
            </Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <Link
              href={shopHref}
              className="max-w-40 truncate hover:text-slate-950"
            >
              {shopName}
            </Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <span
              className="truncate font-medium text-slate-950"
              aria-current="page"
            >
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 md:py-8">
        <section className="mb-5 flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {shop.image ? (
              <Image
                src={shop.image}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-lg border object-cover"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-slate-50">
                <Store className="size-5 text-primary" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-950">
                  Sold by {shopName}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Verified retailer
                </span>
              </div>
              {shop.shopAddress && (
                <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                  <MapPin
                    className="mt-0.5 size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="line-clamp-1">{shop.shopAddress}</span>
                </p>
              )}
            </div>
          </div>
          <Link
            href={shopHref}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border px-4 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary"
          >
            View store catalog
          </Link>
        </section>

        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
            <div className="border-b p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <ProductImageGallery images={images} productName={product.name} />
            </div>

            <div className="flex flex-col p-5 sm:p-7 lg:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={categoryHref}>
                  <Badge variant="secondary" className="font-medium">
                    {product.category.name}
                  </Badge>
                </Link>
                {product.subCategory && (
                  <Badge variant="outline">{product.subCategory.name}</Badge>
                )}
                {product.brand && (
                  <Badge variant="outline">{product.brand.name}</Badge>
                )}
              </div>

              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-3xl">
                {product.name}
              </h1>
              {product.shortDescription && (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {product.shortDescription}
                </p>
              )}

              <div className="mt-6 border-y py-5">
                <p className="text-xs font-medium text-slate-500">
                  {displayUnit ? `Price per ${displayUnit}` : "Retail price"}
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <p className="font-mono text-3xl font-semibold tabular-nums text-slate-950">
                    ৳{retailPrice.toLocaleString("en-BD")}
                  </p>
                  <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <PackageCheck className="size-4" aria-hidden="true" />
                    {availableQuantity.toLocaleString("en-BD")} available
                  </p>
                </div>
              </div>

              {product.variants.length > 1 && (
                <fieldset className="mt-6">
                  <legend className="text-sm font-semibold text-slate-950">
                    Choose an option
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {product.variants.map((variant) => {
                      const active = variant.id === selectedVariant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVariantId(variant.id)}
                          aria-pressed={active}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                            active
                              ? "border-primary bg-blue-50/70"
                              : "hover:border-slate-400 hover:bg-slate-50",
                          )}
                        >
                          <span className="block text-sm font-semibold text-slate-950">
                            {variant.unitLabel}
                          </span>
                          <span className="mt-1 block font-mono text-sm tabular-nums text-slate-700">
                            ৳
                            {Number(variant.retailPrice).toLocaleString(
                              "en-BD",
                            )}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-500">
                            {Number(variant.availableQty).toLocaleString(
                              "en-BD",
                            )}{" "}
                            available
                            {variant.sku ? ` · ${variant.sku}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="mt-7">
                {previewMode ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Ordering is disabled while viewing the customer preview.
                  </div>
                ) : (
                  <ProductActions
                    key={selectedVariant.id}
                    product={{
                      id: product.id,
                      name: product.name,
                      price: retailPrice,
                      image: product.image,
                      size: displayUnit,
                      inStock: availableQuantity > 0,
                      stockQuantity: availableQuantity,
                    }}
                    variantId={selectedVariant.id}
                    shopId={shop.id}
                    orderMin={Number(selectedVariant.orderMin || 1)}
                    orderMax={
                      selectedVariant.orderMax
                        ? Number(selectedVariant.orderMax)
                        : availableQuantity
                    }
                    orderIncrement={Number(selectedVariant.orderIncrement || 1)}
                    categoryName={product.category.name}
                    brandName={product.brand?.name}
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          {product.description && (
            <section className="rounded-xl border bg-white p-5 sm:p-7">
              <h2 className="text-lg font-semibold text-slate-950">
                Product description
              </h2>
              <div
                className="prose prose-slate mt-4 max-w-none text-sm leading-7"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </section>
          )}
          <section className="rounded-xl border bg-white p-5 sm:p-7">
            <h2 className="text-lg font-semibold text-slate-950">
              Product information
            </h2>
            <div className="mt-4">
              <ProductSpecs
                categoryName={product.category.name}
                brandName={product.brand?.name ?? null}
                subCategoryName={product.subCategory?.name}
                productSize={product.size}
                features={product.features}
                variants={[selectedVariant]}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
