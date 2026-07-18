"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import { RetailerProductDetail } from "@/components/storefront/retailer-product-detail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { orpc } from "@/utils/orpc";

export default function RetailerProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug: shopSlug, productSlug } = use(params);
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
  const { data, isLoading, isError, refetch } = useQuery(
    orpc.customer.getShopProductBySlug.queryOptions({
      input: { shopSlug, productSlug },
      enabled: !!shopSlug && !!productSlug,
      staleTime: 30_000,
    }),
  );

  if (isLoading) {
    return <RetailerProductDetailSkeleton />;
  }

  if (isError || !data) {
    return (
      <main className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-lg rounded-xl border bg-slate-50 px-6 py-12 text-center">
          <AlertCircle
            className="mx-auto size-10 text-red-500"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-lg font-semibold text-slate-950">
            This product is not available from this store
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            The retailer may have removed it, run out of stock, or changed its
            catalog.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button type="button" onClick={() => void refetch()}>
              Try again
            </Button>
            <Button asChild variant="outline" className="bg-white">
              <Link href={`/stores/${encodeURIComponent(shopSlug)}`}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to store
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      {previewMode && <CustomerPreviewBanner />}
      <RetailerProductDetail data={data} previewMode={previewMode} />
    </>
  );
}

function RetailerProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="border-b bg-white">
        <div className="container mx-auto flex gap-2 px-4 py-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-4">
        <div className="grid overflow-hidden rounded-lg border bg-white lg:grid-cols-[minmax(0,0.46fr)_minmax(420px,0.54fr)]">
          <div className="border-b p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          </div>
          <div className="space-y-3 p-4 sm:p-5 lg:p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
