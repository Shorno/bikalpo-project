import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/features/products/product-card";
import { Button } from "@/components/ui/button";
import type { ProductWithRelations } from "@/db/schema";

interface CategorySectionProps {
  category: {
    id: number;
    name: string;
    slug: string;
    products: ProductWithRelations[];
  };
}

export function CategorySection({ category }: CategorySectionProps) {
  const categoryHref = `/products?category=${category.slug}`;

  return (
    <section className="mb-12">
      {/* Category Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 border-l-4 border-emerald-500 pl-3">
          {category.name}
        </h2>

        <Button
          asChild
          variant="ghost"
          className="gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        >
          <Link href={categoryHref}>
            More...
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
        {category.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
