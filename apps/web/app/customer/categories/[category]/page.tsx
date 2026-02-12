import { CategoryPageClient } from "@/components/customer/category-page-client";

interface CategoryProductsPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    subcategory?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: string;
    search?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function CustomerCategoryProductsPage({
  params,
  searchParams,
}: CategoryProductsPageProps) {
  const { category: categorySlug } = await params;
  const filters = await searchParams;

  return (
    <CategoryPageClient categorySlug={categorySlug} searchParams={filters} />
  );
}
