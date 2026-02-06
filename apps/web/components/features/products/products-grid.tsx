import { getActiveBrands } from "@/actions/brand/get-brands";
import { getActiveCategories } from "@/actions/products/get-active-categories";
import { getProductsWithQuery } from "@/actions/products/get-product-with-query";
import { getSubCategoriesByCategory } from "@/actions/products/get-subcategories-by-category";
import { ProductCard } from "@/components/features/products/product-card";
import { ProductPagination } from "@/components/features/products/product-pagination";
import { ProductsSort } from "@/components/features/products/products-sort";
import type { ProductWithRelations } from "@/db/schema";

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
}

export async function ProductsGrid({ searchParams }: ProductsGridProps) {
  const { products, pagination } = await getProductsWithQuery(searchParams);

  const categories = await getActiveCategories();
  const brands = await getActiveBrands();
  const subCategories = searchParams.category
    ? await getSubCategoriesByCategory(searchParams.category)
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product as ProductWithRelations}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <ProductPagination pagination={pagination} />
    </div>
  );
}
