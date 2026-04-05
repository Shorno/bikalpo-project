"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface WarehouseCategory {
  id: number;
  name: string;
  slug: string;
  icon?: string;
}

const defaultCategories: WarehouseCategory[] = [
  { id: 0, name: "All", slug: "all" },
  { id: 1, name: "Rice", slug: "rice" },
  { id: 2, name: "Flour", slug: "flour" },
  { id: 3, name: "Oil", slug: "oil" },
  { id: 4, name: "Sugar", slug: "sugar" },
  { id: 5, name: "Spices", slug: "spices" },
  { id: 6, name: "Beverages", slug: "beverages" },
  { id: 7, name: "Dairy", slug: "dairy" },
  { id: 8, name: "Snacks", slug: "snacks" },
  { id: 9, name: "Cleaning", slug: "cleaning" },
];

interface WarehouseCategoryListProps {
  categories?: WarehouseCategory[];
  onCategorySelect?: (slug: string) => void;
}

export function WarehouseCategoryList({
  categories = defaultCategories,
  onCategorySelect,
}: WarehouseCategoryListProps) {
  const [activeSlug, setActiveSlug] = useState("all");

  const handleSelect = (slug: string) => {
    setActiveSlug(slug);
    onCategorySelect?.(slug);
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
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => handleSelect(cat.slug)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border",
                activeSlug === cat.slug
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
        {/* Fade indicator */}
        <div className="absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#f8f9fa] to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
