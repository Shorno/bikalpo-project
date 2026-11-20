"use client";

import type { getSellerCatalogProductView } from "@bikalpo-project/api/routers/helpers/catalog-product-detail";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PackagePlus, PackageSearch } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CatalogProductDetail } from "@/components/features/product/catalog-product-detail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

export type SellerCatalogView = NonNullable<
  Awaited<ReturnType<typeof getSellerCatalogProductView>>
>;

type ViewInput = { coreProductId: number; productId?: number };

/**
 * Wholesaler and retailer view of a Product Catalog item: the admin brand
 * product page (prices never sent), a picker for the brands offered, and Add
 * Product — or Edit Product once the seller has added that brand.
 */
export function SellerCatalogProductView({
  coreProductId,
  queryKey,
  fetchView,
  catalogUrl,
  addHref,
  editHref,
}: {
  coreProductId: number;
  queryKey: readonly unknown[];
  fetchView: (input: ViewInput) => Promise<SellerCatalogView>;
  catalogUrl: string;
  addHref: string;
  editHref: (productId: number) => string;
}) {
  const pathname = usePathname();
  const productParam = Number(useSearchParams().get("product"));
  const productId =
    Number.isInteger(productParam) && productParam > 0
      ? productParam
      : undefined;
  const input: ViewInput = { coreProductId, productId };

  const viewQuery = useQuery({
    queryKey: [...queryKey, input],
    queryFn: () => fetchView(input),
    enabled: Number.isInteger(coreProductId) && coreProductId > 0,
    // A missing product will not appear on retry.
    retry: (failureCount, error) =>
      (error as { code?: string }).code !== "NOT_FOUND" && failureCount < 2,
  });
  const view = viewQuery.data;
  const reviewsQuery = useQuery({
    ...orpc.customer.getProductReviews.queryOptions({
      input: { productId: view?.selectedProductId ?? 0 },
    }),
    enabled: Boolean(view?.selectedProductId),
  });

  if (viewQuery.isLoading) return <ViewLoading />;
  if (!view || viewQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-6">
        <p className="text-sm text-destructive">
          This product is not available in the catalog.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={catalogUrl}>
            <ArrowLeft className="size-4" />
            Back to Product Catalog
          </Link>
        </Button>
      </div>
    );
  }

  if (!view.product || !view.selectedProductId) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href={catalogUrl}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <section className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <PackageSearch
            aria-hidden="true"
            className="mx-auto size-9 text-muted-foreground/50"
          />
          <h1 className="mt-3 text-lg font-semibold">{view.core.name}</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            No brand has been set up for this product in the catalog yet. You
            can still add it to your products.
          </p>
          <Button asChild className="mt-5">
            <Link href={addHref}>
              <PackagePlus className="size-4" />
              Add Product
            </Link>
          </Button>
        </section>
      </div>
    );
  }

  const brandPicker =
    view.brands.length > 1 ? (
      <nav
        aria-label="Brands"
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm"
      >
        <span className="px-1 text-sm font-medium text-muted-foreground">
          Brand
        </span>
        {view.brands.map((item) => {
          const selected = item.productId === view.selectedProductId;
          return (
            <Link
              key={item.productId}
              href={`${pathname}?product=${item.productId}`}
              replace
              scroll={false}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-lg border px-3 text-sm transition-colors",
                selected
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "hover:border-foreground/20 hover:bg-muted/40",
              )}
            >
              {item.brandName}
            </Link>
          );
        })}
      </nav>
    ) : null;

  return (
    <CatalogProductDetail
      key={view.selectedProductId}
      product={view.product}
      reviews={reviewsQuery.data?.reviews ?? []}
      stats={reviewsQuery.data?.stats ?? { averageRating: 0, totalReviews: 0 }}
      listingUrl={catalogUrl}
      listingLabel="Product Catalog"
      viewer="seller"
      brandPicker={brandPicker}
      primaryAction={
        view.ownProductId
          ? {
              label: "Edit Product",
              href: editHref(view.ownProductId),
              kind: "edit",
            }
          : { label: "Add Product", href: addHref, kind: "add" }
      }
    />
  );
}

function ViewLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-[420px] w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
