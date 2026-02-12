/**
 * ORPC-powered Categories carousel / tabs for the home page.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useActiveCategories } from "@/hooks/use-customer-api";
import { Skeleton } from "@/components/ui/skeleton";

export function OrpcCategoriesGrid() {
  const { data, isLoading } = useActiveCategories();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center shrink-0">
            <Skeleton className="w-16 h-16 rounded-full" />
            <Skeleton className="h-3 w-14 mt-1.5" />
          </div>
        ))}
      </div>
    );
  }

  const categories = data?.categories ?? [];
  if (categories.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Browse Categories
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className="flex flex-col items-center shrink-0 group"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-transparent group-hover:border-emerald-500 transition-colors">
              {cat.image ? (
                <Image
                  src={cat.image}
                  alt={cat.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
                  {cat.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-gray-700 mt-1.5 text-center line-clamp-1 group-hover:text-emerald-600">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
