import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCategoryBySlug } from "@/actions/products/get-category-by-slug";
import { ProductsFilter } from "@/components/features/products/products-filter";
import { ProductsGrid } from "@/components/features/products/products-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const revalidate = 3600;

interface CategoryProductsPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    subcategory?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    search?: string;
    page?: string;
    limit?: string;
  }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryProductsPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const filters = await searchParams;

  const category = await getCategoryBySlug(categorySlug);

  if (!category) {
    return {
      title: "Category Not Found",
    };
  }

  let title = category.name;
  if (filters.subcategory) {
    const capitalizedSubcategory =
      filters.subcategory.charAt(0).toUpperCase() +
      filters.subcategory.slice(1);
    title += ` - ${capitalizedSubcategory}`;
  }
  if (filters.search) {
    title += ` - Search: ${filters.search}`;
  }

  return {
    title: title,
    description: `Explore our ${category.name.toLowerCase()} collection. Find the best products in this category.`,
  };
}

export default async function CustomerCategoryProductsPage({
  params,
  searchParams,
}: CategoryProductsPageProps) {
  const { category: categorySlug } = await params;
  const filters = await searchParams;

  const category = await getCategoryBySlug(categorySlug);

  if (!category) {
    notFound();
  }

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
          <Suspense fallback={<FilterSkeleton />}>
            <ProductsFilter categorySlug={categorySlug} />
          </Suspense>
        </aside>

        {/* Products Grid */}
        <main className="flex-1">
          <Suspense fallback={<ProductsGridSkeleton />}>
            <ProductsGrid
              searchParams={{ ...filters, category: categorySlug }}
            />
          </Suspense>
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
