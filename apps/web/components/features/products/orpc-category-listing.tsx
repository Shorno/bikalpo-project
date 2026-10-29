/**
 * ORPC-powered Category Listing for the home page.
 * Fetches categories-with-products via ORPC and renders product cards in sections.
 */
"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  CatalogProductCardSkeleton,
  CatalogProductGrid,
} from "@/components/features/products/catalog-product-grid";
import { ConsumerProductCard } from "@/components/features/products/consumer-product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategoriesWithProducts } from "@/hooks/use-customer-api";

interface OrpcCategoryListingProps {
  /** Max categories to show (default all) */
  limit?: number;
  /** Link prefix – defaults to /products */
  basePath?: string;
}

export function OrpcCategoryListing({
  limit,
  basePath = "/products",
}: OrpcCategoryListingProps) {
  const { data, isLoading, isError } = useCategoriesWithProducts(limit);

  if (isLoading) return <CategoryListingSkeleton />;

  if (isError) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Unable to load categories.
      </div>
    );
  }

  const categories = data?.categories ?? [];
  type CategorySection = (typeof categories)[number];

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No categories available yet.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {categories.map((cat: CategorySection) => (
        <section key={cat.id}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{cat.name}</h2>
            </div>
            <Link
              href={`${basePath}?category=${cat.slug}`}
              className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Link>
          </div>

          {cat.products && cat.products.length > 0 ? (
            <CatalogProductGrid>
              {cat.products.map((product) => (
                <ConsumerProductCard key={product.id} product={product} />
              ))}
            </CatalogProductGrid>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm border rounded-lg bg-gray-50">
              No products in this category yet.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CategoryListingSkeleton() {
  return (
    <div className="space-y-10">
      {[1, 2, 3].map((i) => (
        <section key={i}>
          <div className="flex justify-between mb-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <CatalogProductGrid>
            {[1, 2, 3, 4, 5].map((j) => (
              <CatalogProductCardSkeleton key={j} />
            ))}
          </CatalogProductGrid>
        </section>
      ))}
    </div>
  );
}
