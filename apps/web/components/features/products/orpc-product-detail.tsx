/**
 * ORPC-powered Product Detail — client component that fetches product
 * details via the public ORPC router.
 */
"use client";

import { ChevronRight, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddToCart, useProductReviews } from "@/hooks/use-customer-api";
import { useRoleAwareProductDetails } from "@/hooks/use-role-aware-products";

interface OrpcProductDetailProps {
  slug: string;
  categorySlug?: string;
}

export function OrpcProductDetail({
  slug,
  categorySlug,
}: OrpcProductDetailProps) {
  const { data, isLoading, isError, error } = useRoleAwareProductDetails(slug);
  const addToCart = useAddToCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  if (isLoading) return <ProductDetailSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Product not found
        </h3>
        <p className="text-sm text-gray-500">
          {error?.message || "Unable to load product"}
        </p>
        <Link href="/products" className="mt-4">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>
    );
  }

  const product = data!.product;
  const variants = data!.variants;
  const reviewStats = data!.reviewStats;
  type ProductImageItem = NonNullable<typeof product.images>[number];
  type ProductVariantItem = (typeof variants)[number];

  const allImages = [
    product.image,
    ...(product.images?.map((img: ProductImageItem) => img.imageUrl) || []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Home
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
                  href={`/products?category=${product.category.slug}`}
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

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-square relative overflow-hidden bg-gray-100 rounded-lg">
                <Image
                  src={allImages[selectedImage]}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {allImages.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImage(idx)}
                      className={`shrink-0 w-16 h-16 relative rounded-md overflow-hidden border-2 transition-colors ${
                        selectedImage === idx
                          ? "border-primary"
                          : "border-gray-200"
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

            {/* Product Info */}
            <div className="flex flex-col">
              {/* Category */}
              <div className="mb-2 flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  {product.category?.name}
                </Badge>
                {product.subCategory && (
                  <span className="text-xs text-gray-500">
                    / {product.subCategory.name}
                  </span>
                )}
              </div>

              {/* Name */}
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>


              {/* Reviews summary */}
              {reviewStats.totalReviews > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.round(reviewStats.averageRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">
                    ({reviewStats.totalReviews} review
                    {reviewStats.totalReviews > 1 ? "s" : ""})
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">
                  ৳{Number(product.price).toLocaleString("en-BD")}
                </span>
                <span className="text-gray-500 ml-2">/ {product.size}</span>
              </div>

              {/* Stock */}
              <div className="mb-6">
                {product.inStock && product.stockQuantity > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2" />
                    In Stock
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                    Out of Stock
                  </span>
                )}
              </div>

              {/* Variants */}
              {variants && variants.length > 0 && (
                <div className="mb-6 space-y-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    Available Variants
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v: ProductVariantItem) => (
                      <div
                        key={v.id}
                        className="border rounded-md px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{v.unitLabel}</span>
                        <span className="text-gray-500 ml-1">
                          — ৳{Number(v.price).toLocaleString("en-BD")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add to Cart */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center border rounded-md">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 font-medium min-w-[40px] text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={!product.inStock || addToCart.isPending}
                  onClick={() =>
                    addToCart.mutate({ productId: product.id, quantity })
                  }
                >
                  {addToCart.isPending ? "Adding..." : "Add to Cart"}
                </Button>
              </div>

              {/* Description */}
              {product.description && (
                <div className="pt-6 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Description
                  </h3>
                  <div
                    className="prose prose-sm prose-gray max-w-none"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <OrpcProductReviews productId={product.id} />
      </div>
    </div>
  );
}

function OrpcProductReviews({ productId }: { productId: number }) {
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

function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
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
