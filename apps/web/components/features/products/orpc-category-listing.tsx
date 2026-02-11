/**
 * ORPC-powered Category Listing for the home page.
 * Fetches categories-with-products via ORPC and renders product cards in sections.
 */
"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCategoriesWithProducts } from "@/hooks/use-public-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface OrpcCategoryListingProps {
  /** Max categories to show (default all) */
  limit?: number;
  /** Link prefix – defaults to /products */
  basePath?: string;
}

export function OrpcCategoryListing({
  limit,
  basePath = "/products",
}: OrpcCategoryListingProps) {
  const { data, isLoading, isError } = useCategoriesWithProducts(limit);

  if (isLoading) return <CategoryListingSkeleton />;

  if (isError) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Unable to load categories.
      </div>
    );
  }

  const categories = data?.categories ?? [];

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No categories available yet.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {categories.map((cat: any) => (
        <section key={cat.id}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{cat.name}</h2>
              {cat.description && (
                <p className="text-sm text-gray-500 line-clamp-1">
                  {cat.description}
                </p>
              )}
            </div>
            <Link
              href={`${basePath}?category=${cat.slug}`}
              className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Link>
          </div>

          {cat.products && cat.products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {cat.products.map((product: any) => (
                <Link
                  key={product.id}
                  href={`${basePath}/${cat.slug}/${product.slug}`}
                  className="group bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square relative overflow-hidden bg-gray-100">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold px-2 py-1 bg-red-500 rounded">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {product.size}
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      ৳{Number(product.price).toLocaleString("en-BD")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm border rounded-lg bg-gray-50">
              No products in this category yet.
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CategoryListingSkeleton() {
  return (
    <div className="space-y-10">
      {[1, 2, 3].map((i) => (
        <section key={i}>
          <div className="flex justify-between mb-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="border rounded-lg overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-2.5 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
