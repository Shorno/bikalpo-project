import { Package } from "lucide-react";
import { ConsumerProductCard } from "@/components/features/products/consumer-product-card";
import { ProductPagination } from "@/components/features/products/product-pagination";
import { PublicProductsSort } from "@/components/features/products/public-products-sort";
import {
  getActiveBrands,
  getActiveCategories,
  getReferenceProductsWithQuery,
  getSubcategoriesByCategory,
} from "@/lib/public-data";

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
  previewMode?: boolean;
}

export async function PublicProductsGrid({
  searchParams,
  previewMode = false,
}: PublicProductsGridProps) {
  const { products, pagination } = await getReferenceProductsWithQuery(
    searchParams,
    60,
  );

  const categories = await getActiveCategories(600);
  const brands = await getActiveBrands(600);
  const subCategories = searchParams.category
    ? await getSubcategoriesByCategory(searchParams.category, 600)
    : [];

  // Check if any filters are active
  const hasFilters = !!(
    searchParams.category ||
    searchParams.subcategory ||
    searchParams.brand ||
    searchParams.search
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {pagination.totalCount}
            </span>{" "}
            {pagination.totalCount === 1 ? "product" : "products"}
            {hasFilters && " found"}
          </p>
          {searchParams.search && (
            <span className="text-sm text-muted-foreground">
              for "
              <span className="font-medium text-foreground">
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

      {products.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-border bg-background px-6 text-center">
          <Package className="mb-4 size-8 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">No products found</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Adjust the search or filters to view other catalog products.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 xl:grid-cols-3">
          {products.map((product) => (
            <ConsumerProductCard
              key={product.id}
              product={product as any}
              previewMode={previewMode}
            />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="border-t border-border pt-6">
          <ProductPagination pagination={pagination} />
        </div>
      )}
    </div>
  );
}
