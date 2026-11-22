import { Suspense } from "react";
import { ProductPriceClient } from "@/components/features/product-price/product-price-client";

/** Seller selling prices, in the same layout as the admin price page. */
export default function WarehousePricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ProductPriceClient mode="warehouse" />
    </Suspense>
  );
}
