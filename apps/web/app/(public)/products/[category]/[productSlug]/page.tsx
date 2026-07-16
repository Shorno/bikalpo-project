import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/features/products/product-detail-client";
import { ProductImageGallery } from "@/components/features/products/product-image-gallery";
import { RelatedProducts } from "@/components/features/products/related-products";
import { ProductReviews } from "@/components/features/reviews/product-reviews";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { getProductBySlug } from "@/lib/public-data";

export const revalidate = 30;

interface ProductDetailsPageProps {
  params: Promise<{ category: string; productSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductDetailsPageProps) {
  const { productSlug } = await params;
  const query = await searchParams;
  const previewMode = isCustomerStorefrontPreview(query.preview);
  const productData = await getProductBySlug(productSlug, 30);
  const product = productData?.product;
  const variants = productData?.variants;
  const normalizedVariants = (variants ?? []).map((variant) => ({
    ...variant,
    price: String(variant.price),
  }));

  if (!product) {
    notFound();
  }

  // Combine main image with additional images
  const allImages = [
    product.image,
    ...(product.images?.map((img) => img.imageUrl) || []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {previewMode && <CustomerPreviewBanner />}
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Link
              href={withCustomerStorefrontPreview("/products", previewMode)}
              className="text-gray-600 hover:text-gray-900"
            >
              Products
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Link
              href={withCustomerStorefrontPreview(
                `/products/${product.category.slug}`,
                previewMode,
              )}
              className="text-gray-600 hover:text-gray-900"
            >
              {product.category.name}
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-400" />
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
            {/* Product Images */}
            <ProductImageGallery
              images={allImages}
              productName={product.name}
            />

            {/* Product Info — client component handles variant selection, price, specs, cart */}
            <div className="flex flex-col">
              {/* Category Badge */}
              <div className="mb-2">
                <Link
                  href={withCustomerStorefrontPreview(
                    `/products/${product.category.slug}`,
                    previewMode,
                  )}
                  className="inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                >
                  {product.category.name}
                </Link>
                {product.subCategory && (
                  <span className="ml-2 text-xs text-gray-500">
                    / {product.subCategory.name}
                  </span>
                )}
                {product.brand && (
                  <span className="ml-2 inline-block text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                    {product.brand.name}
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
              <ProductDetailClient
                product={{
                  id: product.id,
                  name: product.name,
                  price: String(product.price),
                  image: product.image,
                  size: product.size,
                  inStock: product.inStock,
                  stockQuantity: 0,
                }}
                variants={normalizedVariants}
                categoryName={product.category.name}
                brandName={product.brand?.name}
                subCategoryName={product.subCategory?.name}
                productSize={product.size}
                features={product.features}
                previewMode={previewMode}
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

        {/* Product Reviews */}
        <ProductReviews productId={product.id} readOnly={previewMode} />

        {/* Related Products */}
        <RelatedProducts
          categorySlug={product.category.slug}
          currentProductId={product.id}
          previewMode={previewMode}
        />
      </div>
    </div>
  );
}
