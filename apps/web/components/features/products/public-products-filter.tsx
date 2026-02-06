import { getActiveBrands } from "@/actions/brand/get-brands";
import { getActiveCategories } from "@/actions/products/get-active-categories";
import { getSubCategoriesByCategory } from "@/actions/products/get-subcategories-by-category";
import { PublicFilterClient } from "@/components/features/products/public-filter-client";

interface PublicProductsFilterProps {
  categorySlug?: string;
}

export async function PublicProductsFilter({
  categorySlug,
}: PublicProductsFilterProps) {
  const categories = await getActiveCategories();
  const brands = await getActiveBrands();
  const subCategories = categorySlug
    ? await getSubCategoriesByCategory(categorySlug)
    : [];

  return (
    <PublicFilterClient
      categories={categories}
      subCategories={subCategories}
      brands={brands}
      currentCategorySlug={categorySlug}
    />
  );
}
