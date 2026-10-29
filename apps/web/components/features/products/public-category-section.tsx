import type { ProductWithRelations } from "@bikalpo-project/db/schema";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CatalogProductGrid } from "@/components/features/products/catalog-product-grid";
import { ConsumerProductCard } from "@/components/features/products/consumer-product-card";
import { Button } from "@/components/ui/button";

interface PublicCategorySectionProps {
  category: {
    id: number;
    name: string;
    slug: string;
    products: ProductWithRelations[];
  };
}

export function PublicCategorySection({
  category,
}: PublicCategorySectionProps) {
  const categoryHref = `/products?category=${category.slug}`;

  return (
    <section className="mb-12 px-4 md:px-0">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
          {category.name}
        </h2>

        <Button asChild variant="ghost" className="gap-2">
          <Link href={categoryHref}>
            See All
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>

      {/* Products Grid */}
      <CatalogProductGrid>
        {category.products.map((product) => (
          <ConsumerProductCard key={product.id} product={product as any} />
        ))}
      </CatalogProductGrid>
    </section>
  );
}
