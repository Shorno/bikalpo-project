"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Filter,
  Layers3,
  Package,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Tags,
  X,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { FilterSelect } from "@/components/features/product/components/product-catalog-table";
import {
  CatalogProductCardSkeleton,
  CatalogProductGrid,
} from "@/components/features/products/catalog-product-grid";
import {
  type StorefrontProduct,
  StorefrontProductCard,
} from "@/components/storefront/storefront-product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";
import {
  getProductBrands,
  scopeByBrand,
  scopeVariantPrices,
} from "./_lib/brand-scope";

const ALL = "all";
const UNBRANDED = "unbranded";
const PAGE_SIZE = 12;

type ProductStatus = "active" | "inactive" | "draft";
type SortMode = "newest" | "name_asc" | "brand_asc";

type NamedRef = {
  id: number;
  name: string;
  slug?: string | null;
};

type AdminProduct = {
  id: number;
  name: string;
  slug?: string | null;
  sku?: string | null;
  catalogCode?: string | null;
  coreProduct?: { id: number; catalogCode: string } | null;
  shortDescription?: string | null;
  image?: string | null;
  images?: Array<{ imageUrl: string }> | null;
  price?: string | number | null;
  categoryId: number;
  subCategoryId?: number | null;
  category?: (NamedRef & { type?: NamedRef | null }) | null;
  subCategory?: NamedRef | null;
  brand?: NamedRef | null;
  productBrands?: Array<{ brandId: number; brand?: NamedRef | null }>;
  variants?: Array<{
    id: number;
    brandId?: number | null;
    sku?: string | null;
    unitLabel?: string | null;
    price?: string | number | null;
    isActive?: boolean | null;
  }>;
  variantPrices?: Array<{
    id: number;
    brandId?: number | null;
    consumerPrice?: string | number | null;
    isActive?: boolean | null;
    variantOption?: { name: string } | null;
  }>;
  status?: ProductStatus;
  createdAt?: string | Date | null;
};

/** One card per product and brand, shaped for the public storefront card. */
type ListingCard = {
  key: string;
  productId: number;
  brandId: number | null;
  brandName: string;
  productName: string;
  systemId: string;
  typeId: number | null;
  categoryId: number;
  subCategoryId: number | null;
  status: ProductStatus;
  createdAt: string | Date | null;
  searchText: string;
  storefront: StorefrontProduct;
};

type FilterOption = { id: number; name: string };

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function toPrice(value: string | number | null | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function uniqueOptions(items: Array<FilterOption | null>) {
  const map = new Map<number, string>();
  for (const item of items) {
    if (item) map.set(item.id, item.name);
  }
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function buildListingCards(products: AdminProduct[]): ListingCard[] {
  const cards: ListingCard[] = [];

  for (const product of products) {
    const brands = getProductBrands(product);
    const cardBrands =
      brands.length > 0 ? brands : [{ id: 0, name: "Unbranded" }];
    const hasSingleBrand = brands.length === 1;

    for (const brand of cardBrands) {
      const brandId = brands.length > 0 ? brand.id : null;
      const prices = scopeVariantPrices(
        product.variantPrices ?? [],
        brandId,
        hasSingleBrand,
      );
      const variants: StorefrontProduct["variants"] =
        prices.length > 0
          ? prices.map((variantPrice) => ({
              variantId: variantPrice.id,
              sku: null,
              unitLabel: variantPrice.variantOption?.name?.trim() || "Variant",
              quantitySelectorLabel: null,
              displayPrice: String(toPrice(variantPrice.consumerPrice) ?? 0),
            }))
          : scopeByBrand(product.variants ?? [], brandId, hasSingleBrand)
              .filter((variant) => variant.isActive !== false)
              .map((variant) => ({
                variantId: variant.id,
                sku: variant.sku ?? null,
                unitLabel: variant.unitLabel?.trim() || "Variant",
                quantitySelectorLabel: null,
                displayPrice: String(toPrice(variant.price) ?? 0),
              }));
      const lowestPrice = Math.min(
        ...variants
          .map((variant) => Number(variant.displayPrice))
          .filter((price) => price > 0),
        toPrice(product.price) ?? Number.POSITIVE_INFINITY,
      );
      const systemId =
        product.coreProduct?.catalogCode || product.catalogCode || "";

      cards.push({
        key: `${product.id}-${brandId ?? UNBRANDED}`,
        productId: product.id,
        brandId,
        brandName: brand.name,
        productName: product.name,
        systemId,
        typeId: product.category?.type?.id ?? null,
        categoryId: product.category?.id ?? product.categoryId,
        subCategoryId: product.subCategoryId ?? null,
        status: product.status ?? "active",
        createdAt: product.createdAt ?? null,
        searchText: [
          product.name,
          product.shortDescription,
          systemId,
          product.catalogCode,
          brand.name,
          product.category?.type?.name,
          product.category?.name,
          product.subCategory?.name,
          ...variants.map((variant) => variant.unitLabel),
        ]
          .map(normalizeText)
          .join(" "),
        storefront: {
          id: product.id,
          name: product.name,
          slug: product.slug ?? String(product.id),
          image: product.image ?? "",
          images: product.images ?? [],
          brand: brandId != null ? { name: brand.name } : null,
          category: product.category
            ? {
                name: product.category.name,
                slug: product.category.slug ?? "",
              }
            : null,
          subCategory: product.subCategory
            ? {
                name: product.subCategory.name,
                slug: product.subCategory.slug ?? "",
              }
            : null,
          lowestDisplayPrice: Number.isFinite(lowestPrice) ? lowestPrice : 0,
          variantCount: variants.length,
          totalAvailableQty: 0,
          variants,
        },
      });
    }
  }

  return cards;
}

export default function AdminWebViewPage() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | typeof ALL>(
    ALL,
  );
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [subCategoryFilter, setSubCategoryFilter] = useState(ALL);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);

  const productsQuery = useQuery({
    ...orpc.product.getAdminWebViewProducts.queryOptions({ input: {} }),
    queryKey: ["admin-web-view"],
  });

  const products = (productsQuery.data?.products ?? []) as AdminProduct[];
  const listingCards = useMemo(() => buildListingCards(products), [products]);
  const searchText = normalizeText(deferredSearch);

  const typeOptions = useMemo(
    () => uniqueOptions(products.map((product) => product.category?.type ?? null)),
    [products],
  );
  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter(
            (product) =>
              typeFilter === ALL ||
              String(product.category?.type?.id ?? "") === typeFilter,
          )
          .map((product) => product.category ?? null),
      ),
    [products, typeFilter],
  );
  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category?.type?.id ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter),
          )
          .map((product) => product.subCategory ?? null),
      ),
    [products, typeFilter, categoryFilter],
  );

  const filteredCards = useMemo(() => {
    const cards = listingCards.filter(
      (card) =>
        (statusFilter === ALL || card.status === statusFilter) &&
        (typeFilter === ALL || String(card.typeId ?? "") === typeFilter) &&
        (categoryFilter === ALL || String(card.categoryId) === categoryFilter) &&
        (subCategoryFilter === ALL ||
          String(card.subCategoryId ?? "") === subCategoryFilter) &&
        (!searchText || card.searchText.includes(searchText)),
    );

    return [...cards].sort((left, right) => {
      if (sortMode === "name_asc") {
        return left.productName.localeCompare(right.productName);
      }
      if (sortMode === "brand_asc") {
        return left.brandName.localeCompare(right.brandName);
      }
      return (
        new Date(right.createdAt ?? 0).getTime() -
        new Date(left.createdAt ?? 0).getTime()
      );
    });
  }, [
    categoryFilter,
    listingCards,
    searchText,
    sortMode,
    statusFilter,
    subCategoryFilter,
    typeFilter,
  ]);

  // Reset to the first page whenever the result set changes via filters/search.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter changes, not on filteredCards identity
  useEffect(() => {
    setPage(1);
  }, [
    searchText,
    statusFilter,
    typeFilter,
    categoryFilter,
    subCategoryFilter,
    sortMode,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCards = filteredCards.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(
    () => ({
      cards: listingCards.length,
      products: new Set(
        products
          .map((product) => product.coreProduct?.id)
          .filter((id): id is number => id != null),
      ).size,
      brands: new Set(
        listingCards
          .map((card) => card.brandId)
          .filter((brandId): brandId is number => brandId != null),
      ).size,
    }),
    [listingCards, products],
  );

  const hasActiveFilters =
    search.trim() ||
    statusFilter !== ALL ||
    typeFilter !== ALL ||
    categoryFilter !== ALL ||
    subCategoryFilter !== ALL ||
    sortMode !== "newest";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter(ALL);
    setTypeFilter(ALL);
    setCategoryFilter(ALL);
    setSubCategoryFilter(ALL);
    setSortMode("newest");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 max-md:space-y-4">
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 p-5 max-md:p-4">
          <div className="flex min-w-0 items-center gap-3.5 max-md:gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 max-md:size-9">
              <Layers3 className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight max-md:text-base">
                Web View
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground max-md:text-xs">
                Products as customers see them on the website.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0 max-md:min-h-11">
            <Link href={`${ADMIN_BASE}/products/new`}>
              <PackagePlus className="size-4" />
              <span className="max-sm:sr-only">Add Product</span>
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <StatItem icon={Package} label="Product Cards" value={stats.cards} />
          <StatItem icon={Layers3} label="Core Products" value={stats.products} />
          <StatItem icon={Tags} label="Brands" value={stats.brands} />
        </div>
      </header>

      <section
        aria-label="Product filters"
        className="space-y-3 rounded-xl border bg-card p-4 shadow-sm max-md:p-3"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product, brand, System ID..."
                className="h-11 pl-10"
              />
            </div>
            {hasActiveFilters ? (
              <Button
                className="shrink-0 max-md:min-h-11"
                variant="ghost"
                size="sm"
                type="button"
                onClick={clearFilters}
              >
                <X aria-hidden="true" className="size-4" />
                Clear filters
              </Button>
            ) : null}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <Tabs
              className="min-w-0 flex-1"
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ProductStatus | typeof ALL)
              }
            >
              <TabsList className="grid w-full grid-cols-4 lg:w-auto">
                <TabsTrigger value={ALL}>All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select
              value={sortMode}
              onValueChange={(value) => setSortMode(value as SortMode)}
            >
              <SelectTrigger
                aria-label="Sort products"
                className="w-44 shrink-0 max-md:w-11 max-md:justify-center max-md:px-0 max-md:[&>svg:last-child]:hidden max-md:[&_[data-slot=select-value]]:hidden"
              >
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="name_asc">Product A-Z</SelectItem>
                <SelectItem value="brand_asc">Brand A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 max-md:gap-2">
          <FilterSelect
            compact={isMobile}
            label="Type"
            value={typeFilter}
            options={typeOptions}
            onValueChange={(value) => {
              setTypeFilter(value);
              setCategoryFilter(ALL);
              setSubCategoryFilter(ALL);
            }}
          />
          <FilterSelect
            compact={isMobile}
            label="Category"
            value={categoryFilter}
            options={categoryOptions}
            onValueChange={(value) => {
              setCategoryFilter(value);
              setSubCategoryFilter(ALL);
            }}
          />
          <FilterSelect
            compact={isMobile}
            label="Sub Category"
            value={subCategoryFilter}
            options={subCategoryOptions}
            onValueChange={setSubCategoryFilter}
          />
        </div>
      </section>

      {productsQuery.isLoading ? (
        <CatalogProductGrid withSidebar>
          {Array.from({ length: 8 }, (_, index) => (
            <CatalogProductCardSkeleton key={index} />
          ))}
        </CatalogProductGrid>
      ) : productsQuery.isError ? (
        <ProductListingError onRetry={() => productsQuery.refetch()} />
      ) : listingCards.length === 0 ? (
        <ProductListingEmpty />
      ) : filteredCards.length === 0 ? (
        <NoResultsState onClear={clearFilters} />
      ) : (
        <div className="space-y-5">
          <CatalogProductGrid withSidebar>
            {pagedCards.map((card) => (
              <StorefrontProductCard
                key={card.key}
                mode="reference"
                appearance="catalog"
                previewMode
                product={card.storefront}
                detailHref={`${ADMIN_BASE}/web-view/${card.productId}${
                  card.brandId != null ? `?brandId=${card.brandId}` : ""
                }`}
              />
            ))}
          </CatalogProductGrid>
          <ListingPagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function ListingPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const goTo = (next: number) => {
    onPageChange(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) goTo(page - 1);
            }}
            aria-disabled={page <= 1}
            className={
              page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
            }
          />
        </PaginationItem>
        {pages.map((pageNum, index) => (
          <PaginationItem
            key={pageNum === "ellipsis" ? `ellipsis-${index}` : pageNum}
          >
            {pageNum === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={pageNum === page}
                onClick={(event) => {
                  event.preventDefault();
                  goTo(pageNum);
                }}
              >
                {pageNum}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(event) => {
              event.preventDefault();
              if (page < totalPages) goTo(page + 1);
            }}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3.5 max-md:px-2 max-md:py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground max-md:hidden" />
      <div className="text-center md:text-left">
        <p className="text-lg font-semibold leading-none tabular-nums">
          {value.toLocaleString("en-BD")}
        </p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground max-md:text-[10px]">
          {label}
        </p>
      </div>
    </div>
  );
}

function ProductListingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border bg-card py-16 text-center shadow-sm">
      <AlertCircle className="mx-auto mb-3 size-10 text-destructive" />
      <p className="font-semibold">Failed to load products</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        The product listing could not be loaded right now.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function ProductListingEmpty() {
  return (
    <div className="rounded-xl border bg-card py-20 text-center shadow-sm">
      <Package className="mx-auto mb-4 size-14 text-muted-foreground/30" />
      <p className="text-lg font-semibold">No products yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Create products with brands and variants to populate this listing.
      </p>
      <Button asChild className="mt-5">
        <Link href={`${ADMIN_BASE}/products/new`}>
          <PackagePlus className="size-4" />
          Add Product
        </Link>
      </Button>
    </div>
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border bg-card py-16 text-center shadow-sm">
      <Filter className="mx-auto mb-3 size-10 text-muted-foreground/30" />
      <p className="font-semibold">No products match this view</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Try a different search, status, type, category, or sub category.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        <X className="size-4" />
        Clear filters
      </Button>
    </div>
  );
}
