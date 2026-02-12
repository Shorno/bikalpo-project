/**
 * ORPC-powered Brands carousel / grid for the home page.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useActiveBrands } from "@/hooks/use-customer-api";
import { Skeleton } from "@/components/ui/skeleton";

export function OrpcBrandsGrid() {
  const { data, isLoading } = useActiveBrands();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const brands = data?.brands ?? [];
  if (brands.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Shop by Brand</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {brands.map((brand: any) => (
          <Link
            key={brand.id}
            href={`/products?brand=${brand.slug}`}
            className="group bg-white border rounded-lg p-3 flex flex-col items-center justify-center hover:shadow-md transition-shadow"
          >
            {brand.image ? (
              <div className="relative w-12 h-12 mb-2">
                <Image
                  src={brand.image}
                  alt={brand.name}
                  fill
                  className="object-contain"
                  sizes="48px"
                />
              </div>
            ) : (
              <div className="w-12 h-12 mb-2 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-lg font-bold">
                {brand.name.charAt(0)}
              </div>
            )}
            <span className="text-xs font-medium text-gray-700 text-center line-clamp-1 group-hover:text-emerald-600">
              {brand.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
