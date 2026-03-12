"use client";

import { useRoleAwareProducts } from "@/hooks/use-role-aware-products";
import { useCart } from "@/hooks/use-orpc-cart";
import { ProductCard } from "@/components/shared/product-card";
import { SectionHeader } from "@/components/shared/section-header";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { cn } from "@/lib/utils";

interface WeekendDealsProps {
  targetDate?: Date;
  limit?: number;
  className?: string;
}

export function WeekendDeals({
  targetDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Default 2 days
  limit = 12,
  className,
}: WeekendDealsProps) {
  const { data, isLoading } = useRoleAwareProducts({
    sort: "discount",
    limit: limit.toString(),
    page: "1",
  });

  const { addItem } = useCart();

  if (isLoading || !data?.products || data.products.length === 0) {
    return null;
  }

  // Add mock discount percentages for demo
  const productsWithDiscount = data.products.map((product) => ({
    ...product,
    discountPercent: Math.floor(Math.random() * 30) + 10, // 10-40% discount
  }));

  return (
    <section className={cn("py-6 bg-primary", className)}>
      <div className="container mx-auto px-4">
        <SectionHeader
          title="WEEKEND DEALS!!!"
          viewAllHref="/products?sort=discount"
          countdown={<CountdownTimer targetDate={targetDate} />}
          variant="light"
          className="border-b-white/20 pb-3"
        />

        <div className="overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          <div className="flex gap-3 min-w-max">
            {productsWithDiscount.slice(0, limit).map((product) => (
              <div key={product.id} className="w-[160px] sm:w-[180px]">
                <ProductCard
                  product={product}
                  onAddToCart={(id) => addItem(id, 1)}
                  showDeliveryTime={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
