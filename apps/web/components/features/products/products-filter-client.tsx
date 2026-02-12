/**
 * Client component for products filter using Customer API
 */
"use client";

import {
  useActiveCategories,
  useActiveBrands,
  useSubcategoriesByCategory,
} from "@/hooks/use-customer-api";
import { FilterClient } from "@/components/features/products/filter-client";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductsFilterClientProps {
  categorySlug?: string;
}

export function ProductsFilterClient({
  categorySlug,
}: ProductsFilterClientProps) {
  const { data: categoriesData, isLoading: categoriesLoading } =
    useActiveCategories();
  const { data: brandsData, isLoading: brandsLoading } = useActiveBrands();
  const { data: subCategoriesData, isLoading: subCategoriesLoading } =
    useSubcategoriesByCategory(categorySlug || "");

  const isLoading = categoriesLoading || brandsLoading || subCategoriesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const categories = categoriesData?.categories || [];
  const brands = brandsData?.brands || [];
  const subCategories = subCategoriesData?.subcategories || [];

  return (
    <FilterClient
      categories={categories}
      subCategories={subCategories}
      brands={brands}
      currentCategorySlug={categorySlug}
    />
  );
}
