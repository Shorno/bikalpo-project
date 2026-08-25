import { ConsumerProductCard } from "@/components/features/products/consumer-product-card";
import { ProductPagination } from "@/components/features/products/product-pagination";
import { ProductsSort } from "@/components/features/products/products-sort";
import {
  getActiveBrands,
  getActiveCategories,
  getReferenceProductsWithQuery,
  getSubcategoriesByCategory,
} from "@/lib/public-data";

interface ProductsGridProps {
  searchParams: {
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
  };
  previewMode?: boolean;
}

export async function ProductsGrid({
  searchParams,
  previewMode = false,
}: ProductsGridProps) {
  const { products, pagination } = await getReferenceProductsWithQuery(
    searchParams,
    600,
  );

  const categories = await getActiveCategories(600);
  const brands = await getActiveBrands(600);
  const subCategories = searchParams.category
    ? await getSubcategoriesByCategory(searchParams.category, 600)
    : [];

  return (
    <div className="space-y-6">
      {/* Sort and Results Count */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
        <p className="text-sm text-neutral-600">
          {pagination.totalCount}{" "}
          {pagination.totalCount === 1 ? "product" : "products"} found
        </p>
        <ProductsSort
          categories={categories}
          subCategories={subCategories}
          brands={brands}
          currentCategorySlug={searchParams.category}
        />
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-500 text-lg mb-2">No products found</p>
          <p className="text-neutral-400 text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ConsumerProductCard
              key={product.id}
              product={product as any}
              previewMode={previewMode}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <ProductPagination pagination={pagination} />
    </div>
  );
}
