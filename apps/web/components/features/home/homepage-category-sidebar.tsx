/**
 * Shwapno-style vertical category sidebar for the homepage.
 * Shows all active categories in a vertical list with hover effects.
 * Desktop-only — hidden on mobile (navbar handles categories there).
 */
"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveCategories } from "@/hooks/use-customer-api";

export function HomepageCategorySidebar() {
  const { data, isLoading } = useActiveCategories();

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        <div className="bg-primary text-white px-4 py-3 text-sm font-bold uppercase">
          Categories
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const categories = data?.categories ?? [];
  if (categories.length === 0) return null;

  return (
    <nav className="bg-white border-l border-r border-b border-gray-200 rounded-b-md shadow-sm hidden lg:block h-full">
      {/* Category list */}
      <ul className="divide-y divide-gray-50">
        {categories.map((cat) => (
          <li key={cat.id}>
            <Link
              href={`/products?category=${cat.slug}`}
              className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:text-primary transition-colors group"
            >
              <span className="font-medium truncate">{cat.name}</span>
              <ChevronRight className="size-3.5 opacity-40 group-hover:text-primary group-hover:opacity-100 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
