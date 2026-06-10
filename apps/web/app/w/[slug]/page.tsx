"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, MapPin, Package, Search, Warehouse } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { WarehouseProductGrid } from "@/components/features/warehouse/warehouse-product-grid";
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
                    <span className="font-mono text-zinc-700 font-semibold tabular-nums">
                      {warehouse.productCount}
                    </span>
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
                  onClick={() => {
                    setSelectedCategory(null);
                    setPage(1);
                  }}
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
                    variant={
                      selectedCategory === cat.slug ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(cat.slug);
                      setPage(1);
                    }}
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

      <WarehouseProductGrid
        products={products}
        isLoading={productsLoading}
        warehouseSlug={slug}
        pagination={pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
