/**
 * Client component for product details page using Customer API
 */
"use client";

import { useProductDetails } from "@/hooks/use-customer-api";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProductImageGallery } from "@/components/features/products/product-image-gallery";
import { ProductActions } from "@/components/features/products/product-actions";
import { ProductSpecs } from "@/components/features/products/product-specs";
import { RelatedProducts } from "@/components/features/products/related-products";
import { ProductReviews } from "@/components/features/reviews/product-reviews";

interface ProductDetailClientProps {
  slug: string;
  category: string;
}

export function ProductDetailClient({
  slug,
  category,
}: ProductDetailClientProps) {
  const { data, isLoading, isError } = useProductDetails(slug);

  useEffect(() => {
    if (isError) {
      notFound();
    }
  }, [isError]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-3">
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-[500px] w-full" />
            <div className="space-y-6">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.product) {
    return null;
  }

  const product = data.product;
  const productAny = product as any;

  // Combine main image with additional images
  const allImages = [
    product.image,
    ...(product.images?.map((img: any) => img.imageUrl) || []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/customer"
              className="text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Link
              href="/customer/products"
              className="text-gray-600 hover:text-gray-900"
            >
              Products
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 font-medium">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8">
            {/* Image Gallery */}
            <ProductImageGallery
              images={allImages}
              productName={product.name}
            />

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  {product.name}
                </h1>
                {product.description && (
                  <p className="text-gray-600 leading-relaxed">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Product Actions (Add to Cart, etc.) */}
              <ProductActions product={productAny} />

              {/* Product Specifications */}
              <ProductSpecs
                categoryName={productAny.category?.name || ""}
                brandName={productAny.brand?.name || null}
                productSize={product.size}
                subCategoryName={productAny.subCategory?.name || null}
                features={productAny.features}
                variants={productAny.variants || []}
              />
            </div>
          </div>

          {/* Reviews Section */}
          <div className="border-t">
            <ProductReviews productId={product.id} />
          </div>
        </div>

        {/* Related Products */}
        <div className="mt-12">
          <RelatedProducts
            categoryId={product.categoryId}
            currentProductId={product.id}
          />
        </div>
      </div>
    </div>
  );
}
