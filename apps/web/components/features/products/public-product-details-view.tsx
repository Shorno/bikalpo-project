"use client";

import type { ProductFeatureGroup } from "@bikalpo-project/db/schema";
import { ArrowLeft, Phone, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ProductActions } from "@/components/features/products/product-actions";
import { StarRating } from "@/components/features/reviews/star-rating";
import { WarehouseProductDetailActions } from "@/components/features/warehouse/warehouse-product-detail-actions";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductReviews } from "@/hooks/use-customer-api";
import {
  resolveProductActionsPurchase,
  resolveStorefrontProductSelection,
  type StorefrontCylinderSaleMode,
  supportsEmptyPackReturn,
} from "@/lib/storefront-product-details";
import { cn } from "@/lib/utils";
import type { WarehouseStorefrontProductDetail } from "@/types/warehouse-storefront";
import { shortVariantLabel } from "./cylinder-type-radios";
import type { DetailVariant } from "./trade-product-detail-client";

type StorefrontProductDetailsViewProps = {
  product: {
    id: number;
    code: string;
    name: string;
    image: string;
    size: string;
    description: string | null;
    shortDescription: string | null;
    features: ProductFeatureGroup[] | null;
    inStock: boolean;
    category: { name: string; slug: string };
    subCategory?: { name: string } | null;
    brand?: { name: string } | null;
  };
  variants: DetailVariant[];
  reviewStats: { averageRating: number; totalReviews: number };
  soldOrderCount?: number;
  breadcrumbs: Array<{ label: string; href?: string }>;
  categoryHref: string;
  previewMode?: boolean;
  supportPhone?: string | null;
  purchase?:
    | {
        kind: "open_order";
        supportPhone?: string | null;
      }
    | {
        kind: "direct";
        shopId: string;
        supportPhone?: string | null;
      }
    | {
        kind: "warehouse";
        product: WarehouseStorefrontProductDetail;
        warehouseSlug: string;
        cartPath: string;
      };
};

type DetailTab = "description" | "reviews";

function formatMoney(value: number) {
  return `৳${value.toLocaleString("en-BD")}`;
}

function getFeatureMap(features: ProductFeatureGroup[] | null) {
  const values = new Map<string, string>();
  for (const group of features ?? []) {
    for (const item of group.items ?? []) {
      if (item.key?.trim() && item.value?.trim()) {
        values.set(item.key.trim().toLowerCase(), item.value.trim());
      }
    }
  }
  return values;
}

function getFeature(features: Map<string, string>, ...labels: string[]) {
  for (const label of labels) {
    const value = features.get(label.toLowerCase());
    if (value) return value;
  }
  return null;
}

function formatVariantLabel(variant: DetailVariant, productName: string) {
  return shortVariantLabel(variant.unitLabel, productName);
}

function descriptionToPlainText(description: string) {
  return description
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function StorefrontProductDetailsView({
  product,
  variants,
  reviewStats,
  soldOrderCount,
  breadcrumbs,
  categoryHref,
  previewMode = false,
  supportPhone,
  purchase,
}: StorefrontProductDetailsViewProps) {
  const purchaseContext = purchase ?? {
    kind: "open_order" as const,
    supportPhone,
  };
  const initialSelection = useMemo(
    () =>
      resolveStorefrontProductSelection({
        variants,
        selectedVariantId: -1,
        requestedSaleMode: "new",
        exchangeAllowed: true,
      }),
    [variants],
  );
  const [selectedVariantId, setSelectedVariantId] = useState(
    initialSelection.selectedVariant?.id ?? -1,
  );
  const [saleMode, setSaleMode] = useState<StorefrontCylinderSaleMode>(
    initialSelection.selectedVariant?.cylinderSale?.defaultMode ?? "new",
  );
  const [activeTab, setActiveTab] = useState<DetailTab>("description");
  const [warehouseExchangeAllowed, setWarehouseExchangeAllowed] =
    useState(false);
  const isLpg = product.category.slug === "lpg";
  const hasEmptyPackReturn = supportsEmptyPackReturn(variants);
  const selection = useMemo(
    () =>
      resolveStorefrontProductSelection({
        variants,
        selectedVariantId,
        requestedSaleMode: saleMode,
        exchangeAllowed:
          purchaseContext.kind !== "warehouse" || warehouseExchangeAllowed,
      }),
    [
      purchaseContext.kind,
      saleMode,
      selectedVariantId,
      variants,
      warehouseExchangeAllowed,
    ],
  );
  const {
    effectiveSaleMode,
    exchangeAvailable,
    selectedPrice,
    selectedVariant,
    sortedVariants,
  } = selection;
  const handleWarehouseExchangeAllowed = useCallback((allowed: boolean) => {
    setWarehouseExchangeAllowed(allowed);
  }, []);

  if (!selectedVariant) return null;

  const selectedLabel = formatVariantLabel(selectedVariant, product.name);
  const productActionsPurchase = resolveProductActionsPurchase(
    purchaseContext,
    Number(selectedVariant.stockQuantity ?? 0),
  );
  const features = getFeatureMap(product.features);
  const descriptionRows: Array<{
    label: string;
    value: string;
    metric?: boolean;
  }> = isLpg
    ? [
        {
          label: "Cylinder Type",
          value:
            getFeature(features, "cylinder type") ??
            (selectedVariant.packType === "cylinder"
              ? "LPG Cylinder"
              : selectedVariant.packagingType || "LPG Cylinder"),
        },
        {
          label: "Gas Type",
          value:
            getFeature(features, "gas type") ?? "Liquefied Petroleum Gas (LPG)",
        },
        { label: "Capacity", metric: true, value: selectedLabel },
        {
          label: "Cylinder Condition",
          value: getFeature(features, "cylinder condition") ?? "Filled",
        },
        {
          label: "Exchange Required",
          value:
            effectiveSaleMode === "exchange" ? "Yes (Empty Cylinder)" : "No",
        },
        {
          label: "Valve Type",
          value: getFeature(features, "valve type") ?? "—",
        },
        {
          label: "Safety Standard",
          value: getFeature(features, "safety standard") ?? "—",
        },
        {
          label: "Country Origin",
          value:
            selectedVariant.origin ??
            getFeature(features, "country origin", "origin") ??
            "—",
        },
        {
          label: "Return",
          value: exchangeAvailable
            ? "Empty Cylinder Exchange Available"
            : "Empty Cylinder Exchange Not Available",
        },
      ]
    : [
        { label: "Product Type", value: product.category.name },
        { label: "Variant", metric: true, value: selectedLabel },
        { label: "Brand", value: product.brand?.name ?? "—" },
        {
          label: "Country Origin",
          value:
            selectedVariant.origin ?? getFeature(features, "origin") ?? "—",
        },
      ];

  const selectVariant = (variant: DetailVariant) => {
    setSelectedVariantId(variant.id);
    setSaleMode(variant.cylinderSale?.defaultMode ?? "new");
    if (purchaseContext.kind === "warehouse") {
      setWarehouseExchangeAllowed(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {previewMode && <CustomerPreviewBanner />}

      <div className="border-b border-zinc-200 bg-white">
        <div className="container mx-auto px-4 py-3">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap text-sm text-zinc-600"
          >
            {breadcrumbs.map((crumb, index) => (
              <div
                className="flex items-center gap-2"
                key={`${crumb.label}-${crumb.href ?? index}`}
              >
                {index > 0 && <span aria-hidden="true">›</span>}
                {crumb.href ? (
                  <Link className="hover:text-zinc-950" href={crumb.href}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-mono font-medium text-zinc-950">
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 lg:py-8">
        <header className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <Link
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            href={categoryHref}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Link>
          <h1 className="min-w-0 truncate text-lg font-bold text-zinc-950 sm:text-xl">
            {product.name}{" "}
            <span className="font-mono text-sm font-semibold text-zinc-500 sm:text-base">
              {product.code}
            </span>
          </h1>
        </header>

        <section className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
            <div className="flex flex-col border-b border-zinc-200 p-5 lg:border-r lg:border-b-0 lg:p-8">
              <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-md bg-zinc-50 sm:min-h-[460px]">
                <Image
                  alt={product.name}
                  className="object-contain p-4"
                  fill
                  priority
                  sizes="(min-width: 1024px) 44vw, 92vw"
                  src={product.image}
                />
              </div>

              <div className="mt-5 space-y-2 text-sm text-zinc-700">
                <p>Home Delivery Available</p>
                {exchangeAvailable && (
                  <p>
                    {isLpg
                      ? "Empty Cylinder Exchange Available"
                      : "Empty Pack Exchange Available"}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-7 lg:p-8">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-zinc-500">Product ID</dt>
                <dd className="font-mono font-semibold text-zinc-950">
                  : {product.code}
                </dd>
                <dt className="text-zinc-500">Product Name</dt>
                <dd className="font-semibold text-zinc-950">
                  : {product.name}
                </dd>
                <dt className="text-zinc-500">Brand</dt>
                <dd className="font-semibold text-zinc-950">
                  : {product.brand?.name ?? "—"}
                </dd>
              </dl>

              <div className="mt-6">
                <p className="text-sm font-medium text-zinc-600">Price</p>
                <p
                  className="mt-1 font-mono text-3xl font-extrabold tabular-nums text-zinc-950"
                  data-testid="selected-product-price"
                >
                  {formatMoney(selectedPrice)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600">
                  <span className="inline-flex items-center gap-2">
                    <StarRating
                      rating={Math.round(reviewStats.averageRating)}
                      size="sm"
                    />
                    <span className="font-mono tabular-nums">
                      {reviewStats.averageRating.toFixed(1)} (
                      {reviewStats.totalReviews.toLocaleString("en-BD")}{" "}
                      Reviews)
                    </span>
                  </span>
                  <span>
                    Sold :{" "}
                    <span className="font-mono tabular-nums">
                      {(soldOrderCount ?? 0).toLocaleString("en-BD")} Orders
                    </span>
                  </span>
                </div>
              </div>

              <fieldset className="mt-7">
                <legend className="text-sm font-semibold text-zinc-900">
                  {isLpg ? "Cylinder Size" : "Variant"}
                </legend>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
                  {sortedVariants.map((variant) => {
                    const variantLabel = formatVariantLabel(
                      variant,
                      product.name,
                    );
                    return (
                      <label
                        className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700"
                        key={variant.id}
                      >
                        <input
                          checked={selectedVariant.id === variant.id}
                          className="size-4 accent-blue-700"
                          name="product-variant"
                          onChange={() => selectVariant(variant)}
                          type="radio"
                          value={variant.id}
                        />
                        <span className="font-mono tabular-nums">
                          {variantLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {hasEmptyPackReturn && (
                <fieldset className="mt-7">
                  <legend className="text-sm font-semibold text-zinc-900">
                    {isLpg ? "Cylinder Type" : "Purchase Type"}
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
                    {exchangeAvailable && (
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
                        <input
                          checked={effectiveSaleMode === "exchange"}
                          className="size-4 accent-blue-700"
                          name="cylinder-type"
                          onChange={() => setSaleMode("exchange")}
                          type="radio"
                          value="exchange"
                        />
                        Exchange
                      </label>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700">
                      <input
                        checked={effectiveSaleMode === "new"}
                        className="size-4 accent-blue-700"
                        name="cylinder-type"
                        onChange={() => setSaleMode("new")}
                        type="radio"
                        value="new"
                      />
                      New
                    </label>
                  </div>
                </fieldset>
              )}

              <div className="mt-7">
                {previewMode ? (
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    Ordering is disabled in customer preview.
                  </div>
                ) : purchaseContext.kind === "warehouse" ? (
                  <WarehouseProductDetailActions
                    cartPath={purchaseContext.cartPath}
                    cylinderSaleMode={effectiveSaleMode}
                    onExchangeAvailabilityChange={
                      handleWarehouseExchangeAllowed
                    }
                    product={purchaseContext.product}
                    selectedVariantId={selectedVariant.id}
                    warehouseSlug={purchaseContext.warehouseSlug}
                  />
                ) : (
                  <ProductActions
                    actionLabel="Add Cart"
                    brandName={product.brand?.name ?? undefined}
                    categoryName={product.category.name}
                    cylinderSaleMode={
                      hasEmptyPackReturn ? effectiveSaleMode : undefined
                    }
                    key={`${selectedVariant.id}-${effectiveSaleMode}`}
                    orderIncrement={Number(selectedVariant.orderIncrement) || 1}
                    orderMax={
                      selectedVariant.orderMax
                        ? Number(selectedVariant.orderMax)
                        : undefined
                    }
                    orderMin={Number(selectedVariant.orderMin) || 1}
                    product={{
                      id: product.id,
                      image: product.image,
                      inStock: productActionsPurchase?.inStock ?? false,
                      name: product.name,
                      price: selectedPrice,
                      size:
                        hasEmptyPackReturn && effectiveSaleMode === "exchange"
                          ? `${selectedLabel} - Exchange ${isLpg ? "Cylinder" : "Pack"}`
                          : hasEmptyPackReturn
                            ? `${selectedLabel} - New ${isLpg ? "Cylinder" : "Pack"}`
                            : selectedLabel,
                      stockQuantity: productActionsPurchase?.stockQuantity ?? 0,
                    }}
                    purchaseMode={productActionsPurchase?.purchaseMode}
                    shopId={productActionsPurchase?.shopId}
                    secondaryAction={
                      purchaseContext.supportPhone ? (
                        <a
                          className="inline-flex h-12 min-w-28 items-center justify-center gap-2 rounded-md border border-zinc-300 px-5 text-base font-semibold text-zinc-900 hover:bg-zinc-50"
                          href={`tel:${purchaseContext.supportPhone}`}
                        >
                          <Phone aria-hidden="true" className="size-4" />
                          Call
                        </a>
                      ) : (
                        <Link
                          className="inline-flex h-12 min-w-28 items-center justify-center gap-2 rounded-md border border-zinc-300 px-5 text-base font-semibold text-zinc-900 hover:bg-zinc-50"
                          href="/contact"
                          title="Contact support"
                        >
                          <Phone aria-hidden="true" className="size-4" />
                          Call
                        </Link>
                      )
                    }
                    variantId={selectedVariant.id}
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="flex border-b border-zinc-200" role="tablist">
            {(["description", "reviews"] as const).map((tab) => (
              <button
                aria-controls={`${tab}-panel`}
                aria-selected={activeTab === tab}
                className={cn(
                  "border-b-2 px-5 py-3 text-sm font-semibold capitalize transition-colors",
                  activeTab === tab
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-zinc-500 hover:text-zinc-900",
                )}
                id={`${tab}-tab`}
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "description" ? (
            <div
              aria-labelledby="description-tab"
              className="p-5 sm:p-7"
              id="description-panel"
              role="tabpanel"
            >
              <h2 className="text-base font-bold uppercase tracking-wide text-zinc-950">
                Description
              </h2>
              <dl className="mt-5 grid max-w-3xl gap-2 text-sm">
                {descriptionRows.map((row) => (
                  <div
                    className="grid grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)] gap-3"
                    key={row.label}
                  >
                    <dt className="font-medium text-zinc-600">{row.label}</dt>
                    <dd
                      className={cn(
                        "text-zinc-950",
                        row.metric && "font-mono tabular-nums",
                      )}
                    >
                      : {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-8 text-sm font-bold text-zinc-950">
                Short Description
              </h3>
              {product.shortDescription ? (
                <p className="mt-3 max-w-[70ch] text-sm leading-6 text-zinc-700">
                  {product.shortDescription}
                </p>
              ) : product.description ? (
                <p className="mt-3 max-w-[70ch] text-sm leading-6 text-zinc-700">
                  {descriptionToPlainText(product.description)}
                </p>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  No short description available.
                </p>
              )}
            </div>
          ) : (
            <ProductReviewsPanel
              averageRating={reviewStats.averageRating}
              productId={product.id}
              totalReviews={reviewStats.totalReviews}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function ProductReviewsPanel({
  productId,
  averageRating,
  totalReviews,
}: {
  productId: number;
  averageRating: number;
  totalReviews: number;
}) {
  const { data, isLoading } = useProductReviews(productId);

  return (
    <div
      aria-labelledby="reviews-tab"
      className="p-5 sm:p-7"
      id="reviews-panel"
      role="tabpanel"
    >
      <div className="flex flex-wrap items-center gap-3">
        <StarRating rating={Math.round(averageRating)} size="md" />
        <p className="font-mono text-lg font-bold tabular-nums text-zinc-950">
          {averageRating.toFixed(1)} ({totalReviews.toLocaleString("en-BD")}{" "}
          Reviews)
        </p>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (data?.reviews.length ?? 0) > 0 ? (
        <div className="mt-6 divide-y divide-zinc-200">
          {data?.reviews.map((review) => (
            <article className="py-5 first:pt-0" key={review.id}>
              <StarRating rating={review.rating} size="sm" />
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                {review.comment}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex items-center gap-3 text-sm text-zinc-500">
          <Star aria-hidden="true" className="size-5 text-zinc-300" />
          No reviews yet.
        </div>
      )}
    </div>
  );
}
