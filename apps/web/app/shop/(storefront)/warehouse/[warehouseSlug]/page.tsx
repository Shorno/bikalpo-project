"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { WarehouseInfoHeader } from "@/components/features/warehouse/warehouse-info-header";
import { WarehousePromotionBanner } from "@/components/features/warehouse/warehouse-promotion-banner";
import { WarehouseCategoryList } from "@/components/features/warehouse/warehouse-category-list";
import { WarehouseProductGrid } from "@/components/features/warehouse/warehouse-product-grid";
import { WarehouseDealsSection } from "@/components/features/warehouse/warehouse-deals-section";
import { WarehouseInfoFooter } from "@/components/features/warehouse/warehouse-info-footer";
import { client } from "@/utils/orpc";

export default function WarehouseLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.warehouseSlug as string;
  const selectedCategory = searchParams.get("category") || undefined;

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
    queryKey: ["warehouse-products", slug, selectedCategory],
    queryFn: () =>
      client.warehouse.getStorefrontProducts({
        slug,
        category: selectedCategory,
      }),
    enabled: !!slug,
  });

  if (warehouseLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading warehouse...</p>
        </div>
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
