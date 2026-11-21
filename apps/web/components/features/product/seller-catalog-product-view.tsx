"use client";

import type { getSellerCatalogProductView } from "@bikalpo-project/api/routers/helpers/catalog-product-detail";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
 *
 * Add Product creates the seller's copy of the chosen brand in one step. An
 * item admin has not set up a brand for still gets the page, built from the
 * catalog item itself; its Add Product opens the Add page to pick one brand.
 */
export function SellerCatalogProductView({
  coreProductId,
  queryKey,
  fetchView,
  catalogUrl,
  addHref,
  editHref,
  addBrandProduct,
}: {
  coreProductId: number;
  queryKey: readonly unknown[];
  fetchView: (input: ViewInput) => Promise<SellerCatalogView>;
  catalogUrl: string;
  /** The Add page, where the seller picks a brand and its sizes. */
  addHref: string;
  editHref: (productId: number) => string;
  /** Creates the seller's copy of an admin brand product; resolves to its id. */
  addBrandProduct: (productId: number) => Promise<{ productId: number }>;
}) {
  const queryClient = useQueryClient();
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
  const addMutation = useMutation({
    mutationFn: addBrandProduct,
    onSuccess: async () => {
      const brandName = view?.brands.find(
        (item) => item.productId === view.selectedProductId,
      )?.brandName;
      toast.success(
        brandName
          ? `${brandName} added to your products`
          : "Added to your products",
      );
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
    onError: (error) =>
      toast.error(error.message || "The product could not be added"),
  });
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
    return view.item ? (
      <CatalogProductDetail
        product={view.item}
        reviews={[]}
        stats={{ averageRating: 0, totalReviews: 0 }}
        listingUrl={catalogUrl}
        listingLabel="Product Catalog"
        viewer="seller"
        brandless
        primaryAction={{ label: "Add Product", href: addHref, kind: "add" }}
      />
    ) : null;
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
          : {
              label: "Add Product",
              kind: "add",
              pending: addMutation.isPending,
              onSelect: () => addMutation.mutate(view.selectedProductId),
            }
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
