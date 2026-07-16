"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { ProductPagination } from "@/components/features/products/product-pagination";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import {
  ActiveFilterSummary,
  StorefrontCategorySidebar,
  StorefrontEmptyState,
  StorefrontMobileFilters,
  type StorefrontProduct,
  StorefrontProductCard,
  StorefrontSkeleton,
  StoreHeader,
} from "@/components/storefront/retailer-storefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddToCart } from "@/hooks/use-customer-api";
import { isCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { orpc } from "@/utils/orpc";

const sortValues = [
  "recommended",
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
  const [searchInput, setSearchInput] = useState(query);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addToCart = useAddToCart();

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

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
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

  const scheduleSearch = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateUrl(
        { q: value.trim().slice(0, 150) || null, page: null },
        { replace: true },
      );
    }, 300);
  };

  const clearCatalogFilters = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput("");
    updateUrl({ q: null, category: null, subcategory: null, page: null });
  };

  const handleCategoryChange = (value: string) => {
    updateUrl({
      q: searchInput.trim() || null,
      category: value || null,
      subcategory: null,
      page: null,
    });
  };

  const handleQuickAdd = (product: StorefrontProduct) => {
    if (previewMode || product.variantCount !== 1 || !data?.shop) return;
    const variant = product.variants[0];
    if (!variant) return;

    addToCart.mutate({
      productId: product.id,
      variantId: variant.variantId,
      shopId: data.shop.id,
      quantity: 1,
    });
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
  const selectedSubcategory = selectedCategory?.subcategories.find(
    (facet) => facet.slug === subcategory,
  );
  const activeFilterCount = Number(!!category) + Number(!!subcategory);
  const hasCatalogFilters = !!(query || category || subcategory);

  return (
    <div className="min-h-screen bg-white">
      {previewMode && <CustomerPreviewBanner />}
      <StoreHeader
        shop={shop}
        productCount={catalogProductCount}
        previewMode={previewMode}
      />

      <main className="container mx-auto px-4 py-6 md:py-8">
        <section aria-labelledby="store-catalog-heading" aria-busy={isFetching}>
          <div className="mb-6 overflow-hidden rounded-lg border bg-white">
            <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h2
                      id="store-catalog-heading"
                      className="text-base font-semibold text-slate-950"
                    >
                      Product catalog
                    </h2>
                    <p
                      className="mt-0.5 text-xs text-slate-500"
                      aria-live="polite"
                    >
                      {isFetching
                        ? "Updating results…"
                        : `${pagination.totalCount} results`}
                    </p>
                  </div>
                  <StorefrontMobileFilters
                    facets={facets}
                    category={category}
                    subcategory={subcategory}
                    activeCount={activeFilterCount}
                    onApply={(nextCategory, nextSubcategory) =>
                      updateUrl({
                        q: searchInput.trim() || null,
                        category: nextCategory || null,
                        subcategory: nextSubcategory || null,
                        page: null,
                      })
                    }
                  />
                </div>

                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="store-search"
                    type="search"
                    value={searchInput}
                    onChange={(event) => scheduleSearch(event.target.value)}
                    placeholder="Search this store by product name or SKU"
                    aria-label="Search this store"
                    className="h-11 rounded-lg bg-white pl-10 pr-10"
                    maxLength={150}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => scheduleSearch("")}
                      className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      aria-label="Clear store search"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <label className="block shrink-0 text-xs font-medium text-slate-600">
                Sort by
                <select
                  value={sort}
                  onChange={(event) =>
                    updateUrl({
                      sort: event.target.value,
                      q: searchInput.trim() || null,
                      page: null,
                    })
                  }
                  className="mt-2 h-11 w-full min-w-48 rounded-lg border border-input bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 lg:w-auto"
                >
                  <option value="recommended">Recommended</option>
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="name_asc">Name: A–Z</option>
                </select>
              </label>
            </div>
            <ActiveFilterSummary
              query={query}
              categoryLabel={selectedCategory?.name}
              subcategoryLabel={selectedSubcategory?.name}
              onClear={clearCatalogFilters}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <StorefrontCategorySidebar
              facets={facets}
              category={category}
              subcategory={subcategory}
              onCategoryChange={handleCategoryChange}
              onSubcategoryChange={(value) =>
                updateUrl({
                  q: searchInput.trim() || null,
                  subcategory: value || null,
                  page: null,
                })
              }
            />

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
                  <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 xl:grid-cols-3">
                    {products.map((product) => (
                      <StorefrontProductCard
                        key={product.id}
                        product={product}
                        previewMode={previewMode}
                        isAdding={
                          addToCart.isPending &&
                          addToCart.variables?.productId === product.id
                        }
                        onQuickAdd={handleQuickAdd}
                      />
                    ))}
                  </div>
                  <ProductPagination pagination={pagination} />
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
