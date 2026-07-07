"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  MessageSquare,
  Pencil,
  Truck,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StarRating } from "@/components/features/reviews/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type FeatureItem = { key: string; value: string };
type FeatureGroup = { title: string; items: FeatureItem[] };

type VariantOption = {
  id: number;
  name: string;
  unit?: string | null;
  size?: string | null;
  variantType?: string | null;
};

type VariantPrice = {
  id: number;
  consumerPrice?: string | number | null;
  isActive?: boolean | null;
  variantOption?: VariantOption | null;
};

type DetailProduct = {
  id: number;
  name: string;
  slug: string;
  sku?: string | null;
  price: string | number;
  size?: string | null;
  image: string;
  images?: { imageUrl: string }[];
  shortDescription?: string | null;
  description?: string | null;
  features?: FeatureGroup[] | null;
  inStock?: boolean;
  isFeatured?: boolean;
  category?: { name: string; slug: string } | null;
  subCategory?: { name: string } | null;
  brand?: { name: string } | null;
  productBrands?: { brand?: { name: string } | null }[];
  variantPrices?: VariantPrice[];
};

type ReviewUser = { name?: string | null };
type Review = {
  id: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  isVerifiedPurchase?: boolean | null;
  createdAt: string | Date;
  user?: ReviewUser | null;
};

type ReviewStats = { averageRating: number; totalReviews: number };

const LISTING_URL = "/dashboard/admin/web-view";

function formatBDT(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function variantLabel(option?: VariantOption | null) {
  if (!option) return "Variant";
  return option.name?.trim() || option.size?.trim() || "Variant";
}

export function WebViewDetailClient({
  product,
  reviews,
  stats,
}: {
  product: DetailProduct;
  reviews: Review[];
  stats: ReviewStats;
}) {
  const activeVariants = useMemo(
    () =>
      (product.variantPrices ?? []).filter(
        (variant) => variant.isActive !== false,
      ),
    [product.variantPrices],
  );

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    activeVariants[0]?.id ?? null,
  );
  const [activeImage, setActiveImage] = useState(0);

  const selectedVariant =
    activeVariants.find((variant) => variant.id === selectedVariantId) ?? null;

  const images = useMemo(() => {
    const all = [
      product.image,
      ...(product.images?.map((img) => img.imageUrl) ?? []),
    ].filter((src): src is string => Boolean(src));
    return Array.from(new Set(all));
  }, [product.image, product.images]);

  const brandName =
    product.brand?.name ??
    product.productBrands?.find((link) => link.brand?.name)?.brand?.name ??
    "Unbranded";

  const sku = product.sku?.trim() || `PRD-${product.id}`;
  const priceValue = selectedVariant?.consumerPrice ?? product.price;
  const priceLabel = formatBDT(priceValue) ?? "Price not set";
  const priceUnit =
    selectedVariant?.variantOption?.unit?.trim() || product.size || null;

  const features = (product.features ?? []).filter(
    (group) => group?.items?.length,
  );
  const hasDescription = Boolean(
    features.length || product.shortDescription || product.description,
  );

  const categoryName = product.category?.name ?? "Uncategorized";
  const storefrontHref = product.category?.slug
    ? `/products/${product.category.slug}/${product.slug}`
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={LISTING_URL} className="hover:text-foreground">
          Web View
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{categoryName}</span>
        {product.subCategory?.name ? (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{product.subCategory.name}</span>
          </>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{brandName}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{sku}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={LISTING_URL}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {product.name}
            </h1>
            <p className="text-xs text-muted-foreground">{sku}</p>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="grid gap-6 rounded-xl border bg-card p-5 shadow-sm lg:grid-cols-2 lg:gap-8 lg:p-6">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/30">
            {images.length > 0 ? (
              <Image
                src={images[activeImage] ?? images[0]}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-contain p-4"
                unoptimized={images[activeImage]?.startsWith("http") ?? false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-14 w-14 text-muted-foreground/30" />
              </div>
            )}
            {product.isFeatured ? (
              <Badge className="absolute left-3 top-3 bg-slate-900/90 text-white">
                Featured
              </Badge>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted/40 transition-colors",
                    index === activeImage
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/20",
                  )}
                >
                  <Image
                    src={src}
                    alt={`${product.name} ${index + 1}`}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                    unoptimized={src.startsWith("http")}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {brandName}
          </p>
          <h2 className="mt-1 text-xl font-semibold leading-snug">
            {product.name}
          </h2>

          {/* Rating */}
          <div className="mt-2 flex items-center gap-2">
            {stats.totalReviews > 0 ? (
              <>
                <StarRating
                  rating={Math.round(stats.averageRating)}
                  size="sm"
                />
                <span className="text-sm font-medium">
                  {stats.averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({stats.totalReviews}{" "}
                  {stats.totalReviews === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                No reviews yet
              </span>
            )}
          </div>

          {/* Price */}
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {priceLabel}
            </span>
            {priceUnit ? (
              <span className="text-sm text-muted-foreground">
                / {priceUnit}
              </span>
            ) : null}
          </div>

          <div className="my-5 border-t" />

          {/* Key facts */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Fact label="Product ID" value={sku} />
            <Fact label="Brand" value={brandName} />
            <Fact
              label="Category"
              value={
                product.subCategory?.name
                  ? `${categoryName} / ${product.subCategory.name}`
                  : categoryName
              }
            />
            <Fact
              label="Availability"
              value={product.inStock === false ? "Out of Stock" : "In Stock"}
              tone={product.inStock === false ? "muted" : "positive"}
            />
          </dl>

          {/* Variants */}
          {activeVariants.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Variants
              </p>
              <div className="flex flex-wrap gap-2">
                {activeVariants.map((variant) => {
                  const selected = variant.id === selectedVariantId;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={cn(
                        "flex flex-col items-start rounded-lg border px-3 py-1.5 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-foreground/20",
                      )}
                    >
                      <span className="text-sm font-medium">
                        {variantLabel(variant.variantOption)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatBDT(variant.consumerPrice) ?? "No price"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Delivery info */}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Truck className="h-4 w-4" />
              Home Delivery Available
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              Cash on Delivery
            </span>
          </div>

          {/* Actions */}
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            {storefrontHref ? (
              <Button asChild>
                <a href={storefrontHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View on Storefront
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/dashboard/admin/products/${product.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit Product
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="description">
        <TabsList className="h-11 w-full max-w-md p-1">
          <TabsTrigger value="description" className="text-sm">
            Description
          </TabsTrigger>
          <TabsTrigger value="reviews" className="text-sm">
            Reviews
            {stats.totalReviews > 0 ? (
              <span className="ml-1 text-muted-foreground">
                ({stats.totalReviews})
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Description */}
        <TabsContent value="description" className="mt-4">
          <div className="space-y-6 rounded-xl border bg-card p-5 shadow-sm lg:p-6">
            {hasDescription ? (
              <>
                {features.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {features.map((group) => (
                      <SpecGroup key={group.title} group={group} />
                    ))}
                  </div>
                ) : null}

                {product.shortDescription ? (
                  <div>
                    <h3 className="text-sm font-semibold">Short Description</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {product.shortDescription}
                    </p>
                  </div>
                ) : null}

                {product.description ? (
                  <div>
                    <h3 className="text-sm font-semibold">Description</h3>
                    <div
                      className="prose prose-sm mt-1.5 max-w-none text-muted-foreground"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: product description is admin-authored rich text
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No description or specifications have been added for this
                product.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews" className="mt-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm lg:p-6">
            <div className="flex items-center gap-5 border-b pb-5">
              <div className="text-center">
                <p className="text-4xl font-bold leading-none">
                  {stats.averageRating.toFixed(1)}
                </p>
                <div className="mt-2 flex justify-center">
                  <StarRating
                    rating={Math.round(stats.averageRating)}
                    size="sm"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {stats.totalReviews}{" "}
                  {stats.totalReviews === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>

            {reviews.length > 0 ? (
              <div className="divide-y">
                {reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">No reviews yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This product has not received any customer reviews.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fact({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "muted";
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 font-medium",
          tone === "positive" && "text-emerald-600",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SpecGroup({ group }: { group: FeatureGroup }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-medium">
        {group.title}
      </div>
      <dl className="divide-y">
        {group.items.map((item) => (
          <div
            key={`${item.key}-${item.value}`}
            className="flex justify-between gap-4 px-4 py-2.5 text-sm"
          >
            <dt className="text-muted-foreground">{item.key}</dt>
            <dd className="text-right font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const name = review.user?.name?.trim() || "Anonymous";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex gap-3 py-4 first:pt-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            {review.isVerifiedPurchase ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                Verified
              </Badge>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(review.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StarRating rating={review.rating} size="sm" />
          {review.title ? (
            <span className="text-sm font-medium">{review.title}</span>
          ) : null}
        </div>
        {review.comment ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {review.comment}
          </p>
        ) : null}
      </div>
    </div>
  );
}
