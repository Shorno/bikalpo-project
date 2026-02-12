/**
 * Client component for category products page using Customer API
 */
"use client";

import { useCategoryBySlug } from "@/hooks/use-customer-api";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";
import { useEffect } from "react";
import { ProductsFilterClient } from "@/components/features/products/products-filter-client";
import { ProductsGridClient } from "@/components/features/products/products-grid-client";

interface CategoryPageClientProps {
  categorySlug: string;
  searchParams: {
    subcategory?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    search?: string;
    page?: string;
    limit?: string;
  };
}

export function CategoryPageClient({
  categorySlug,
  searchParams,
}: CategoryPageClientProps) {
  const { data, isLoading, isError } = useCategoryBySlug(categorySlug);

  useEffect(() => {
    if (isError) {
      notFound();
    }
  }, [isError]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block w-full lg:w-64 shrink-0">
            <FilterSkeleton />
          </aside>
          <main className="flex-1">
            <ProductsGridSkeleton />
          </main>
        </div>
      </div>
    );
  }

  if (!data?.category) {
    return null;
  }

  const category = data.category;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          {category.name}
        </h1>
        <p className="text-gray-500">
          Explore our {category.name.toLowerCase()} collection
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filter - Desktop Only */}
        <aside className="hidden lg:block w-full lg:w-64 shrink-0">
          <ProductsFilterClient categorySlug={categorySlug} />
        </aside>

        {/* Products Grid */}
        <main className="flex-1">
          <ProductsGridClient
            searchParams={{ ...searchParams, category: categorySlug }}
          />
        </main>
      </div>
    </div>
  );
}

function FilterSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ProductsGridSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full" />
        ))}
      </div>
    </div>
  );
}
