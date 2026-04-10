"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface WarehouseCategory {
  id: number;
  name: string;
  slug: string;
  productCount?: number;
}

interface WarehouseCategoryListProps {
  categories?: WarehouseCategory[];
  selectedCategory?: string;
  warehouseSlug: string;
}

export function WarehouseCategoryList({
  categories = [],
  selectedCategory,
  warehouseSlug,
}: WarehouseCategoryListProps) {
  const router = useRouter();

  const handleSelect = (slug: string | undefined) => {
    if (slug) {
      router.push(`/warehouse/${warehouseSlug}?category=${slug}`);
    } else {
      router.push(`/warehouse/${warehouseSlug}`);
    }
  };

  return (
    <section className="container mx-auto px-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">
          Wholesale Categories
        </h2>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scrollbar-hide">
          {/* All button */}
          <button
            type="button"
            onClick={() => handleSelect(undefined)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border",
              !selectedCategory
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => handleSelect(cat.slug)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border",
                selectedCategory === cat.slug
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              {cat.name}
              {cat.productCount != null && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  selectedCategory === cat.slug
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                )}>
                  {cat.productCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Fade indicator */}
        <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#f8f9fa] to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
