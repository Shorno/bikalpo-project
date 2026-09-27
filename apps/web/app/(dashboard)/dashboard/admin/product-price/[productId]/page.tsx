import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductPriceDetailClient } from "@/components/features/product-price/product-price-detail-client";

export default async function ProductPriceDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const id = Number((await params).productId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return (
    <Suspense fallback={<p className="p-6">Loading product…</p>}>
      <ProductPriceDetailClient productId={id} />
    </Suspense>
  );
}
