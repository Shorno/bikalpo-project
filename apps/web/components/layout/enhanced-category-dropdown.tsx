"use client";
import {
  ChevronRight,
  LayoutGrid,
  ShoppingBag,
  Baby,
  Shirt,
  Home,
  Sparkles,
  Stethoscope,
  Package,
  PenTool,
  Gamepad2,
  Smartphone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useActiveCategories } from "@/hooks/use-customer-api";

// Category icons mapping
const categoryIcons: Record<string, any> = {
  ramadan: Sparkles,
  food: ShoppingBag,
  "baby-food": Baby,
  "baby-care": Baby,
  diapers: Baby,
  "home-cleaning": Sparkles,
  "pet-care": Package,
  beauty: Stethoscope,
  health: Stethoscope,
  fashion: Shirt,
  lifestyle: Shirt,
  "home-kitchen": Home,
  kitchen: Home,
  stationeries: PenTool,
  toys: Gamepad2,
  sports: Gamepad2,
  gadget: Smartphone,
};

function getCategoryIcon(slug: string) {
  const key = Object.keys(categoryIcons).find((k) =>
    slug.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? categoryIcons[key] : Package;
}

export function EnhancedCategoryDropdown() {
  const { data: categoriesData } = useActiveCategories();
  const [isOpen, setIsOpen] = useState(false);

  // Default categories if API data is not available
  const defaultCategories = [
    { name: "Ramadan", slug: "ramadan" },
    { name: "Food", slug: "food" },
    { name: "Baby Food & Care", slug: "baby-food-care" },
    { name: "Diapers", slug: "diapers" },
    { name: "Home Cleaning", slug: "home-cleaning" },
    { name: "Pet Care", slug: "pet-care" },
    { name: "Beauty & Health", slug: "beauty-health" },
    { name: "Fashion & Lifestyle", slug: "fashion-lifestyle" },
    { name: "Home & Kitchen", slug: "home-kitchen" },
    { name: "Stationeries", slug: "stationeries" },
    { name: "Toys & Sports", slug: "toys-sports" },
    { name: "Gadget", slug: "gadget" },
  ];

  const categories = categoriesData?.categories || defaultCategories;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center gap-2 h-10 px-3 bg-primary text-white text-sm font-medium shrink-0">
        <LayoutGrid className="size-4" />
        <span>SHOP BY CATEGORY</span>
      </button>

      {/* Enhanced Category Dropdown with Banner Space */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" />

          {/* Main Content Area */}
          <div className="absolute top-full left-0 z-50">
            <div className="flex">
              {/* Category Menu */}
              <div className="w-80 bg-white shadow-xl border">
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Shop By Category
                  </h3>

                  {/* Categories Grid */}
                  <div className="space-y-2">
                    {categories.map((category) => {
                      const IconComponent = getCategoryIcon(category.slug);
                      return (
                        <Link
                          key={category.slug}
                          href={`/products/${category.slug}`}
                          className="flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-primary hover:text-white transition-colors rounded-lg group"
                        >
                          <IconComponent className="size-5 text-gray-500 group-hover:text-white" />
                          <span className="flex-1 font-medium">
                            {category.name}
                          </span>
                          <ChevronRight className="size-4 opacity-60 group-hover:opacity-100" />
                        </Link>
                      );
                    })}
                  </div>

                  {/* Quick Access */}
                  <div className="border-t border-gray-200 mt-4 pt-4">
                    <h4 className="text-sm font-semibold text-gray-600 mb-3">
                      Quick Access
                    </h4>
                    <div className="space-y-2">
                      <Link
                        href="/products"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-primary hover:text-white rounded-lg transition-colors"
                      >
                        All Products
                      </Link>
                      <Link
                        href="/products?sort=newest"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-primary hover:text-white rounded-lg transition-colors"
                      >
                        New Arrivals
                      </Link>
                      <Link
                        href="/products?sort=popular"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-primary hover:text-white rounded-lg transition-colors"
                      >
                        Best Sellers
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner/Slider Content on Right */}
              <div className="w-96 bg-white shadow-xl border-l">
                <div className="p-4">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">
                    Featured Products
                  </h4>

                  {/* Sample Banner Content */}
                  <div className="space-y-4">
                    <div className="relative w-full aspect-video bg-gradient-to-r from-primary/20 to-primary/40 rounded-lg overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-primary-foreground">
                          <h5 className="text-lg font-bold mb-2">
                            Special Offer
                          </h5>
                          <p className="text-sm">Up to 50% OFF</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <Link
                          key={i}
                          href="/products"
                          className="aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
                        >
                          <div className="w-full h-full flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                            <Package className="size-8" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
