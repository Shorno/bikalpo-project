"use client";

import {
  AlertCircle,
  CreditCard,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  MapPin,
  Package,
  Phone,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Store,
  Truck,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { CatalogProductGrid } from "@/components/features/products/catalog-product-grid";
import { HorizontalScrollRow } from "@/components/storefront/horizontal-scroll-row";
import {
  type StorefrontProduct,
  StorefrontProductCard,
} from "@/components/storefront/storefront-product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMyStorePreview,
  useMyStoreStats,
} from "@/hooks/use-store-preview-api";
import {
  getPublicAppBaseUrl,
  getShopStorefrontUrl,
} from "@/lib/customer-storefront-preview";
import { getRetailerProductHref } from "@/lib/retailer-storefront-url";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────

type StockFilter = "all" | "in_stock" | "low" | "out_of_stock";
type PreviewData = NonNullable<ReturnType<typeof useMyStorePreview>["data"]>;
type PreviewProduct = PreviewData["products"][number];

interface StoreCard {
  key: string;
  product: PreviewProduct;
  storefront: StorefrontProduct;
}

// One card per product + brand, the same split the public catalog uses.
function buildStoreCards(products: PreviewProduct[]): StoreCard[] {
  const cards: StoreCard[] = [];

  for (const product of products) {
    const byBrand = new Map<number | null, PreviewProduct["variants"]>();
    for (const variant of product.variants) {
      const key = variant.brandId ?? null;
      byBrand.set(key, [...(byBrand.get(key) ?? []), variant]);
    }

    for (const [brandId, variants] of byBrand) {
      const prices = variants
        .map((variant) => Number(variant.retailPrice))
        .filter((price) => price > 0);
      cards.push({
        key: `${product.productId}-${brandId ?? 0}`,
        product,
        storefront: {
          id: product.productId,
          name: product.name,
          slug: product.slug ?? String(product.productId),
          image: product.image ?? "",
          images: [],
          category: product.category
            ? { name: product.category.name, slug: product.category.slug }
            : null,
          subCategory: null,
          brand: variants[0]?.brandName ? { name: variants[0].brandName } : null,
          lowestRetailPrice: prices.length > 0 ? Math.min(...prices) : 0,
          variantCount: variants.length,
          totalAvailableQty: variants.reduce(
            (sum, variant) => sum + Number(variant.availableQty || 0),
            0,
          ),
          variants: variants.map((variant) => ({
            variantId: variant.variantId,
            sku: variant.sku ?? null,
            unitLabel: variant.unitLabel?.trim() || "Variant",
            quantitySelectorLabel: null,
            retailPrice: String(variant.retailPrice ?? 0),
            availableQty: String(variant.availableQty ?? 0),
          })),
        },
      });
    }
  }

  return cards;
}

const stockFilters: Array<{ value: StockFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In Stock" },
  { value: "low", label: "Low Stock" },
  { value: "out_of_stock", label: "Out" },
];

// ─── Main Page ───────────────────────────────────────────────────

export default function MyStorePage() {
  const { data, isLoading } = useMyStorePreview();
  const { data: stats } = useMyStoreStats();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");

  const cards = useMemo(
    () => buildStoreCards(data?.products ?? []),
    [data?.products],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading store preview...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <Store className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-lg font-medium text-muted-foreground">
            Store data not available
          </p>
        </div>
      </div>
    );
  }

  const { store, categories } = data;
  const customerPreviewUrl = store.slug
    ? getShopStorefrontUrl(store.slug, { previewMode: true })
    : null;
  const publicBaseUrl = getPublicAppBaseUrl(
    typeof window === "undefined" ? undefined : window.location.origin,
  );

  // Filter cards
  const searchTerm = search.trim().toLowerCase();
  const filteredCards = cards.filter(({ product, storefront }) => {
    if (selectedCategory && product.category?.id !== selectedCategory) {
      return false;
    }
    if (stockFilter !== "all" && product.stockStatus !== stockFilter) {
      return false;
    }
    if (searchTerm) {
      return (
        product.name.toLowerCase().includes(searchTerm) ||
        (storefront.brand?.name.toLowerCase().includes(searchTerm) ?? false)
      );
    }
    return true;
  });

  const metrics = [
    {
      icon: Star,
      label: "Rating",
      value: stats?.avgRating ? `${stats.avgRating.toFixed(1)} ★` : "—",
    },
    {
      icon: ShoppingBag,
      label: "Orders",
      value: (stats?.totalOrders ?? 0).toLocaleString("en-BD"),
    },
    {
      icon: Heart,
      label: "Followers",
      value: (stats?.followerCount ?? 0).toLocaleString("en-BD"),
    },
  ];

  const headerButtonClass =
    "h-9 border-0 bg-white/20 text-white hover:bg-white/30 max-sm:px-2 max-sm:text-xs";

  return (
    <div className="space-y-6">
      {/* ── Preview Mode Banner ── */}
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Preview Mode</span> — This is how
              your store looks to customers. Cart and ordering are disabled.
            </p>
            {!store.slug && (
              <p className="mt-1 text-xs text-amber-700">
                A public storefront link will be available after a shop slug is
                assigned.
              </p>
            )}
          </div>
        </div>
        {customerPreviewUrl ? (
          <Button
            asChild
            size="sm"
            className="shrink-0 bg-amber-700 text-white hover:bg-amber-800"
          >
            <a
              href={customerPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View as customer
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button size="sm" disabled className="shrink-0">
            View as customer
          </Button>
        )}
      </div>

      {/* ── Store Header ── */}
      <Card className="overflow-hidden py-0">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white max-sm:p-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center shrink-0 max-sm:size-12">
              {store.image ? (
                <img
                  src={store.image}
                  alt={store.name}
                  className="w-14 h-14 rounded-lg object-cover max-sm:size-10"
                />
              ) : (
                <Store className="h-8 w-8 text-white max-sm:size-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold max-sm:text-lg">
                {store.name || "My Store"}
              </h1>
              {store.address && (
                <p className="text-emerald-100 text-sm flex items-start gap-1 mt-0.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {store.address}
                </p>
              )}
              {store.phoneNumber && (
                <p className="text-emerald-100 text-sm flex items-center gap-1 mt-0.5">
                  <Phone className="h-3.5 w-3.5" /> {store.phoneNumber}
                </p>
              )}
            </div>
          </div>

          {/* Stats row: rating, orders, followers */}
          <div className="grid grid-cols-3 gap-3 mt-5 max-sm:mt-4 max-sm:gap-2">
            {metrics.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="bg-white/15 rounded-lg p-2.5 text-center"
              >
                <Icon className="h-4 w-4 mx-auto mb-1 text-emerald-100" />
                <p className="text-sm font-bold tabular-nums">{value}</p>
                <p className="text-[10px] text-emerald-200">{label}</p>
              </div>
            ))}
          </div>

          {/* Action buttons: Follow, Contact Store, Report Issue */}
          <div className="mt-4 flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-3">
            <Button
              size="sm"
              variant="secondary"
              className={headerButtonClass}
              disabled
            >
              <Heart className="h-3.5 w-3.5" /> Follow
            </Button>
            {store.phoneNumber ? (
              <Button
                size="sm"
                variant="secondary"
                className={headerButtonClass}
                asChild
              >
                <a href={`tel:${store.phoneNumber}`}>
                  <Phone className="h-3.5 w-3.5" /> Contact Store
                </a>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className={headerButtonClass}
                disabled
              >
                <Phone className="h-3.5 w-3.5" /> Contact Store
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className={headerButtonClass}
              disabled
            >
              <AlertCircle className="h-3.5 w-3.5" /> Report Issue
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Category Navigation ── */}
      {categories.length > 0 && (
        <HorizontalScrollRow label="Product categories">
          <CategoryChip
            active={!selectedCategory}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </CategoryChip>
          {categories.map((cat) => (
            <CategoryChip
              key={cat.id}
              active={selectedCategory === cat.id}
              onClick={() =>
                setSelectedCategory(cat.id === selectedCategory ? null : cat.id)
              }
            >
              {cat.name}
              <span className="ml-1.5 text-xs opacity-70">
                {cat.productCount}
              </span>
            </CategoryChip>
          ))}
        </HorizontalScrollRow>
      )}

      {/* ── Search + Quick Filter Bar (one row; stock filter is a dropdown on mobile) ── */}
      <div className="flex gap-3 max-sm:gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={stockFilter}
          onValueChange={(value) => setStockFilter(value as StockFilter)}
        >
          <SelectTrigger
            aria-label="Filter by stock"
            className="relative w-9 shrink-0 justify-center px-0 shadow-none sm:hidden [&>svg:last-child]:hidden [&_[data-slot=select-value]]:hidden"
          >
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            {stockFilter !== "all" && (
              <span
                className="absolute top-1 right-1 size-2 rounded-full bg-emerald-600"
                aria-hidden="true"
              />
            )}
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {stockFilters.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.value === "out_of_stock" ? "Out of Stock" : filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1.5 max-sm:hidden">
          {stockFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStockFilter(filter.value)}
              aria-pressed={stockFilter === filter.value}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                stockFilter === filter.value
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Grid ── */}
      {filteredCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              No products found
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? "Try a different search term"
                : "Add products from the Product Catalog"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <CatalogProductGrid withSidebar>
          {filteredCards.map((card) => (
            <StorefrontProductCard
              key={card.key}
              mode="reference"
              appearance="catalog"
              previewMode
              product={card.storefront}
              detailHref={
                store.slug
                  ? `${publicBaseUrl}${getRetailerProductHref({
                      shopSlug: store.slug,
                      productSlug: card.storefront.slug,
                      previewMode: true,
                    })}`
                  : "#"
              }
            />
          ))}
        </CatalogProductGrid>
      )}

      {/* ── Trust & Service Info ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Home Delivery</p>
              <p className="text-xs text-muted-foreground">
                Same day delivery available
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Cash / Online Payment</p>
              <p className="text-xs text-muted-foreground">
                bKash / Nagad supported
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-emerald-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      {children}
    </button>
  );
}
