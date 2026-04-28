"use client";

import { useState } from "react";
import {
  Store, MapPin, Phone, Star, ShoppingCart, Package,
  Users, Truck, CreditCard, MessageCircle, AlertCircle,
  Eye, Search, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useMyStorePreview, useMyStoreStats } from "@/hooks/use-store-preview-api";

// ─── Types ───────────────────────────────────────────────────────

type StockFilter = "all" | "in_stock" | "low" | "out_of_stock";

// ─── Main Page ───────────────────────────────────────────────────

export default function MyStorePage() {
  const { data, isLoading } = useMyStorePreview();
  const { data: stats } = useMyStoreStats();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Record<number, number | null>>({});
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number | null>>({});

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

  const { store, categories, products } = data;

  // Filter products
  let filteredProducts = products;
  if (selectedCategory) {
    filteredProducts = filteredProducts.filter((p: any) => p.category?.id === selectedCategory);
  }
  if (stockFilter !== "all") {
    filteredProducts = filteredProducts.filter((p: any) => p.stockStatus === stockFilter);
  }
  if (search.trim()) {
    const s = search.toLowerCase();
    filteredProducts = filteredProducts.filter(
      (p: any) =>
        p.name.toLowerCase().includes(s) ||
        p.brands.some((b: any) => b.name.toLowerCase().includes(s)),
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Preview Mode Banner ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <Eye className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Preview Mode</span> — This is how your store looks to customers.
          Cart and ordering are disabled.
        </p>
      </div>

      {/* ── Store Header ── */}
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

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { icon: Star, label: "Rating", value: stats?.avgRating ? `${stats.avgRating} ★` : "—" },
              { icon: ShoppingCart, label: "Orders", value: stats?.totalOrders?.toLocaleString() ?? "0" },
              { icon: Users, label: "Customers", value: stats?.totalCustomers?.toLocaleString() ?? "0" },
              { icon: Package, label: "Products", value: data.totalProducts.toString() },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/15 rounded-lg p-2.5 text-center">
                <Icon className="h-4 w-4 mx-auto mb-1 text-emerald-100" />
                <p className="text-sm font-bold">{value}</p>
                <p className="text-[10px] text-emerald-200">{label}</p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0" disabled>
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Chat
            </Button>
            {store.phoneNumber && (
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0" asChild>
                <a href={`tel:${store.phoneNumber}`}>
                  <Phone className="h-3.5 w-3.5 mr-1.5" /> Call
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Category Navigation ── */}
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
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
              <span className="ml-1.5 text-xs opacity-70">{cat.productCount}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Search + Quick Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "in_stock", "low", "out_of_stock"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStockFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                stockFilter === f
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100"
              }`}
            >
              {f === "all" ? "All" : f === "in_stock" ? "In Stock" : f === "low" ? "Low Stock" : "Out"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Grid ── */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((prod: any) => (
            <ProductCard
              key={prod.productId}
              product={prod}
              selectedBrand={selectedBrands[prod.productId] ?? null}
              selectedVariant={selectedVariants[prod.productId] ?? null}
              onSelectBrand={(brandId) =>
                setSelectedBrands((prev) => ({ ...prev, [prod.productId]: brandId }))
              }
              onSelectVariant={(variantId) =>
                setSelectedVariants((prev) => ({ ...prev, [prod.productId]: variantId }))
              }
            />
          ))}
        </div>
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

      {/* ── Store Footer ── */}
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

// ─── Product Card Component ──────────────────────────────────────

function ProductCard({
  product,
  selectedBrand,
  selectedVariant,
  onSelectBrand,
  onSelectVariant,
}: {
  product: any;
  selectedBrand: number | null;
  selectedVariant: number | null;
  onSelectBrand: (brandId: number | null) => void;
  onSelectVariant: (variantId: number | null) => void;
}) {
  // Filter variants by selected brand
  const visibleVariants = selectedBrand
    ? product.variants.filter((v: any) => v.brandId === selectedBrand)
    : product.variants;

  // Get the active variant (selected or first visible)
  const activeVariant = selectedVariant
    ? visibleVariants.find((v: any) => v.variantId === selectedVariant)
    : visibleVariants[0];

  const displayPrice = activeVariant?.retailPrice
    ? `৳ ${Number(activeVariant.retailPrice).toLocaleString()}`
    : product.lowestPrice
      ? `৳ ${product.lowestPrice.toLocaleString()}`
      : "Price TBD";

  const displayUnit = activeVariant?.unitLabel || "";

  // Check if any variant in this product requires pack return
  const hasPackReturn = product.isReturnablePack ||
    product.variants.some((v: any) => v.isPackReturnRequired);

  const packReturnVariants = product.variants.filter((v: any) => v.isPackReturnRequired);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        {/* Image + Name */}
        <div className="flex gap-3 p-4 pb-0">
          <div className="w-20 h-20 rounded-lg bg-gray-50 border overflow-hidden shrink-0">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-200" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{product.name}</h3>
            {product.shortDescription && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {product.shortDescription}
              </p>
            )}
            {/* Price */}
            <div className="mt-2">
              <span className="text-lg font-bold text-emerald-700">{displayPrice}</span>
              {displayUnit && (
                <span className="text-xs text-muted-foreground ml-1">/ {displayUnit}</span>
              )}
            </div>
            {/* Stock badge */}
            <Badge
              variant={
                product.stockStatus === "in_stock"
                  ? "default"
                  : product.stockStatus === "low"
                    ? "secondary"
                    : "destructive"
              }
              className={`text-[10px] mt-1 ${
                product.stockStatus === "in_stock"
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : product.stockStatus === "low"
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                    : ""
              }`}
            >
              {product.stockStatus === "in_stock"
                ? "In Stock"
                : product.stockStatus === "low"
                  ? "Limited Stock"
                  : "Out of Stock"}
            </Badge>
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          <Separator />

          {/* Brand selector chips */}
          {product.brands.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Brand</p>
              <div className="flex flex-wrap gap-1.5">
                {product.brands.map((b: any) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBrand(selectedBrand === b.id ? null : b.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      selectedBrand === b.id
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {b.name}
                    {selectedBrand === b.id && " ✓"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Variant / Pack selector pills */}
          {visibleVariants.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Pack</p>
              <div className="flex flex-wrap gap-1.5">
                {visibleVariants.map((v: any) => (
                  <button
                    key={v.variantId}
                    type="button"
                    onClick={() => onSelectVariant(selectedVariant === v.variantId ? null : v.variantId)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      (selectedVariant === v.variantId || (!selectedVariant && v === visibleVariants[0]))
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {v.unitLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty Pack Return */}
          {hasPackReturn && packReturnVariants.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-md p-2.5">
              <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-1">
                ♻ Empty Pack Return
              </p>
              <div className="flex flex-wrap gap-1.5">
                {packReturnVariants.map((v: any) => (
                  <span key={v.variantId} className="text-xs text-amber-700">
                    {v.brandName || v.unitLabel}
                    {v.packDepositAmount && (
                      <span className="ml-1 font-medium">৳{v.packDepositAmount}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Action buttons (disabled in preview) */}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled>
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Add to Cart
            </Button>
            <Button size="sm" variant="outline" className="flex-1" disabled>
              ⚡ Buy Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
