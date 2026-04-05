"use client";

import { WarehouseInfoHeader } from "@/components/features/warehouse/warehouse-info-header";
import { WarehousePromotionBanner } from "@/components/features/warehouse/warehouse-promotion-banner";
import { WarehouseCategoryList } from "@/components/features/warehouse/warehouse-category-list";
import { WarehouseProductGrid } from "@/components/features/warehouse/warehouse-product-grid";
import { WarehouseDealsSection } from "@/components/features/warehouse/warehouse-deals-section";
import { WarehouseInfoFooter } from "@/components/features/warehouse/warehouse-info-footer";

export default function WarehouseLandingPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Warehouse Info Header */}
      <WarehouseInfoHeader
        name="IFAD Distribution Hub"
        location="Dhaka Central Warehouse"
        deliveryCoverage="Dhaka + Nearby Areas"
      />

      {/* Promotion Banner Carousel */}
      <WarehousePromotionBanner />

      {/* Category List */}
      <WarehouseCategoryList />

      {/* Product Grid */}
      <WarehouseProductGrid />

      {/* Deals / Bulk Offers */}
      <WarehouseDealsSection />

      {/* Warehouse Info Footer */}
      <WarehouseInfoFooter
        name="IFAD Distribution Hub"
        location="Dhaka Central Warehouse"
        totalProducts={320}
        deliveryCoverage="Dhaka + Nearby Areas"
      />
    </div>
  );
}
