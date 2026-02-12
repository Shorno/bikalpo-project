/**
 * Client component for products grid using Customer API
 */
"use client";

import {
  useCustomerProducts,
  useActiveCategories,
  useActiveBrands,
  useSubcategoriesByCategory,
} from "@/hooks/use-customer-api";
import { ProductCard } from "@/components/features/products/product-card";
import { ProductPagination } from "@/components/features/products/product-pagination";
import { ProductsSort } from "@/components/features/products/products-sort";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductsGridClientProps {
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

export function ProductsGridClient({ searchParams }: ProductsGridClientProps) {
  const { data: productsData, isLoading: productsLoading } =
    useCustomerProducts({
      category: searchParams.category || null,
      subcategory: searchParams.subcategory || null,
      brand: searchParams.brand || null,
      minPrice: searchParams.minPrice || null,
      maxPrice: searchParams.maxPrice || null,
      inStock: searchParams.inStock || null,
      search: searchParams.search || null,
      sort: searchParams.sort || null,
      page: searchParams.page,
      limit: searchParams.limit,
    });

  const { data: categoriesData } = useActiveCategories();
  const { data: brandsData } = useActiveBrands();
  const { data: subCategoriesData } = useSubcategoriesByCategory(
    searchParams.category || "",
  );

  if (productsLoading) {
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

  const products = productsData?.products || [];
  const pagination = productsData?.pagination || {
    page: 1,
    limit: 12,
    totalCount: 0,
    totalPages: 0,
  };

  const categories = categoriesData?.categories || [];
  const brands = brandsData?.brands || [];
  const subCategories = subCategoriesData?.subcategories || [];

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
        <div className="text-center py-12">
          <p className="text-gray-500">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {products.map((product: any) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <ProductPagination pagination={pagination} />
      )}
    </div>
  );
}
