import { PublicFilterClient } from "@/components/features/products/public-filter-client";
import {
  getActiveBrands,
  getActiveCategories,
  getSubcategoriesByCategory,
} from "@/lib/public-data";

interface PublicProductsFilterProps {
  categorySlug?: string;
}

export async function PublicProductsFilter({
  categorySlug,
}: PublicProductsFilterProps) {
  const categories = await getActiveCategories(600);
  const brands = await getActiveBrands(600);
  const subCategories = categorySlug
    ? await getSubcategoriesByCategory(categorySlug, 600)
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
