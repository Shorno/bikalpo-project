"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { ProductPagination } from "@/components/features/products/product-pagination";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import {
  type StorefrontAddSelection,
  StorefrontEmptyState,
  StorefrontOfferBanner,
  type StorefrontProduct,
  StorefrontProductCard,
  StorefrontSkeleton,
  StoreHeader,
} from "@/components/storefront/retailer-storefront";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-orpc-cart";
import { isCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { addRetailerProductToCart } from "@/lib/retailer-quick-add";
import { orpc } from "@/utils/orpc";

const sortValues = [
  "recommended",
  "popular",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
] as const;
type StorefrontSort = (typeof sortValues)[number];

function getSafeSort(value: string | null): StorefrontSort {
  return sortValues.includes(value as StorefrontSort)
    ? (value as StorefrontSort)
    : "recommended";
}

function getSafePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function ShopStorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
  const query = (searchParams.get("q") ?? "").trim().slice(0, 150);
  const category = searchParams.get("category")?.trim() ?? "";
  const subcategory = searchParams.get("subcategory")?.trim() ?? "";
  const sort = getSafeSort(searchParams.get("sort"));
  const page = getSafePage(searchParams.get("page"));
  const [quickAddingProductIds, setQuickAddingProductIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const [pendingCartItemIds, setPendingCartItemIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const { addItem, items: cartItems, updateQuantity } = useCart();

  const updateUrl = useCallback(
    (
      updates: Record<string, string | number | null>,
      options: { replace?: boolean } = {},
    ) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (
          value === null ||
          value === "" ||
          (key === "page" && value === 1) ||
          (key === "sort" && value === "recommended")
        ) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      const href = next.size > 0 ? `${pathname}?${next.toString()}` : pathname;
      if (options.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    ...orpc.customer.getShopBySlug.queryOptions({
      input: {
        slug,
        search: query || undefined,
        category: category || undefined,
        subcategory: subcategory || undefined,
        sort,
        page,
        limit: 12,
      },
      enabled: !!slug,
    }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (
      data?.pagination.totalPages &&
      data.pagination.page !== page &&
      !isFetching
    ) {
      updateUrl({ page: data.pagination.page }, { replace: true });
    }
  }, [data?.pagination, isFetching, page, updateUrl]);

  const clearCatalogFilters = () => {
    updateUrl({ q: null, category: null, subcategory: null, page: null });
  };

  const handleCategoryChange = (value: string) => {
    updateUrl({
      q: query || null,
      category: value || null,
      subcategory: null,
      page: null,
    });
  };

  const handleQuickAdd = async (
    product: StorefrontProduct,
    selection: StorefrontAddSelection,
  ) => {
    if (previewMode || !data?.shop) return;

    setQuickAddingProductIds((current) => new Set(current).add(product.id));
    try {
      await addRetailerProductToCart(addItem, {
        productId: product.id,
        variantId: selection.variantId,
        shopId: data.shop.id,
        cylinderSaleMode: selection.cylinderSaleMode,
      });
    } finally {
      setQuickAddingProductIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleQuantityUpdate = async (cartItemId: number, quantity: number) => {
    setPendingCartItemIds((current) => new Set(current).add(cartItemId));
    try {
      await updateQuantity(cartItemId, quantity);
    } finally {
      setPendingCartItemIds((current) => {
        const next = new Set(current);
        next.delete(cartItemId);
        return next;
      });
    }
  };

  if (isLoading && !data) return <StorefrontSkeleton />;

  if (isError || !data?.shop) {
    return (
      <main className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-lg rounded-lg border bg-slate-50 px-6 py-12 text-center">
          <AlertCircle
            className="mx-auto size-10 text-red-500"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-lg font-semibold text-slate-950">
            We couldn&apos;t load this store
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            The store may be unavailable, or the catalog request may have
            failed.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              type="button"
              className="h-11"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
            <Button asChild variant="outline" className="h-11 bg-white">
              <Link href="/stores">Browse all stores</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const { shop, facets, pagination, catalogProductCount } = data;
  const products = data.products as StorefrontProduct[];
  const selectedCategory = facets.find((facet) => facet.slug === category);
  const hasCatalogFilters = !!(query || category || subcategory);

  return (
    <div className="min-h-screen bg-white">
      {previewMode && <CustomerPreviewBanner />}
      <StoreHeader
        shop={shop}
        productCount={catalogProductCount}
        stats={data.storeStats}
      />
      <StorefrontOfferBanner offers={data.activeOffers} />

      <main className="container mx-auto px-4 py-6 md:py-8">
        <section aria-labelledby="store-catalog-heading" aria-busy={isFetching}>
          <div className="mb-5 border-b pb-5">
            <div className="flex items-center justify-between gap-4">
              <h2
                id="store-catalog-heading"
                className="text-sm font-semibold text-slate-950"
              >
                Categories
              </h2>
              <p className="font-mono text-xs tabular-nums text-slate-500">
                {catalogProductCount.toLocaleString("en-BD")} products
              </p>
            </div>
            <div
              className="mt-3 flex gap-2 overflow-x-auto pb-1"
              role="list"
              aria-label="Product categories"
            >
              <button
                type="button"
                onClick={() => handleCategoryChange("")}
                aria-pressed={!category}
                className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors ${
                  !category
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                All
              </button>
              {facets.map((facet) => (
                <button
                  key={facet.slug}
                  type="button"
                  onClick={() => handleCategoryChange(facet.slug)}
                  aria-pressed={category === facet.slug}
                  className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors ${
                    category === facet.slug
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {facet.name}
                </button>
              ))}
            </div>

            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto border-t pt-3">
                <button
                  type="button"
                  onClick={() =>
                    updateUrl({
                      subcategory: null,
                      q: query || null,
                      page: null,
                    })
                  }
                  aria-pressed={!subcategory}
                  className={`h-8 shrink-0 rounded-md border px-3 text-xs font-medium transition-colors ${
                    !subcategory
                      ? "border-blue-200 bg-blue-50 text-primary"
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  All {selectedCategory.name}
                </button>
                {selectedCategory.subcategories.map((facet) => (
                  <button
                    key={facet.slug}
                    type="button"
                    onClick={() =>
                      updateUrl({
                        q: query || null,
                        subcategory: facet.slug,
                        page: null,
                      })
                    }
                    aria-pressed={subcategory === facet.slug}
                    className={`h-8 shrink-0 rounded-md border px-3 text-xs font-medium transition-colors ${
                      subcategory === facet.slug
                        ? "border-blue-200 bg-blue-50 text-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {facet.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6 flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex gap-2 overflow-x-auto"
              role="group"
              aria-label="Quick filters"
            >
              {[
                { label: "All", value: "recommended" },
                { label: "Popular", value: "popular" },
                { label: "Low price", value: "price_asc" },
                { label: "Newest", value: "newest" },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() =>
                    updateUrl({
                      sort: filter.value,
                      q: query || null,
                      page: null,
                    })
                  }
                  aria-pressed={sort === filter.value}
                  className={`h-9 shrink-0 rounded-md border px-3 text-xs font-medium transition-colors ${
                    sort === filter.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="text-xs text-slate-500" aria-live="polite">
                {isFetching
                  ? "Updating…"
                  : `${pagination.totalCount.toLocaleString("en-BD")} results`}
              </p>
              <select
                value={sort}
                onChange={(event) =>
                  updateUrl({
                    sort: event.target.value,
                    q: query || null,
                    page: null,
                  })
                }
                aria-label="Sort products"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="recommended">Recommended</option>
                <option value="popular">Popular</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name_asc">Name: A–Z</option>
              </select>
            </div>
          </div>

          <div
            className={
              isFetching
                ? "opacity-60 transition-opacity"
                : "transition-opacity"
            }
          >
            {products.length === 0 ? (
              <StorefrontEmptyState
                filtered={catalogProductCount > 0 && hasCatalogFilters}
                onClear={clearCatalogFilters}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2">
                  {products.map((product) => (
                    <StorefrontProductCard
                      key={product.id}
                      product={product}
                      shopSlug={shop.shopSlug || slug}
                      shopId={data.shop.id}
                      previewMode={previewMode}
                      isAdding={quickAddingProductIds.has(product.id)}
                      cartItems={cartItems}
                      onQuickAdd={handleQuickAdd}
                      pendingCartItemIds={pendingCartItemIds}
                      onUpdateQuantity={handleQuantityUpdate}
                    />
                  ))}
                </div>
                <ProductPagination pagination={pagination} />
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
