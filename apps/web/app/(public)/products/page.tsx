import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductSearch } from "@/components/features/products/product-search";
import { PublicProductsFilter } from "@/components/features/products/public-products-filter";
import { PublicProductsGrid } from "@/components/features/products/public-products-grid";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { isCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    subcategory?: string;
    brand?: string;
    sort?: string;
    search?: string;
    page?: string;
    limit?: string;
    preview?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Products",
  description: "Browse active products available through Bikalpo.",
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;
  const previewMode = isCustomerStorefrontPreview(params.preview);
  const { preview: _preview, ...catalogParams } = params;

  return (
    <div className="min-h-screen bg-[oklch(0.985_0.004_260)]">
      {previewMode && <CustomerPreviewBanner />}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <header className="border-b border-border pb-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            Public catalog
          </p>
          <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                Products
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
                Search the active catalog and narrow results by category or
                brand.
              </p>
            </div>

            <div className="w-full md:max-w-md">
              <Suspense
                fallback={<Skeleton className="h-10 w-full rounded-md" />}
              >
                <ProductSearch />
              </Suspense>
            </div>
          </div>
        </header>

        <div className="mt-8 flex flex-col gap-7 lg:flex-row lg:gap-8">
          <aside className="hidden w-full shrink-0 lg:block lg:w-64">
            <Suspense fallback={<FilterSkeleton />}>
              <PublicProductsFilter categorySlug={params.category} />
            </Suspense>
          </aside>

          <main className="min-w-0 flex-1">
            <Suspense fallback={<ProductsGridSkeleton />}>
              <PublicProductsGrid
                searchParams={catalogParams}
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
    <div className="space-y-4 rounded-md border bg-background p-4">
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
      <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border bg-white">
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
