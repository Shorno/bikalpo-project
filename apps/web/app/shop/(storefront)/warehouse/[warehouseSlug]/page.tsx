"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { WarehouseInfoHeader } from "@/components/features/warehouse/warehouse-info-header";
import { WarehousePromotionBanner } from "@/components/features/warehouse/warehouse-promotion-banner";
import { WarehouseCategoryList } from "@/components/features/warehouse/warehouse-category-list";
import { WarehouseProductGrid } from "@/components/features/warehouse/warehouse-product-grid";
import { WarehouseDealsSection } from "@/components/features/warehouse/warehouse-deals-section";
import { WarehouseInfoFooter } from "@/components/features/warehouse/warehouse-info-footer";
import { WarehouseProductCardSkeleton } from "@/components/features/warehouse/warehouse-product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/utils/orpc";

export default function WarehouseLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.warehouseSlug as string;
  const selectedCategory = searchParams.get("category") || undefined;
  const [page, setPage] = useState(1);

  // Reset to page 1 on category filter change
  useEffect(() => {
    setPage(1);
  }, [selectedCategory]);

  // Fetch warehouse info
  const { data: warehouse, isLoading: warehouseLoading } = useQuery({
    queryKey: ["warehouse-storefront", slug],
    queryFn: () => client.warehouse.getStorefrontBySlug({ slug }),
    enabled: !!slug,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["warehouse-categories", slug],
    queryFn: () => client.warehouse.getStorefrontCategories({ slug }),
    enabled: !!slug,
  });

  // Fetch products (with optional category filter)
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["warehouse-products", slug, selectedCategory, page],
    queryFn: () =>
      client.warehouse.getStorefrontProducts({
        slug,
        category: selectedCategory,
        page: String(page),
        limit: "12",
      }),
    enabled: !!slug,
  });

  if (warehouseLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] space-y-6">
        {/* Mock Warehouse Info Header Skeleton */}
        <section className="bg-white border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              {/* Avatar Skeleton */}
              <div className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                <Skeleton className="w-8 h-8 rounded" />
              </div>
              {/* Details Skeleton */}
              <div className="flex-1 min-w-0 space-y-2.5">
                <Skeleton className="h-7 w-48 md:w-64" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              {/* Actions Skeleton */}
              <div className="flex items-center gap-2 mt-2 md:mt-0">
                <Skeleton className="h-8 w-28 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        </section>

        {/* Promotion Banner Skeleton */}
        <div className="container mx-auto px-4">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>

        {/* Category List Skeleton */}
        <section className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-6 w-44" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Skeleton className="h-9 w-12 rounded-full shrink-0" />
            <Skeleton className="h-9 w-24 rounded-full shrink-0" />
            <Skeleton className="h-9 w-28 rounded-full shrink-0" />
            <Skeleton className="h-9 w-20 rounded-full shrink-0" />
          </div>
        </section>

        {/* Product Grid Skeleton */}
        <section className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <WarehouseProductCardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-semibold">Warehouse not found</p>
          <p className="text-muted-foreground">The warehouse "{slug}" does not exist.</p>
        </div>
      </div>
    );
  }

  const categories = categoriesData?.categories || [];
  const products = productsData?.products || [];
  const totalProducts = productsData?.pagination?.totalCount ?? Number(warehouse.productCount) ?? 0;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Warehouse Info Header */}
      <WarehouseInfoHeader
        name={warehouse.warehouseName || warehouse.name || "Warehouse"}
        location={warehouse.warehouseAddress || ""}
        deliveryCoverage="Nearby Areas"
        image={warehouse.image || undefined}
      />

      {/* Promotion Banner Carousel */}
      <WarehousePromotionBanner />

      {/* Category List */}
      <WarehouseCategoryList
        categories={categories}
        selectedCategory={selectedCategory}
        warehouseSlug={slug}
      />

      {/* Product Grid */}
      <WarehouseProductGrid
        products={products}
        isLoading={productsLoading}
        warehouseSlug={slug}
        pagination={productsData?.pagination}
        onPageChange={setPage}
      />

      {/* Deals / Bulk Offers */}
      <WarehouseDealsSection />

      {/* Warehouse Info Footer */}
      <WarehouseInfoFooter
        name={warehouse.warehouseName || warehouse.name || "Warehouse"}
        location={warehouse.warehouseAddress || ""}
        totalProducts={totalProducts}
        deliveryCoverage="Nearby Areas"
      />
    </div>
  );
}
