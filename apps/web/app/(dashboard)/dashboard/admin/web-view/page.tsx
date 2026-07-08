"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Eye,
  Filter,
  ImageIcon,
  Layers3,
  Package,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Tags,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import {
  getProductBrands,
  scopeByBrand,
  scopeVariantPrices,
} from "./_lib/brand-scope";

const ALL = "all";
const UNBRANDED = "unbranded";

type ProductStatus = "active" | "inactive" | "draft";
type ProductVisibility = "public" | "private";
type SortMode = "newest" | "name_asc" | "brand_asc";

type BrandSummary = {
  id: number;
  name: string;
  slug?: string | null;
};

type ProductBrandLink = {
  id?: number;
  brandId: number;
  brand?: BrandSummary | null;
};

type VariantOptionSummary = {
  id: number;
  name: string;
  unit?: string | null;
  size?: string | null;
  variantType?: string | null;
};

type ProductVariantPriceSummary = {
  id: number;
  variantOptionId: number;
  brandId?: number | null;
  consumerPrice?: string | number | null;
  isActive?: boolean | null;
  variantOption?: VariantOptionSummary | null;
};

type ProductVariantSummary = {
  id: number;
  brandId?: number | null;
  unitLabel?: string | null;
  variantType?: string | null;
};

type AdminProduct = {
  id: number;
  name: string;
  slug?: string | null;
  sku?: string | null;
  shortDescription?: string | null;
  image?: string | null;
  price?: string | number | null;
  categoryId: number;
  subCategoryId?: number | null;
  category?: {
    id: number;
    name: string;
    slug?: string | null;
  } | null;
  subCategory?: {
    id: number;
    name: string;
    slug?: string | null;
  } | null;
  brand?: BrandSummary | null;
  productBrands?: ProductBrandLink[];
  variants?: ProductVariantSummary[];
  variantPrices?: ProductVariantPriceSummary[];
  status?: ProductStatus;
  visibility?: ProductVisibility;
  isFeatured?: boolean;
  createdAt?: string | Date | null;
};

type ListingVariant = {
  id: string;
  label: string;
  detail: string | null;
  priceLabel: string | null;
};

type ProductListingCard = {
  id: string;
  productId: number;
  productName: string;
  shortDescription: string | null;
  image: string | null;
  sku: string;
  brandId: number | null;
  brandName: string;
  categoryId: number | null;
  categoryName: string;
  subCategoryName: string | null;
  status: ProductStatus;
  visibility: ProductVisibility;
  isFeatured: boolean;
  createdAt: string | Date | null;
  variants: ListingVariant[];
};

type FilterOption = {
  value: string;
  label: string;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function formatMoney(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return `BDT ${amount.toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function uniqueOptions(items: FilterOption[]) {
  const map = new Map<string, string>();
  for (const item of items) {
    if (item.value && item.label) map.set(item.value, item.label);
  }

  return Array.from(map, ([value, label]) => ({ value, label })).sort(
    (left, right) => left.label.localeCompare(right.label),
  );
}

function getVariantLabel(variantPrice: ProductVariantPriceSummary) {
  const option = variantPrice.variantOption;
  const label = option?.name?.trim() || "Variant";
  const detailParts = [option?.size, option?.unit].filter(Boolean);
  const detail = detailParts.length > 0 ? detailParts.join(" ") : null;

  return {
    label,
    detail,
  };
}

function buildListingCards(products: AdminProduct[]) {
  const cards: ProductListingCard[] = [];

  for (const product of products) {
    const brands = getProductBrands(product);
    const cardBrands =
      brands.length > 0
        ? brands
        : [{ id: 0, name: "Unbranded", slug: UNBRANDED }];
    const hasSingleBrand = cardBrands.length === 1 && brands.length === 1;

    for (const brand of cardBrands) {
      const brandId = brands.length > 0 ? brand.id : null;
      const scopedPrices = scopeVariantPrices(
        product.variantPrices ?? [],
        brandId,
        hasSingleBrand,
      );
      const priceVariants = scopedPrices.map((variantPrice) => {
        const { label, detail } = getVariantLabel(variantPrice);

        return {
          id: `price-${variantPrice.id}`,
          label,
          detail,
          priceLabel: formatMoney(variantPrice.consumerPrice),
        };
      });
      const fallbackVariants =
        priceVariants.length > 0
          ? []
          : scopeByBrand(
              product.variants ?? [],
              brandId,
              hasSingleBrand,
            ).map((variant) => ({
              id: `variant-${variant.id}`,
              label: variant.unitLabel?.trim() || "Variant",
              detail: variant.variantType ?? null,
              priceLabel: null,
            }));

      cards.push({
        id: `${product.id}-${brandId ?? UNBRANDED}`,
        productId: product.id,
        productName: product.name,
        shortDescription: product.shortDescription?.trim() || null,
        image: product.image ?? null,
        sku: product.sku?.trim() || product.slug?.trim() || `PRD-${product.id}`,
        brandId,
        brandName: brand.name,
        categoryId: product.category?.id ?? product.categoryId ?? null,
        categoryName: product.category?.name ?? "Uncategorized",
        subCategoryName: product.subCategory?.name ?? null,
        status: product.status ?? "active",
        visibility: product.visibility ?? "public",
        isFeatured: product.isFeatured ?? false,
        createdAt: product.createdAt ?? null,
        variants: [...priceVariants, ...fallbackVariants],
      });
    }
  }

  return cards;
}

function matchesSearch(card: ProductListingCard, searchText: string) {
  if (!searchText) return true;

  const searchable = [
    card.productName,
    card.shortDescription,
    card.sku,
    card.brandName,
    card.categoryName,
    card.subCategoryName,
    ...card.variants.flatMap((variant) => [
      variant.label,
      variant.detail,
      variant.priceLabel,
    ]),
  ]
    .map((value) => normalizeText(value ?? undefined))
    .join(" ");

  return searchable.includes(searchText);
}

function statusBadgeClass(status: ProductStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusLabel(status: ProductStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminWebViewPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | typeof ALL>(
    ALL,
  );
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [brandFilter, setBrandFilter] = useState(ALL);
  const [variantFilter, setVariantFilter] = useState(ALL);
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const productsQuery = useQuery({
    ...orpc.product.getAll.queryOptions({ input: {} }),
    queryKey: ["admin-web-view"],
  });

  const products = (productsQuery.data?.products ?? []) as AdminProduct[];
  const listingCards = useMemo(() => buildListingCards(products), [products]);
  const searchText = normalizeText(deferredSearch);

  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        listingCards.map((card) => ({
          value: card.categoryId ? String(card.categoryId) : "uncategorized",
          label: card.categoryName,
        })),
      ),
    [listingCards],
  );
  const brandOptions = useMemo(
    () =>
      uniqueOptions(
        listingCards.map((card) => ({
          value: card.brandId ? String(card.brandId) : UNBRANDED,
          label: card.brandName,
        })),
      ),
    [listingCards],
  );
  const variantOptions = useMemo(
    () =>
      uniqueOptions(
        listingCards.flatMap((card) =>
          card.variants.map((variant) => ({
            value: normalizeText(variant.label),
            label: variant.label,
          })),
        ),
      ),
    [listingCards],
  );

  const filteredCards = useMemo(() => {
    const cards = listingCards.filter((card) => {
      const matchesStatus =
        statusFilter === ALL || card.status === statusFilter;
      const matchesCategory =
        categoryFilter === ALL ||
        String(card.categoryId ?? "uncategorized") === categoryFilter;
      const matchesBrand =
        brandFilter === ALL ||
        String(card.brandId ?? UNBRANDED) === brandFilter;
      const matchesVariant =
        variantFilter === ALL ||
        card.variants.some(
          (variant) => normalizeText(variant.label) === variantFilter,
        );

      return (
        matchesStatus &&
        matchesCategory &&
        matchesBrand &&
        matchesVariant &&
        matchesSearch(card, searchText)
      );
    });

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
    brandFilter,
    categoryFilter,
    listingCards,
    searchText,
    sortMode,
    statusFilter,
    variantFilter,
  ]);

  const stats = useMemo(() => {
    const productIds = new Set(listingCards.map((card) => card.productId));
    const brandIds = new Set(
      listingCards
        .map((card) => card.brandId)
        .filter((brandId): brandId is number => brandId != null),
    );

    return {
      cards: listingCards.length,
      products: productIds.size,
      brands: brandIds.size,
    };
  }, [listingCards]);

  const hasActiveFilters =
    search.trim() ||
    statusFilter !== ALL ||
    categoryFilter !== ALL ||
    brandFilter !== ALL ||
    variantFilter !== ALL ||
    sortMode !== "newest";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter(ALL);
    setCategoryFilter(ALL);
    setBrandFilter(ALL);
    setVariantFilter(ALL);
    setSortMode("newest");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Layers3 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Product Listing
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Brand-specific product cards with scoped variant pricing.
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/admin/products/new">
              <PackagePlus className="h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <StatItem icon={Package} label="Listing Cards" value={stats.cards} />
          <StatItem
            icon={Layers3}
            label="Core Products"
            value={stats.products}
          />
          <StatItem icon={Tags} label="Brands" value={stats.brands} />
        </div>
      </header>

      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, brand, SKU, variant..."
              className="pl-9"
            />
          </div>

          <Tabs
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
            <SelectTrigger className="lg:w-44">
              <SlidersHorizontal className="mr-1.5 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="name_asc">Product A-Z</SelectItem>
              <SelectItem value="brand_asc">Brand A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <FilterSelect
            label="Category"
            value={categoryFilter}
            placeholder="All Categories"
            options={categoryOptions}
            onChange={setCategoryFilter}
          />
          <FilterSelect
            label="Brand"
            value={brandFilter}
            placeholder="All Brands"
            options={brandOptions}
            onChange={setBrandFilter}
          />
          <FilterSelect
            label="Variant"
            value={variantFilter}
            placeholder="All Variants"
            options={variantOptions}
            onChange={setVariantFilter}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-muted-foreground">
          <span>
            Showing{" "}
            <span className="font-medium text-foreground">
              {filteredCards.length.toLocaleString("en-BD")}
            </span>{" "}
            of {listingCards.length.toLocaleString("en-BD")} brand listings
          </span>
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          ) : null}
        </div>
      </section>

      {productsQuery.isLoading ? (
        <ProductListingSkeleton />
      ) : productsQuery.isError ? (
        <ProductListingError onRetry={() => productsQuery.refetch()} />
      ) : listingCards.length === 0 ? (
        <ProductListingEmpty />
      ) : filteredCards.length === 0 ? (
        <NoResultsState onClear={clearFilters} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => (
            <ProductBrandCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
    <div className="flex items-center justify-center gap-3 px-4 py-3.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold leading-none tabular-nums">
          {value.toLocaleString("en-BD")}
        </p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

function ProductBrandCard({ card }: { card: ProductListingCard }) {
  const [imageError, setImageError] = useState(false);
  const hasImage = card.image && !imageError;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[16/10] overflow-hidden border-b bg-muted/40">
        {hasImage ? (
          <Image
            src={card.image ?? ""}
            alt={card.productName}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImageError(true)}
            unoptimized={card.image?.startsWith("http") ?? false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn("backdrop-blur-sm", statusBadgeClass(card.status))}
          >
            {statusLabel(card.status)}
          </Badge>
          {card.visibility === "private" ? (
            <Badge
              variant="outline"
              className="border-slate-200 bg-white/90 text-slate-600 backdrop-blur-sm"
            >
              Private
            </Badge>
          ) : null}
        </div>
        {card.isFeatured ? (
          <Badge className="absolute right-3 top-3 bg-slate-900/90 text-white backdrop-blur-sm">
            Featured
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-primary">
            {card.brandName}
          </p>
          <h2 className="mt-1 line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug">
            {card.productName}
          </h2>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            {card.shortDescription ?? "No short description"}
          </p>
        </div>

        <div className="flex flex-1 flex-col">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Variants
            {card.variants.length > 0 ? (
              <span className="ml-1 text-muted-foreground/70">
                · {card.variants.length}
              </span>
            ) : null}
          </p>

          {card.variants.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
              No variants configured for this brand.
            </div>
          ) : (
            <div className="thin-scrollbar max-h-36 space-y-2 overflow-y-auto pr-1">
              {card.variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {variant.label}
                    </p>
                    {variant.detail ? (
                      <p className="text-xs text-muted-foreground">
                        {variant.detail}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold",
                      variant.priceLabel
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {variant.priceLabel ?? "No price"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Created {formatDate(card.createdAt)}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/dashboard/admin/web-view/${card.productId}${
              card.brandId != null ? `?brandId=${card.brandId}` : ""
            }`}
          >
            <Eye className="h-4 w-4" />
            View Details
          </Link>
        </Button>
      </div>
    </article>
  );
}

function ProductListingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-4 p-4">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductListingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border bg-card py-16 text-center shadow-sm">
      <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
      <p className="font-semibold text-red-700">Failed to load products</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        The product listing could not be loaded right now.
      </p>
      <Button
        variant="destructive"
        size="sm"
        className="mt-4"
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

function ProductListingEmpty() {
  return (
    <div className="rounded-xl border bg-card py-20 text-center shadow-sm">
      <Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground/30" />
      <p className="text-lg font-semibold">No products yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Create products with brands and variants to populate this listing.
      </p>
      <Button asChild className="mt-5">
        <Link href="/dashboard/admin/products/new">
          <PackagePlus className="h-4 w-4" />
          Add Product
        </Link>
      </Button>
    </div>
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border bg-card py-16 text-center shadow-sm">
      <Filter className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="font-semibold">No product cards match this view</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Try changing the search, brand, category, variant, or status filters.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        <X className="h-4 w-4" />
        Clear Filters
      </Button>
    </div>
  );
}
