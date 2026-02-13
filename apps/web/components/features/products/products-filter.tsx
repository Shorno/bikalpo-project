import { FilterClient } from "@/components/features/products/filter-client";
import {
  getActiveBrands,
  getActiveCategories,
  getSubcategoriesByCategory,
} from "@/lib/public-data";

interface ProductsFilterProps {
  categorySlug?: string;
}

export async function ProductsFilter({ categorySlug }: ProductsFilterProps) {
  const categories = await getActiveCategories(600);
  const brands = await getActiveBrands(600);
  const subCategories = categorySlug
    ? await getSubcategoriesByCategory(categorySlug, 600)
    : [];

  return (
    <FilterClient
      categories={categories}
      subCategories={subCategories}
      brands={brands}
      currentCategorySlug={categorySlug}
    />
  );
}
