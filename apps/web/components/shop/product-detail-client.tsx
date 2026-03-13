/**
 * Shop product details page — client-side data fetching version
 * of the public product detail page. Reuses the same shared components
 * (variant selector, image gallery, specs, cart) with client-side hooks.
 */
"use client";

import { ChevronRight, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductDetailClient as VariantDetailClient } from "@/components/features/products/product-detail-client";
import { ProductCard } from "@/components/features/products/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductReviews } from "@/hooks/use-customer-api";
import {
  useRoleAwareProducts,
  useRoleAwareProductDetails,
} from "@/hooks/use-role-aware-products";

interface ShopProductDetailProps {
  slug: string;
  category: string;
}

export function ProductDetailClient({
  slug,
  category,
}: ShopProductDetailProps) {
  const { data, isLoading, isError } = useRoleAwareProductDetails(slug);

  useEffect(() => {
    if (isError) {
      notFound();
    }
  }, [isError]);

  if (isLoading) return <ProductDetailSkeleton />;

  if (!data?.product) return null;

  const product = data.product;
  const variants = data.variants ?? [];
  const normalizedVariants = variants.map((variant) => ({
    ...variant,
    price: String(variant.price),
  }));

  // Combine main image with additional images
  const allImages = [
    product.image,
    ...(product.images?.map((img: { imageUrl: string }) => img.imageUrl) || []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Link
              href="/products"
              className="text-gray-600 hover:text-gray-900"
            >
              Products
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            {product.category && (
              <>
                <Link
                  href={`/products/${product.category.slug}`}
                  className="text-gray-600 hover:text-gray-900"
                >
                  {product.category.name}
                </Link>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </>
            )}
            <span className="text-gray-900 font-medium truncate max-w-[200px]">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      {/* Product Details Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Product Images — client-side gallery */}
            <ShopImageGallery images={allImages} productName={product.name} />

            {/* Product Info — variant selector, price, specs, cart */}
            <div className="flex flex-col">
              {/* Category Badge */}
              <div className="mb-2">
                <Link
                  href={`/products/${product.category?.slug}`}
                  className="inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                >
                  {product.category?.name}
                </Link>
                {product.subCategory && (
                  <span className="ml-2 text-xs text-gray-500">
                    / {product.subCategory.name}
                  </span>
                )}
              </div>

              {/* Product Name */}
              <div className="mb-4">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {product.name}
                </h1>
              </div>

              {/* Variant-aware price, selector, specs, and cart */}
              <VariantDetailClient
                product={{
                  id: product.id,
                  name: product.name,
                  price: String(product.price),
                  image: product.image,
                  size: product.size,
                  inStock: product.inStock,
                  stockQuantity: product.stockQuantity,
                }}
                variants={normalizedVariants}
                categoryName={product.category?.name || ""}
                brandName={product.brand?.name}
                subCategoryName={product.subCategory?.name}
                productSize={product.size}
                features={product.features}
              />

              {/* Trust Badges */}
              <div className="mt-8 pt-6 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span>Quality Assured</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <span>Fast Delivery</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                    <span>Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <span>24/7 Support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        {product.description && (
          <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8 mt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Product Description
            </h2>
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        )}

        {/* Features Section */}
        {product.features &&
          Array.isArray(product.features) &&
          product.features.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Product Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(
                  product.features as {
                    title: string;
                    items: { key: string; value: string }[];
                  }[]
                ).map((group, groupIndex) => (
                  <div
                    key={groupIndex}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div className="bg-gray-50 px-4 py-3 border-b">
                      <h3 className="font-medium text-gray-900">
                        {group.title}
                      </h3>
                    </div>
                    <div className="divide-y">
                      {group.items.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="flex justify-between px-4 py-3 hover:bg-gray-50"
                        >
                          <span className="text-gray-600">{item.key}</span>
                          <span className="font-medium text-gray-900">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Reviews Section */}
        <ShopProductReviews productId={product.id} />

        {/* Related Products */}
        <ShopRelatedProducts
          categorySlug={product.category?.slug || category}
          currentProductId={product.id}
        />
      </div>
    </div>
  );
}

// ── Image Gallery (client-side) ───────────────────────────────

function ShopImageGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const [selectedImage, setSelectedImage] = useState(0);

  return (
    <div className="space-y-4">
      <div className="aspect-square relative overflow-hidden bg-gray-100 rounded-lg">
        <Image
          src={images[selectedImage]}
          alt={productName}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedImage(idx)}
              className={`shrink-0 w-16 h-16 relative rounded-md overflow-hidden border-2 transition-colors ${
                selectedImage === idx ? "border-primary" : "border-gray-200"
              }`}
            >
              <Image
                src={img}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reviews (client-side) ─────────────────────────────────────

function ShopProductReviews({ productId }: { productId: number }) {
  const { data, isLoading } = useProductReviews(productId);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const reviews = data?.reviews ?? [];
  type ProductReviewItem = (typeof reviews)[number];
  const stats = data?.stats;

  if (reviews.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8 mt-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Customer Reviews ({stats?.totalReviews ?? 0})
        </h2>
        {stats && stats.averageRating > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${
                    i < Math.round(stats.averageRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-700">
              {stats.averageRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 divide-y">
        {reviews.map((review: ProductReviewItem) => (
          <div key={review.id} className="pt-4 first:pt-0">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-medium text-sm shrink-0">
                {review.user?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-gray-900">
                    {review.user?.name || "Anonymous"}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < review.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {review.title && (
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {review.title}
                  </p>
                )}
                <p className="text-sm text-gray-600">{review.comment}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Related Products (client-side) ────────────────────────────

function ShopRelatedProducts({
  categorySlug,
  currentProductId,
}: {
  categorySlug: string;
  currentProductId: number;
}) {
  const { data, isLoading } = useRoleAwareProducts({
    category: categorySlug,
    limit: "8",
    sort: "newest",
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <Skeleton className="h-6 w-40 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const relatedProducts = (data?.products ?? [])
    .filter((prod) => prod.id !== currentProductId)
    .slice(0, 4);

  if (relatedProducts.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8 mt-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Related Products
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {relatedProducts.map((prod) => (
          <ProductCard key={prod.id} product={prod} />
        ))}
      </div>
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────

function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
