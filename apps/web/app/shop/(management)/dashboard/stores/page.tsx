"use client";

import Image from "next/image";
import { useState } from "react";
import {
  AlertCircle,
  CreditCard,
  Eye,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Search,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useMyStorePreview, useMyStoreStats } from "@/hooks/use-store-preview-api";

type StockFilter = "all" | "in_stock" | "low" | "out_of_stock";
type PreviewStockStatus = Exclude<StockFilter, "all">;

type StoreCategory = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
};

type StoreBrand = {
  id: number;
  name: string;
  logo: string | null;
};

type StoreVariant = {
  variantId: number;
  sku: string | null;
  unitLabel: string;
  weightKg: string;
  packType: string | null;
  brandId: number | null;
  brandName: string | null;
  brandLogo: string | null;
  retailPrice: string | null;
  availableQty: number;
  isPackReturnRequired: boolean | null;
  packDepositAmount: string | null;
};

type StoreProduct = {
  productId: number;
  name: string;
  slug: string;
  image: string | null;
  shortDescription: string | null;
  isReturnablePack: boolean | null;
  category: StoreCategory | null;
  brands: StoreBrand[];
  variants: StoreVariant[];
  totalStock: number;
  stockStatus: PreviewStockStatus;
  lowestPrice: number | null;
  variantCount: number;
};

type StorePreviewCard = {
  cardKey: string;
  productId: number;
  name: string;
  displayName: string;
  slug: string;
  image: string | null;
  shortDescription: string | null;
  isReturnablePack: boolean | null;
  category: StoreCategory | null;
  brandId: number | null;
  brandName: string | null;
  variants: StoreVariant[];
  totalStock: number;
  stockStatus: PreviewStockStatus;
  lowestPrice: number | null;
};

const BRAND_STOCK_LOW_THRESHOLD = 10;

function getStockStatus(totalStock: number): PreviewStockStatus {
  if (totalStock <= 0) return "out_of_stock";
  if (totalStock <= BRAND_STOCK_LOW_THRESHOLD) return "low";
  return "in_stock";
}

function getDisplayName(productName: string, brandName: string | null) {
  if (!brandName) {
    return productName;
  }

  const normalizedBrand = brandName.trim().toLowerCase();
  const normalizedProduct = productName.trim().toLowerCase();

  if (!normalizedBrand || normalizedProduct.startsWith(normalizedBrand)) {
    return productName;
  }

  return `${brandName} ${productName}`;
}

function getLowestPrice(variants: StoreVariant[], fallback: number | null) {
  const prices = variants
    .map((variant) => Number(variant.retailPrice))
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : fallback;
}

function formatPriceLabel(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return `BDT ${amount.toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function previewStatusLabel(status: PreviewStockStatus) {
  switch (status) {
    case "in_stock":
      return "In Stock";
    case "low":
      return "Low Stock";
    case "out_of_stock":
      return "Out of Stock";
  }
}

function previewStatusBadgeClass(status: PreviewStockStatus) {
  switch (status) {
    case "in_stock":
      return "border-emerald-200 bg-emerald-50/95 text-emerald-700";
    case "low":
      return "border-amber-200 bg-amber-50/95 text-amber-700";
    case "out_of_stock":
      return "border-red-200 bg-red-50/95 text-red-700";
  }
}

function buildStorePreviewCards(products: StoreProduct[]): StorePreviewCard[] {
  const cards: StorePreviewCard[] = [];

  for (const product of products) {
    const baseCard = {
      productId: product.productId,
      name: product.name,
      slug: product.slug,
      image: product.image,
      shortDescription: product.shortDescription,
      isReturnablePack: product.isReturnablePack,
      category: product.category,
    };

    if (product.brands.length === 0) {
      const variants = product.variants.filter((variant) => !variant.brandId);
      const totalStock = variants.reduce(
        (sum, variant) => sum + Number(variant.availableQty || 0),
        0,
      );

      cards.push({
        ...baseCard,
        cardKey: `${product.productId}-unbranded`,
        displayName: product.name,
        brandId: null,
        brandName: null,
        variants,
        totalStock,
        stockStatus: getStockStatus(totalStock),
        lowestPrice: getLowestPrice(variants, product.lowestPrice),
      });
      continue;
    }

    for (const brand of product.brands) {
      const variants = product.variants.filter(
        (variant) => variant.brandId === brand.id,
      );
      const totalStock = variants.reduce(
        (sum, variant) => sum + Number(variant.availableQty || 0),
        0,
      );

      cards.push({
        ...baseCard,
        cardKey: `${product.productId}-${brand.id}`,
        displayName: getDisplayName(product.name, brand.name),
        brandId: brand.id,
        brandName: brand.name,
        variants,
        totalStock,
        stockStatus: getStockStatus(totalStock),
        lowestPrice: getLowestPrice(variants, product.lowestPrice),
      });
    }
  }

  return cards.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export default function MyStorePage() {
  const { data, isLoading } = useMyStorePreview();
  const { data: stats } = useMyStoreStats();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number | null>>({});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading store preview...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <Store className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-lg font-medium text-muted-foreground">Store data not available</p>
        </div>
      </div>
    );
  }

  const { store, categories } = data;
  const displayProducts = buildStorePreviewCards(data.products as StoreProduct[]);

  let filteredProducts = displayProducts;

  if (selectedCategory) {
    filteredProducts = filteredProducts.filter(
      (product) => product.category?.id === selectedCategory,
    );
  }

  if (stockFilter !== "all") {
    filteredProducts = filteredProducts.filter(
      (product) => product.stockStatus === stockFilter,
    );
  }

  if (search.trim()) {
    const normalizedSearch = search.toLowerCase();
    filteredProducts = filteredProducts.filter((product) =>
      product.displayName.toLowerCase().includes(normalizedSearch) ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      String(product.brandName || "").toLowerCase().includes(normalizedSearch),
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <Eye className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Preview Mode</span> - This is how your store looks to customers.
          Cart and ordering are disabled.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              {store.image ? (
                <img src={store.image} alt={store.name} className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <Store className="h-8 w-8 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{store.name || "My Store"}</h1>
              {store.address && (
                <p className="text-emerald-100 text-sm flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" /> {store.address}
                </p>
              )}
              {store.phoneNumber && (
                <p className="text-emerald-100 text-sm flex items-center gap-1 mt-0.5">
                  <Phone className="h-3.5 w-3.5" /> {store.phoneNumber}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { icon: Star, label: "Rating", value: stats?.avgRating ? `${stats.avgRating} *` : "-" },
              { icon: ShoppingCart, label: "Orders", value: stats?.totalOrders?.toLocaleString() ?? "0" },
              { icon: Users, label: "Customers", value: stats?.totalCustomers?.toLocaleString() ?? "0" },
              { icon: Package, label: "Products", value: displayProducts.length.toString() },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/15 rounded-lg p-2.5 text-center">
                <Icon className="h-4 w-4 mx-auto mb-1 text-emerald-100" />
                <p className="text-sm font-bold">{value}</p>
                <p className="text-[10px] text-emerald-200">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0"
              disabled
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Chat
            </Button>
            {store.phoneNumber && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                asChild
              >
                <a href={`tel:${store.phoneNumber}`}>
                  <Phone className="h-3.5 w-3.5 mr-1.5" /> Call
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((category: StoreCategory) => (
            <button
              key={category.id}
              type="button"
              onClick={() =>
                setSelectedCategory(category.id === selectedCategory ? null : category.id)
              }
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {category.name}
              <span className="ml-1.5 text-xs opacity-70">{category.productCount}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "in_stock", "low", "out_of_stock"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStockFilter(filter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                stockFilter === filter
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100"
              }`}
            >
              {filter === "all"
                ? "All"
                : filter === "in_stock"
                  ? "In Stock"
                  : filter === "low"
                    ? "Low Stock"
                    : "Out"}
            </button>
          ))}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No products found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term" : "Add products from the Product Catalog"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.cardKey}
              product={product}
              selectedVariant={selectedVariants[product.cardKey] ?? null}
              onSelectVariant={(variantId) =>
                setSelectedVariants((previous) => ({
                  ...previous,
                  [product.cardKey]: variantId,
                }))
              }
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Home Delivery</p>
              <p className="text-xs text-muted-foreground">Same day delivery available</p>
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
              <p className="text-xs text-muted-foreground">bKash / Nagad supported</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 mb-3">
            <Store className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{store.name || "My Store"}</p>
              {store.address && (
                <p className="text-xs text-muted-foreground">{store.address}</p>
              )}
            </div>
          </div>
          <Separator className="my-3" />
          <div className="flex flex-wrap gap-2">
            {store.phoneNumber && (
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${store.phoneNumber}`}>
                  <Phone className="h-3.5 w-3.5 mr-1.5" /> Call Now
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" disabled>
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Chat Store
            </Button>
            <Button size="sm" variant="outline" disabled>
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Report Issue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductCard({
  product,
  selectedVariant,
  onSelectVariant,
}: {
  product: StorePreviewCard;
  selectedVariant: number | null;
  onSelectVariant: (variantId: number | null) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const activeVariant = selectedVariant
    ? product.variants.find((variant) => variant.variantId === selectedVariant)
    : product.variants[0];
  const hasImage = Boolean(product.image && !imageError);
  const hasPackReturn = product.isReturnablePack ||
    product.variants.some((variant) => variant.isPackReturnRequired);
  const packReturnVariants = product.variants.filter(
    (variant) => variant.isPackReturnRequired,
  );
  const activeVariantPrice = formatPriceLabel(activeVariant?.retailPrice ?? null);
  const fallbackPrice = formatPriceLabel(product.lowestPrice);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden border-b bg-muted/40">
        {hasImage ? (
          <Image
            src={product.image ?? ""}
            alt={product.displayName}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImageError(true)}
            unoptimized={product.image?.startsWith("http") ?? false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn("backdrop-blur-sm", previewStatusBadgeClass(product.stockStatus))}
          >
            {previewStatusLabel(product.stockStatus)}
          </Badge>
          {hasPackReturn ? (
            <Badge
              variant="outline"
              className="border-amber-200 bg-white/90 text-amber-700 backdrop-blur-sm"
            >
              Returnable Pack
            </Badge>
          ) : null}
        </div>
        <Badge className="absolute right-3 top-3 bg-slate-900/90 text-white backdrop-blur-sm">
          Preview
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-primary">
            {product.brandName || "Unbranded"}
          </p>
          <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-snug">
            {product.displayName}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {product.shortDescription ?? "No short description"}
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-primary">
              {activeVariantPrice ?? fallbackPrice ?? "No price"}
            </span>
            {activeVariant?.unitLabel ? (
              <span className="text-xs text-muted-foreground">/{activeVariant.unitLabel}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Variants
            {product.variants.length > 0 ? (
              <span className="ml-1 text-muted-foreground/70">
                · {product.variants.length}
              </span>
            ) : null}
          </p>

          {product.variants.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
              No variants configured for this brand.
            </div>
          ) : (
            <div className="thin-scrollbar max-h-36 divide-y overflow-y-auto rounded-lg border bg-background">
              {product.variants.map((variant) => {
                const isActive =
                  selectedVariant === variant.variantId ||
                  (!selectedVariant && variant === product.variants[0]);

                return (
                  <button
                    key={variant.variantId}
                    type="button"
                    onClick={() =>
                      onSelectVariant(
                        selectedVariant === variant.variantId ? null : variant.variantId,
                      )
                    }
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
                      isActive ? "bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <p className="truncate text-sm font-medium">
                      {variant.unitLabel}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        formatPriceLabel(variant.retailPrice)
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatPriceLabel(variant.retailPrice) ?? "No price"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {hasPackReturn && packReturnVariants.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Return info:</span>{" "}
            {packReturnVariants
              .map((variant) => {
                const deposit = formatPriceLabel(variant.packDepositAmount);
                return deposit ? `${variant.unitLabel} (${deposit})` : variant.unitLabel;
              })
              .join(", ")}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {product.category?.name ?? "Uncategorized"}
        </p>
        <Button size="sm" variant="outline" disabled>
          <Eye className="h-4 w-4" />
          Preview Only
        </Button>
      </div>
    </article>
  );
}
