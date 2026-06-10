"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  MapPin,
  Package,
  Search,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden flex flex-col h-full">
      {/* Image Skeleton */}
      <div className="aspect-[16/11] bg-zinc-50 relative border-b border-zinc-100 overflow-hidden flex-shrink-0">
        <Skeleton className="w-full h-full rounded-none" />
      </div>

      {/* Info details */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          {/* Category */}
          <Skeleton className="h-3 w-16 mb-2" />
          {/* Product Title */}
          <Skeleton className="h-4 w-5/6 mb-1.5" />
          <Skeleton className="h-4 w-2/3 mb-1" />
        </div>

        {/* Specifications */}
        <div className="space-y-2 mt-4 pt-2 border-t border-zinc-100">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3.5 w-12" />
          </div>
          <div className="flex justify-between items-baseline pt-1.5">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WarehouseStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Reset to page 1 on search or category filter change
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory]);

  // Fetch warehouse info
  const {
    data: warehouse,
    isLoading: warehouseLoading,
    error: warehouseError,
  } = useQuery(
    orpc.warehouse.getStorefrontBySlug.queryOptions({
      input: { slug },
    }),
  );

  // Fetch categories
  const { data: categoriesData } = useQuery(
    orpc.warehouse.getStorefrontCategories.queryOptions({
      input: { slug },
    }),
  );

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery(
    orpc.warehouse.getStorefrontProducts.queryOptions({
      input: {
        slug,
        category: selectedCategory || undefined,
        search: search || undefined,
        page: String(page),
        limit: "12",
      },
    }),
  );

  if (warehouseLoading) {
    return (
      <div className="min-h-screen bg-zinc-50/50">
        {/* Warehouse Header Skeleton */}
        <div className="bg-white border-b border-zinc-200">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 bg-zinc-100 rounded-lg flex items-center justify-center shrink-0 border border-zinc-200">
                  <Skeleton className="w-6 h-6" />
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Skeleton className="h-8 w-48 md:w-64" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-2.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar Skeleton */}
        <div className="container mx-auto px-4 py-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col gap-4 shadow-sm">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid Skeleton */}
        <div className="container mx-auto px-4 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (warehouseError || !warehouse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Warehouse Not Found
        </h1>
        <p className="text-gray-600">
          This warehouse does not exist or is no longer available.
        </p>
      </div>
    );
  }

  const categories = categoriesData?.categories || [];
  const products = productsData?.products || [];
  const pagination = productsData?.pagination;

  return (
    <div className="min-h-screen bg-zinc-50/50">
      {/* Warehouse Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-zinc-800">
                <Warehouse className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900">
                    {warehouse.warehouseName || warehouse.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className="bg-zinc-50 text-zinc-700 border-zinc-200 font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 font-bold"
                  >
                    Verified Store
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs font-medium text-zinc-500">
                  {warehouse.warehouseAddress && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{warehouse.warehouseAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-mono text-zinc-700 font-semibold tabular-nums">{warehouse.productCount}</span>
                    <span>products available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col gap-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 border-zinc-200 focus-visible:ring-zinc-900 rounded-md bg-zinc-50/30"
            />
          </div>

          {/* Category Tabs */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                Category Filters
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className={`h-8 px-3.5 text-xs font-medium rounded-md transition-colors ${
                    selectedCategory === null
                      ? "bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900"
                      : "border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50"
                  }`}
                >
                  All
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.slug ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`h-8 px-3.5 text-xs font-medium rounded-md transition-colors ${
                      selectedCategory === cat.slug
                        ? "bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900"
                        : "border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50"
                    }`}
                  >
                    {cat.name}
                    <span className="ml-1 px-1 py-0.5 text-[9px] font-mono bg-zinc-100 text-zinc-500 rounded border border-zinc-200/50 group-hover:bg-zinc-200">
                      {cat.productCount}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-16">
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-dashed border-zinc-200 rounded-lg p-6">
            <Package className="w-10 h-10 text-zinc-300 mb-3" />
            <p className="text-zinc-700 font-semibold text-lg">
              No products available
            </p>
            <p className="text-zinc-400 text-sm mt-1">
              {search
                ? "No products match your search query."
                : "This warehouse hasn't listed any retail products yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {products.map((item) => {
                const prod = item.product;
                const variant = item.variant;
                if (!prod) return null;

                const image = prod.images?.[0]?.imageUrl || prod.images?.[0]?.url || prod.image || null;
                const price = variant?.price || item.retailPrice || "0";

                return (
                  <div
                    key={item.inventoryId}
                    className="bg-white rounded-lg border border-zinc-200 overflow-hidden hover:border-zinc-400 transition-colors duration-200 group flex flex-col"
                  >
                    <div className="aspect-[16/11] bg-zinc-50 relative border-b border-zinc-100 overflow-hidden flex-shrink-0">
                      {image ? (
                        <Image
                          src={image}
                          alt={prod.name}
                          width={400}
                          height={400}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-zinc-300" />
                        </div>
                      )}
                      {Number(item.availableQty) > 0 ? (
                        <Badge className="absolute top-2.5 right-2.5 bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-mono tracking-wider uppercase font-bold shadow-none rounded px-1.5 py-0.5">
                          In Stock
                        </Badge>
                      ) : (
                        <Badge className="absolute top-2.5 right-2.5 bg-red-50 text-red-700 border-red-200 text-[9px] font-mono tracking-wider uppercase font-bold shadow-none rounded px-1.5 py-0.5">
                          Out of Stock
                        </Badge>
                      )}
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                          {(prod as any).category?.name || "Product"}
                        </span>
                        <h3 className="font-semibold text-zinc-900 text-sm line-clamp-2 leading-snug min-h-[40px] hover:text-zinc-700 transition-colors">
                          {prod.name}
                        </h3>
                      </div>

                      <div className="space-y-2 mt-4 pt-2 border-t border-zinc-100">
                        {variant?.sku && (
                          <div className="flex justify-between items-center text-[10px] text-zinc-500">
                            <span>SKU</span>
                            <span className="font-mono text-zinc-700 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/50">
                              {variant.sku}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                          <span>Available Stock</span>
                          <span className="font-mono text-zinc-800 font-semibold tabular-nums">
                            {item.availableQty} units
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline pt-1.5">
                          <span className="text-xs font-semibold text-zinc-400">Price</span>
                          <span className="font-mono font-bold text-base text-zinc-900 tabular-nums">
                            ৳{Number(price).toLocaleString("en-BD")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination info */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 border-t border-zinc-200 pt-6">
                <p className="text-xs font-medium text-zinc-400 font-mono">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} products)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-3 text-xs font-semibold border-zinc-200 text-zinc-600 font-mono rounded bg-white hover:bg-zinc-50"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="h-8 px-3 text-xs font-semibold border-zinc-200 text-zinc-600 font-mono rounded bg-white hover:bg-zinc-50"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
