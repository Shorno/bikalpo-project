import { Suspense } from "react";
import { ProductPriceClient } from "@/components/features/product-price/product-price-client";

export default function ProductPricePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ProductPriceClient />
    </Suspense>
  );
}
