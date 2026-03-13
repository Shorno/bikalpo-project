/**
 * ORPC-powered Featured Products Section
 * Displays new arrivals or best-selling products using the customer API
 */
"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useRoleAwareProducts } from "@/hooks/use-role-aware-products";
import { useCart } from "@/hooks/use-orpc-cart";
import { ProductCard } from "@/components/shared/product-card";
import { SectionHeader } from "@/components/shared/section-header";
import { cn } from "@/lib/utils";

interface OrpcFeaturedProductsProps {
  title: string;
  subtitle?: string;
  type: "new-arrivals" | "best-selling" | "featured";
  limit?: number;
  href?: string;
  className?: string;
}

export function OrpcFeaturedProducts({
  title,
  subtitle,
  type,
  limit = 8,
  href,
  className,
}: OrpcFeaturedProductsProps) {
  const { addItem } = useCart();

  const sortConfig =
    type === "new-arrivals"
      ? { sort: "newest" }
      : type === "best-selling"
        ? { sort: "popular" }
        : { sort: "newest" };

  const { data, isLoading, isError } = useRoleAwareProducts({
    ...sortConfig,
    limit: limit.toString(),
    page: "1",
  });

  if (isLoading) {
    return (
      <section className={cn("py-6", className)}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {Array.from({ length: limit }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data?.products || data.products.length === 0) {
    return null;
  }

  const products = data.products.slice(0, limit);

  return (
    <section className={cn("py-6", className)}>
      <div className="container mx-auto px-4">
        <SectionHeader title={title} viewAllHref={href} />
        {subtitle && (
          <p className="text-xs text-gray-500 -mt-2 mb-3">{subtitle}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={(id) => addItem(id, 1)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-md gap-0 py-0">
      <Skeleton className="aspect-square w-full" />
      <CardContent className="p-2.5 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-14" />
        </div>
      </CardContent>
    </Card>
  );
}
