import { Suspense } from "react";
import { ConsumerProductsClient } from "@/components/features/consumer-products/consumer-products-client";

export default function ConsumerProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground text-sm">
          Loading…
        </div>
      }
    >
      <ConsumerProductsClient />
    </Suspense>
  );
}
