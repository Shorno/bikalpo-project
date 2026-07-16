import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductsFilter } from "@/components/features/products/products-filter";
import { ProductsGrid } from "@/components/features/products/products-grid";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { isCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { getActiveCategories, getCategoryBySlug } from "@/lib/public-data";

export const revalidate = 600;
export const dynamicParams = true;

interface CategoryProductsPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    subcategory?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    search?: string;
    preview?: string;
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
    openGraph: {
      title: title,
      description: `Explore our ${category.name.toLowerCase()} collection`,
    },
  };
}

export async function generateStaticParams() {
  try {
    const categories = await getActiveCategories(revalidate);

    return categories.map((category) => ({
      category: category.slug,
    }));
  } catch {
    return [];
  }
}

export default async function CategoryProductsPage({
  params,
  searchParams,
}: CategoryProductsPageProps) {
  const { category: categorySlug } = await params;
  const filters = await searchParams;
  const previewMode = isCustomerStorefrontPreview(filters.preview);
  const { preview: _preview, ...catalogFilters } = filters;

  const category = await getCategoryBySlug(categorySlug, revalidate);

  if (!category) {
    notFound();
  }

  return (
    <div>
      {previewMode && <CustomerPreviewBanner />}
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-serif font-light mb-2">
            {category.name}
          </h1>
          <p className="opacity-60">
            Explore our {category.name.toLowerCase()} collection
          </p>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filter - Desktop Only */}
          <aside className="hidden lg:block w-full lg:w-64 flex-shrink-0">
            <Suspense fallback={<FilterSkeleton />}>
              <ProductsFilter categorySlug={categorySlug} />
            </Suspense>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            <Suspense fallback={<ProductsGridSkeleton />}>
              <ProductsGrid
                searchParams={{
                  ...catalogFilters,
                  category: categorySlug,
                }}
                previewMode={previewMode}
              />
            </Suspense>
          </main>
        </div>
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
