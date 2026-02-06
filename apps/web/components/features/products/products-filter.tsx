import { getActiveBrands } from "@/actions/brand/get-brands";
import { getActiveCategories } from "@/actions/products/get-active-categories";
import { getSubCategoriesByCategory } from "@/actions/products/get-subcategories-by-category";
import { FilterClient } from "@/components/features/products/filter-client";

interface ProductsFilterProps {
  categorySlug?: string;
}

export async function ProductsFilter({ categorySlug }: ProductsFilterProps) {
  const categories = await getActiveCategories();
  const brands = await getActiveBrands();
  const subCategories = categorySlug
    ? await getSubCategoriesByCategory(categorySlug)
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
