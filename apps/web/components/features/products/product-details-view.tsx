import type { ProductFeatureGroup } from "@bikalpo-project/db/schema";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import { ProductReviews } from "../reviews/product-reviews";
import { ProductImageGallery } from "./product-image-gallery";
import type { DetailVariant } from "./trade-product-detail-client";
import { ProductDetailClient } from "./trade-product-detail-client";

interface ProductDetailsViewProps {
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
    images: string[];
    size: string;
    description: string | null;
    features: ProductFeatureGroup[] | null;
    inStock: boolean;
    stockQuantity: number;
    category: { name: string; slug: string };
    subCategory?: { name: string } | null;
    brand?: { name: string } | null;
  };
  variants: DetailVariant[];
  breadcrumbs: Array<{ label: string; href?: string }>;
  categoryHref: string;
  purchaseMode: "open_order" | "direct";
  directShopId?: string;
  previewMode?: boolean;
  relatedProducts?: ReactNode;
}

export function ProductDetailsView({
  product,
  variants,
  breadcrumbs,
  categoryHref,
  purchaseMode,
  directShopId,
  previewMode = false,
  relatedProducts,
}: ProductDetailsViewProps) {
  const allImages = [product.image, ...product.images];

  return (
    <div className="min-h-screen bg-gray-50">
      {previewMode && <CustomerPreviewBanner />}

      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div
                className="contents"
                key={`${crumb.label}-${crumb.href ?? index}`}
              >
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="max-w-[200px] truncate font-medium text-gray-900">
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-6 shadow-sm lg:p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <ProductImageGallery
              images={allImages}
              productName={product.name}
            />

            <div className="flex flex-col">
              <div className="mb-2">
                <Link
                  href={categoryHref}
                  className="inline-block rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                >
                  {product.category.name}
                </Link>
                {product.subCategory && (
                  <span className="ml-2 text-xs text-gray-500">
                    / {product.subCategory.name}
                  </span>
                )}
                {product.brand && (
                  <span className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                    {product.brand.name}
                  </span>
                )}
              </div>

              <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">
                  {product.name}
                </h1>
              </div>

              <ProductDetailClient
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image: product.image,
                  size: product.size,
                  inStock: product.inStock,
                  stockQuantity: product.stockQuantity,
                }}
                variants={variants}
                categoryName={product.category.name}
                brandName={product.brand?.name}
                subCategoryName={product.subCategory?.name}
                productSize={product.size}
                features={product.features}
                previewMode={previewMode}
                purchaseMode={purchaseMode}
                directShopId={directShopId}
              />

              <div className="mt-8 border-t pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <TrustBadge label="Quality Assured">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </TrustBadge>
                  <TrustBadge label="Fast Delivery">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </TrustBadge>
                  <TrustBadge label="Secure Payment">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </TrustBadge>
                  <TrustBadge label="24/7 Support">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </TrustBadge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {product.description && (
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm lg:p-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Product Description
            </h2>
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        )}

        {product.features && product.features.length > 0 && (
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm lg:p-8">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Product Features
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {product.features.map((group, groupIndex) => (
                <div
                  key={`${group.title}-${groupIndex}`}
                  className="overflow-hidden rounded-lg border"
                >
                  <div className="border-b bg-gray-50 px-4 py-3">
                    <h3 className="font-medium text-gray-900">{group.title}</h3>
                  </div>
                  <div className="divide-y">
                    {group.items.map((item, itemIndex) => (
                      <div
                        key={`${item.key}-${itemIndex}`}
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

        <ProductReviews productId={product.id} readOnly={previewMode} />
        {relatedProducts}
      </div>
    </div>
  );
}

function TrustBadge({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
        <svg
          aria-hidden="true"
          className="h-5 w-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {children}
        </svg>
      </div>
      <span>{label}</span>
    </div>
  );
}
