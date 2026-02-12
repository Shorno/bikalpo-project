import { ProductsGridClient } from "@/components/features/products/products-grid-client";
import { ProductsFilterClient } from "@/components/features/products/products-filter-client";
import { ProductSearch } from "@/components/features/products/product-search";

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    subcategory?: string;
    brand?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    search?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function CustomerProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50/50 to-white">
      <div className="container mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="mb-8 md:mb-10">
          <div className="max-w-2xl">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Browse Products
            </h1>
            <p className="text-gray-500 text-sm md:text-base">
              Discover our verified wholesale selection
            </p>
          </div>

          {/* Search Bar */}
          <div className="mt-6 max-w-xl">
            <ProductSearch />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Sidebar Filter - Desktop Only */}
          <aside className="hidden lg:block w-full lg:w-64 shrink-0">
            <ProductsFilterClient />
          </aside>

          {/* Products Grid */}
          <main className="flex-1 min-w-0">
            <ProductsGridClient searchParams={params} />
          </main>
        </div>
      </div>
    </div>
  );
}
