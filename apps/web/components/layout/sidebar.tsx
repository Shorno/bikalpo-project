"use client";
import {
  ChevronRight,
  Menu,
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
import Link from "next/link";
import { useActiveCategories } from "@/hooks/use-customer-api";
import { cn } from "@/lib/utils";

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

interface SidebarProps {
  fixed?: boolean;
  className?: string;
}

export function Sidebar({ fixed = true, className }: SidebarProps) {
  const { data: categoriesData } = useActiveCategories();

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
    <aside
      className={cn(
        "w-full bg-white border border-gray-200",
        fixed && "fixed left-0 top-0 z-40 h-full w-64 border-r",
        !fixed && "relative z-10 overflow-hidden rounded-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 px-4 py-3 text-gray-800">
          <Menu className="size-4" />
          <h2 className="font-bold text-sm uppercase tracking-wide">
            SHOP BY CATEGORY
          </h2>
        </div>
      </div>

      {/* Categories list */}
      <div
        className={cn(
          "bg-white",
          fixed ? "flex-1 overflow-y-auto" : "overflow-hidden",
        )}
      >
        <nav>
          {categories.map((category) => {
            const IconComponent = getCategoryIcon(category.slug);
            return (
              <Link
                key={category.slug}
                href={`/products/${category.slug}`}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3 flex-1">
                  <IconComponent className="size-4 text-gray-500" />
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                <ChevronRight className="size-4 text-gray-400" />
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
