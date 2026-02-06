import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductSearch } from "@/components/features/products/product-search";
import { PublicProductsFilter } from "@/components/features/products/public-products-filter";
import { PublicProductsGrid } from "@/components/features/products/public-products-grid";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    subcategory?: string;
    brand?: string;
    sort?: string;

    search?: string;
    page?: string;
    limit?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Products",
  description: "Browse our premium selection of products",
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50/50 to-white">
      <div className="custom-container py-6 md:py-10">
        <div className="px-4 md:px-6">
          {/* Hero Header */}
          <div className="mb-8 md:mb-10">
            <div className="max-w-2xl">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                All Products
              </h1>
              <p className="text-gray-500 text-sm md:text-base">
                Discover our curated collection of premium products
              </p>
            </div>

            {/* Search Bar */}
            <div className="mt-6 max-w-xl">
              <Suspense fallback={<Skeleton className="h-10 w-full" />}>
                <ProductSearch />
              </Suspense>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Sidebar Filter - Desktop Only */}
            <aside className="hidden lg:block w-full lg:w-64 shrink-0">
              <Suspense fallback={<FilterSkeleton />}>
                <PublicProductsFilter />
              </Suspense>
            </aside>

            {/* Products Grid */}
            <main className="flex-1 min-w-0">
              <Suspense fallback={<ProductsGridSkeleton />}>
                <PublicProductsGrid searchParams={params} />
              </Suspense>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <Skeleton className="h-6 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function ProductsGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
