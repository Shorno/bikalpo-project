import { Package } from "lucide-react";
import { getActiveBrands } from "@/actions/brand/get-brands";
import { getActiveCategories } from "@/actions/products/get-active-categories";
import { getProductsWithQuery } from "@/actions/products/get-product-with-query";
import { getSubCategoriesByCategory } from "@/actions/products/get-subcategories-by-category";
import { ProductPagination } from "@/components/features/products/product-pagination";
import { PublicProductCard } from "@/components/features/products/public-product-card";
import { PublicProductsSort } from "@/components/features/products/public-products-sort";
import type { ProductWithRelations } from "@/db/schema";

interface PublicProductsGridProps {
  searchParams: {
    category?: string;
    subcategory?: string;
    brand?: string;
    sort?: string;

    search?: string;
    page?: string;
    limit?: string;
  };
}

export async function PublicProductsGrid({
  searchParams,
}: PublicProductsGridProps) {
  const { products, pagination } = await getProductsWithQuery(searchParams);

  const categories = await getActiveCategories();
  const brands = await getActiveBrands();
  const subCategories = searchParams.category
    ? await getSubCategoriesByCategory(searchParams.category)
    : [];

  // Check if any filters are active
  const hasFilters = !!(
    searchParams.category ||
    searchParams.subcategory ||
    searchParams.brand ||
    searchParams.search
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {pagination.totalCount}
            </span>{" "}
            {pagination.totalCount === 1 ? "product" : "products"}
            {hasFilters && " found"}
          </p>
          {searchParams.search && (
            <span className="text-sm text-gray-500">
              for "
              <span className="font-medium text-gray-700">
                {searchParams.search}
              </span>
              "
            </span>
          )}
        </div>
        <PublicProductsSort
          categories={categories}
          subCategories={subCategories}
          brands={brands}
          currentCategorySlug={searchParams.category}
        />
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-xl border border-dashed border-gray-200">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-900 font-medium mb-1">No products found</p>
          <p className="text-gray-500 text-sm text-center max-w-xs">
            Try adjusting your search or filter criteria to find what you're
            looking for
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
          {products.map((product) => (
            <PublicProductCard
              key={product.id}
              product={product as ProductWithRelations}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pt-4">
          <ProductPagination pagination={pagination} />
        </div>
      )}
    </div>
  );
}
