"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Package,
  Star,
  Store,
  Layers3,
  Tag,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { VariantSelector, VariantInfoCard } from "@/components/catalog/variant-selector";
import { useCoreProductDetail } from "@/hooks/use-catalog-api";

export default function CoreProductDetailPage({
  params,
}: {
  params: Promise<{ coreProductId: string }>;
}) {
  const { coreProductId } = use(params);
  const id = Number(coreProductId);
  const { data, isLoading, isError } = useCoreProductDetail(id);

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  // Set default selected variant when data loads
  if (data && data.variants.length > 0 && selectedVariantId === null) {
    setSelectedVariantId(data.variants[0]!.id);
  }

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Failed to load product details</p>
        </div>
      </div>
    );
  }

  const { coreProduct, variants, brands, sellerCount, reviewStats, products } = data;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;

  // Determine price range
  const prices = variants.map((v) => Number(v.price)).filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // Collect images
  const allImages: string[] = [];
  if (coreProduct.image) allImages.push(coreProduct.image);
  for (const p of products) {
    if (p.image && !allImages.includes(p.image)) allImages.push(p.image);
    for (const img of p.images ?? []) {
      if (img.imageUrl && !allImages.includes(img.imageUrl)) allImages.push(img.imageUrl);
    }
  }
  if (allImages.length === 0) allImages.push("");

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <BackButton />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap">
        {coreProduct.type && (
          <>
            <span className="text-gray-600">{coreProduct.type.name}</span>
            <span className="text-gray-300">›</span>
          </>
        )}
        {coreProduct.category && (
          <>
            <span className="text-gray-600">{coreProduct.category.name}</span>
            <span className="text-gray-300">›</span>
          </>
        )}
        {coreProduct.subCategory && (
          <>
            <span className="text-gray-600">{coreProduct.subCategory.name}</span>
            <span className="text-gray-300">›</span>
          </>
        )}
        <span className="text-gray-900 font-medium">{coreProduct.name}</span>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Image Gallery */}
        <ImageGallery images={allImages} productName={coreProduct.name} />

        {/* Right: Product Info + Variant Selector */}
        <div className="space-y-5">
          {/* Title + SKU */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{coreProduct.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <code className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">
                {coreProduct.sku}
              </code>
              {coreProduct.type && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Layers3 className="h-3 w-3" />
                  {coreProduct.type.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Price Range */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-gray-500">Price Range</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-emerald-700">
                ৳{minPrice.toLocaleString("en-BD")}
              </span>
              {maxPrice !== minPrice && (
                <>
                  <span className="text-lg text-gray-400 mx-1">—</span>
                  <span className="text-3xl font-bold text-emerald-700">
                    ৳{maxPrice.toLocaleString("en-BD")}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-4">
            {/* Review Stats */}
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="font-semibold">{reviewStats.avgRating.toFixed(1)}</span>
              <span className="text-gray-400">({reviewStats.reviewCount} reviews)</span>
            </div>

            {/* Seller Count */}
            <div className="flex items-center gap-1.5 text-sm">
              <Store className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">{sellerCount}</span>
              <span className="text-gray-400">{sellerCount === 1 ? "Seller" : "Sellers"} Available</span>
            </div>

            {/* Brand Count */}
            <div className="flex items-center gap-1.5 text-sm">
              <Tag className="h-4 w-4 text-purple-500" />
              <span className="font-semibold">{brands.length}</span>
              <span className="text-gray-400">{brands.length === 1 ? "Brand" : "Brands"}</span>
            </div>

            {/* Variant Count */}
            <div className="flex items-center gap-1.5 text-sm">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="font-semibold">{variants.length}</span>
              <span className="text-gray-400">{variants.length === 1 ? "Variant" : "Variants"}</span>
            </div>
          </div>

          <Separator />

          {/* Variant Selector */}
          {variants.length > 0 ? (
            <div className="space-y-4">
              <VariantSelector
                variants={variants}
                selectedVariantId={selectedVariantId}
                onSelect={setSelectedVariantId}
              />

              {/* Selected Variant Info */}
              {selectedVariant && (
                <VariantInfoCard variant={selectedVariant} />
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
              <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No variants available yet</p>
            </div>
          )}

          <Separator />

          {/* Description */}
          {coreProduct.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                Description
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{coreProduct.description}</p>
            </div>
          )}

          {/* Product Details */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Details</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {coreProduct.type && (
                <>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-gray-900 font-medium">{coreProduct.type.name}</dd>
                </>
              )}
              {coreProduct.category && (
                <>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="text-gray-900 font-medium">{coreProduct.category.name}</dd>
                </>
              )}
              {coreProduct.subCategory && (
                <>
                  <dt className="text-gray-500">Sub Category</dt>
                  <dd className="text-gray-900 font-medium">{coreProduct.subCategory.name}</dd>
                </>
              )}
              {brands.length > 0 && (
                <>
                  <dt className="text-gray-500">Brands</dt>
                  <dd className="flex flex-wrap gap-1">
                    {brands.map((b) => (
                      <Badge key={b.id} variant="secondary" className="text-xs">
                        {b.name}
                      </Badge>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Image Gallery
// ────────────────────────────────────────────────────────────────

function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeImage = images[activeIdx] || "";

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden aspect-square relative">
        {activeImage ? (
          <Image
            src={activeImage}
            alt={productName}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <Package className="w-16 h-16 text-gray-200" />
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`w-16 h-16 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                idx === activeIdx
                  ? "border-emerald-500 ring-1 ring-emerald-500/30"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {img ? (
                <Image
                  src={img}
                  alt={`${productName} ${idx + 1}`}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Shared Components
// ────────────────────────────────────────────────────────────────

function BackButton() {
  return (
    <Link href="/dashboard/product-catalog">
      <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600 hover:text-gray-900 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Catalog
      </Button>
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-5 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="aspect-square rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-8 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
