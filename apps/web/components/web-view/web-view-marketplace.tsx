"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Filter,
  Package,
  Recycle,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Store,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveBrands, useActiveCategories } from "@/hooks/use-customer-api";
import { useDebounce } from "@/hooks/use-debounce";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type WebViewProduct = {
  id: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  image: string | null;
  price: number;
  unitLabel: string | null;
  variantLabel: string | null;
  inStock: boolean;
  category: { name: string; slug: string } | null;
  subCategory: { name: string; slug: string } | null;
  coreIdentity: {
    id: number | null;
    name: string;
    sku: string | null;
    description: string;
  };
  reviewStats: { averageRating: number; totalReviews: number };
  sellerCount: number;
};

type ProductDetail = WebViewProduct & {
  description: string | null;
  videoUrl: string | null;
  images: string[];
  brands: {
    id: number | null;
    name: string;
    slug: string | null;
    logo: string | null;
  }[];
  variants: {
    id: number;
    label: string;
    unitLabel: string;
    unit: string | null;
    size: string | null;
    variantType: string | null;
  }[];
  referencePrices: {
    id: number;
    brandId: number | null;
    brandName: string | null;
    variantOptionId: number;
    variantId: number | null;
    variantLabel: string;
    unitLabel: string;
    consumerPrice: number;
    color: string | null;
    size: string | null;
    packType: string | null;
  }[];
  emptyPackReturn: {
    enabled: boolean;
    depositAmount: number;
    companies: string[];
    packSizes: string[];
  };
};

type PaginationData = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

function formatBdt(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "\u09F3 --";
  return `\u09F3 ${amount.toLocaleString("en-BD", {
    maximumFractionDigits: 0,
  })}`;
}

function paramValue(value: string | null) {
  return value && value !== "all" ? value : undefined;
}

function buildUrl(params: URLSearchParams) {
  const query = params.toString();
  return `${ADMIN_BASE}/web-view${query ? `?${query}` : ""}`;
}

export function WebViewMarketplace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounce(search, 300);

  const category = searchParams.get("category");
  const brand = searchParams.get("brand");
  const sort = searchParams.get("sort") ?? "newest";
  const page = searchParams.get("page") ?? "1";
  const selectedSlug = searchParams.get("product");

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    const next = debouncedSearch.trim();
    if (current === next) return;

    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("search", next);
    else params.delete("search");
    params.delete("page");
    params.delete("product");
    router.replace(buildUrl(params), { scroll: false });
  }, [debouncedSearch, router, searchParams]);

  const filters = useMemo(
    () => ({
      category: paramValue(category),
      brand: paramValue(brand),
      sort,
      search: searchParams.get("search") || undefined,
      page,
      limit: "12",
    }),
    [category, brand, sort, page, searchParams],
  );

  const { data: productsData, isLoading } = useQuery(
    orpc.customer.getWebViewProducts.queryOptions({
      input: filters,
      staleTime: 1000 * 30,
    }),
  );
  const { data: categoryData } = useActiveCategories();
  const { data: brandData } = useActiveBrands();

  const products = (productsData?.products ?? []) as WebViewProduct[];
  const pagination = productsData?.pagination as PaginationData | undefined;

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    if (key !== "product") params.delete("product");
    router.push(buildUrl(params), { scroll: false });
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    params.delete("brand");
    params.delete("sort");
    params.delete("search");
    params.delete("page");
    params.delete("product");
    setSearch("");
    router.push(buildUrl(params), { scroll: false });
  };

  const openProduct = (slug: string) => updateParam("product", slug);
  const closeProduct = () => updateParam("product", null);

  const filterPanel = (
    <FilterPanel
      brand={brand ?? "all"}
      brands={brandData?.brands ?? []}
      category={category ?? "all"}
      categories={categoryData?.categories ?? []}
      clearFilters={clearFilters}
      search={search}
      setSearch={setSearch}
      sort={sort}
      updateParam={updateParam}
    />
  );

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Bikalpo
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              Web View
            </h1>
          </div>
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button className="gap-2 lg:hidden" variant="outline">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[88vw] max-w-sm bg-white">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4">{filterPanel}</div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">{filterPanel}</aside>
          <main className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">
                  {pagination?.totalCount ?? 0}
                </span>{" "}
                products
              </p>
              <Badge variant="outline" className="rounded-md bg-white">
                Reference prices
              </Badge>
            </div>

            {isLoading ? (
              <ProductGridSkeleton />
            ) : products.length === 0 ? (
              <EmptyProducts />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <WebViewProductCard
                    key={product.id}
                    product={product}
                    onViewDetails={openProduct}
                  />
                ))}
              </div>
            )}

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4">
                <Button
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    updateParam("page", String(pagination.page - 1))
                  }
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="text-sm text-zinc-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    updateParam("page", String(pagination.page + 1))
                  }
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      <ProductDetailModal
        open={!!selectedSlug}
        slug={selectedSlug}
        onClose={closeProduct}
      />
    </div>
  );
}

function FilterPanel({
  brand,
  brands,
  category,
  categories,
  clearFilters,
  search,
  setSearch,
  sort,
  updateParam,
}: {
  brand: string;
  brands: any[];
  category: string;
  categories: any[];
  clearFilters: () => void;
  search: string;
  setSearch: (value: string) => void;
  sort: string;
  updateParam: (key: string, value: string | null) => void;
}) {
  const hasFilters =
    brand !== "all" || category !== "all" || sort !== "newest" || !!search;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-emerald-700" />
          <h2 className="text-sm font-semibold text-zinc-950">Filters</h2>
        </div>
        {hasFilters && (
          <Button
            className="h-7 gap-1 px-2 text-xs"
            onClick={clearFilters}
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            className="h-9 pl-8"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products"
            value={search}
          />
        </div>

        <Select
          value={category}
          onValueChange={(value) => updateParam("category", value)}
        >
          <SelectTrigger className="h-9 w-full bg-white">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={brand}
          onValueChange={(value) => updateParam("brand", value)}
        >
          <SelectTrigger className="h-9 w-full bg-white">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(value) => updateParam("sort", value)}
        >
          <SelectTrigger className="h-9 w-full bg-white">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-asc">Price low to high</SelectItem>
            <SelectItem value="price-desc">Price high to low</SelectItem>
            <SelectItem value="name-asc">Name A to Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function WebViewProductCard({
  product,
  onViewDetails,
}: {
  product: WebViewProduct;
  onViewDetails: (slug: string) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const hasImage = !!product.image && !imageError;
  const rating = product.reviewStats.averageRating;
  const reviews = product.reviewStats.totalReviews;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {hasImage ? (
          <Image
            alt={product.name}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            onError={() => setImageError(true)}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            src={product.image!}
            unoptimized={product.image?.startsWith("http")}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-12 w-12 text-zinc-300" />
          </div>
        )}
        {product.category?.name && (
          <Badge className="absolute left-3 top-3 rounded-md bg-white text-zinc-800 shadow-sm hover:bg-white">
            {product.category.name}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-950">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
            {product.shortDescription ||
              product.coreIdentity.description ||
              product.coreIdentity.name}
          </p>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex flex-wrap items-end gap-1.5">
            <span className="text-xl font-bold text-zinc-950">
              {formatBdt(product.price)}
            </span>
            {product.unitLabel ? (
              <span className="pb-0.5 text-xs text-zinc-500">
                / {product.unitLabel}
              </span>
            ) : (
              <span className="pb-0.5 text-xs text-zinc-500">
                Starting From
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-zinc-600">
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  reviews > 0
                    ? "fill-amber-400 text-amber-400"
                    : "text-zinc-300",
                )}
              />
              {reviews > 0 ? `${rating.toFixed(1)} (${reviews})` : "No reviews"}
            </span>
            <span className="inline-flex items-center gap-1 text-zinc-600">
              <Store className="h-3.5 w-3.5 text-sky-600" />
              {product.sellerCount} Sellers
            </span>
          </div>

          <Button
            className="h-9 w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
            onClick={() => onViewDetails(product.slug)}
          >
            <Eye className="h-4 w-4" />
            View Details
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProductDetailModal({
  onClose,
  open,
  slug,
}: {
  onClose: () => void;
  open: boolean;
  slug: string | null;
}) {
  const { data, isLoading } = useQuery({
    ...orpc.customer.getWebViewProductDetail.queryOptions({
      input: { slug: slug ?? "" },
      staleTime: 1000 * 60,
    }),
    enabled: !!slug,
  });
  const product = data?.product as ProductDetail | undefined;
  const [selectedBrand, setSelectedBrand] = useState("default");
  const [selectedVariant, setSelectedVariant] = useState("");

  useEffect(() => {
    if (!product) return;
    const firstBrandId = product.brands[0]?.id ?? null;
    const firstPrice = product.referencePrices.find(
      (price) => (price.brandId ?? null) === firstBrandId,
    );
    setSelectedBrand(firstBrandId == null ? "default" : String(firstBrandId));
    setSelectedVariant(firstPrice ? String(firstPrice.variantOptionId) : "");
  }, [product]);

  const selectedBrandId =
    selectedBrand === "default" ? null : Number(selectedBrand);
  const selectedVariantId = selectedVariant ? Number(selectedVariant) : null;
  const pricesForSelectedBrand = useMemo(
    () =>
      (product?.referencePrices ?? []).filter(
        (price) => (price.brandId ?? null) === selectedBrandId,
      ),
    [product?.referencePrices, selectedBrandId],
  );
  const availableVariantIds = useMemo(
    () => new Set(pricesForSelectedBrand.map((price) => price.variantOptionId)),
    [pricesForSelectedBrand],
  );

  useEffect(() => {
    if (!product) return;
    if (pricesForSelectedBrand.length === 0) {
      setSelectedVariant("");
      return;
    }

    if (
      selectedVariantId != null &&
      availableVariantIds.has(selectedVariantId)
    ) {
      return;
    }

    setSelectedVariant(String(pricesForSelectedBrand[0].variantOptionId));
  }, [availableVariantIds, pricesForSelectedBrand, product, selectedVariantId]);

  const selectedPrice =
    pricesForSelectedBrand.find(
      (price) =>
        selectedVariantId != null &&
        price.variantOptionId === selectedVariantId,
    ) ?? pricesForSelectedBrand[0];

  const selectedVariantLabel = selectedPrice?.variantLabel;
  const colors = Array.from(
    new Set(
      pricesForSelectedBrand
        .filter((price) => price.color)
        .map((price) => price.color as string),
    ),
  );
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0 sm:max-w-3xl lg:max-w-4xl">
        {isLoading || !product ? (
          <div className="grid gap-5 p-6 md:grid-cols-[280px_minmax(0,1fr)]">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-28 w-full" />
            </div>
          </div>
        ) : (
          <div className="grid gap-0 md:grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex items-center justify-center bg-zinc-50 p-5 md:rounded-l-xl">
              <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-xl bg-white shadow-sm">
                {product.images[0] ? (
                  <Image
                    alt={product.name}
                    className="object-cover"
                    fill
                    sizes="(max-width: 768px) 100vw, 340px"
                    src={product.images[0]}
                    unoptimized={product.images[0].startsWith("http")}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-14 w-14 text-zinc-300" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5 p-5 md:p-6 md:pl-6">
              <DialogHeader className="sr-only">
                <DialogTitle>{product.name}</DialogTitle>
                <DialogDescription>
                  {product.shortDescription ||
                    product.coreIdentity.description ||
                    product.coreIdentity.name}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                {product.category?.name && (
                  <Badge variant="outline" className="rounded-md">
                    {product.category.name}
                  </Badge>
                )}
                <Badge className="rounded-md bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                  Reference price
                </Badge>
                {product.emptyPackReturn.enabled && (
                  <Badge
                    className="h-7 rounded-md border-emerald-200 bg-white px-2.5 text-emerald-700"
                    variant="outline"
                  >
                    <Recycle className="h-3.5 w-3.5" />
                    Empty Pack Return
                  </Badge>
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold leading-7 tracking-tight text-zinc-950 md:text-2xl">
                  {product.name}
                </h2>
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-zinc-500">
                  {product.shortDescription ||
                    product.coreIdentity.description ||
                    product.coreIdentity.name}
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
                  <div>
                    <p className="text-2xl font-bold text-zinc-950 md:text-3xl">
                      {formatBdt(selectedPrice?.consumerPrice)}
                    </p>
                    {selectedVariantLabel && (
                      <p className="text-sm text-zinc-500">
                        {selectedVariantLabel}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-zinc-600">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {product.reviewStats.totalReviews > 0
                      ? `${product.reviewStats.averageRating.toFixed(1)} (${product.reviewStats.totalReviews} reviews)`
                      : "No reviews"}
                  </div>
                </div>

                {product.brands.length > 0 && (
                  <OptionGroup label="Select Brand">
                    {product.brands.map((brand) => {
                      const value =
                        brand.id == null ? "default" : String(brand.id);
                      const active = selectedBrand === value;
                      return (
                        <button
                          className={cn(
                            "rounded-lg border px-3.5 py-2 text-sm font-medium transition",
                            active
                              ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
                          )}
                          key={value}
                          onClick={() => {
                            const brandId = brand.id ?? null;
                            const firstPrice = product.referencePrices.find(
                              (price) => (price.brandId ?? null) === brandId,
                            );
                            setSelectedBrand(value);
                            setSelectedVariant(
                              firstPrice
                                ? String(firstPrice.variantOptionId)
                                : "",
                            );
                          }}
                          type="button"
                        >
                          {brand.name}
                        </button>
                      );
                    })}
                  </OptionGroup>
                )}

                {product.variants.length > 0 && (
                  <OptionGroup label="Select Pack">
                    {product.variants.map((variant) => {
                      const value = String(variant.id);
                      const active = selectedVariant === value;
                      const available = availableVariantIds.has(variant.id);
                      return (
                        <button
                          className={cn(
                            "rounded-lg border px-3.5 py-2 text-sm font-medium transition",
                            !available
                              ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-300"
                              : active
                                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
                          )}
                          disabled={!available}
                          key={variant.id}
                          onClick={() => setSelectedVariant(value)}
                          type="button"
                        >
                          {variant.label}
                        </button>
                      );
                    })}
                  </OptionGroup>
                )}

                {colors.length > 0 && (
                  <OptionGroup label="Available Colors">
                    {colors.map((color) => (
                      <Badge
                        className="rounded-md px-3 py-1.5"
                        key={color}
                        variant="outline"
                      >
                        {color}
                      </Badge>
                    ))}
                  </OptionGroup>
                )}

                <Button
                  className="h-11 w-full gap-2 bg-zinc-950 text-white hover:bg-zinc-800"
                  disabled
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OptionGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-zinc-800">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function EmptyProducts() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
      <Package className="mb-3 h-10 w-10 text-zinc-300" />
      <h2 className="text-base font-semibold text-zinc-950">
        No products found
      </h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Try a different category, brand, or search term.
      </p>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="rounded-lg border border-zinc-200 bg-white p-3"
          key={index}
        >
          <Skeleton className="aspect-[4/3] rounded-md" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
