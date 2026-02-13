import { PublicCategorySection } from "@/components/features/products/public-category-section";
import { getCategoriesWithProducts } from "@/lib/public-data";
import { cn } from "@/lib/utils";

interface PublicCategoryListingProps {
  className?: string;
}

export default async function PublicCategoryListing({
  className,
}: PublicCategoryListingProps) {
  const categoriesWithProducts = await getCategoriesWithProducts(8, 600);

  return (
    <div className={cn("py-4 container mx-auto", className)}>
      {categoriesWithProducts.length === 0 ? (
        <p className="text-center py-12 opacity-60">
          No products available at the moment.
        </p>
      ) : (
        <div className="space-y-12">
          {categoriesWithProducts.map((category) => (
            <PublicCategorySection key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
