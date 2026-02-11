/**
 * ORPC-powered Products Grid — client component that fetches products
 * via the public ORPC router and renders the grid with loading/empty states.
 */
"use client";

import { PackageSearch } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePublicProducts } from "@/hooks/use-public-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function OrpcProductsGrid() {
  const searchParams = useSearchParams();

  const filters = {
    category: searchParams.get("category"),
    subcategory: searchParams.get("subcategory"),
    brand: searchParams.get("brand"),
    minPrice: searchParams.get("minPrice"),
    maxPrice: searchParams.get("maxPrice"),
    inStock: searchParams.get("inStock"),
    search: searchParams.get("search"),
    sort: searchParams.get("sort"),
    page: searchParams.get("page") ?? "1",
    limit: searchParams.get("limit") ?? "12",
  };

  const { data, isLoading, isError, error } = usePublicProducts(filters);

  if (isLoading) return <ProductsGridSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <PackageSearch className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error loading products
        </h3>
        <p className="text-sm text-gray-500 max-w-md">
          {error?.message || "Something went wrong"}
        </p>
      </div>
    );
  }

  const products = data?.products ?? [];
  const pagination = data?.pagination;

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <PackageSearch className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No products found
        </h3>
        <p className="text-sm text-gray-500 max-w-md">
          Try adjusting your filters or search terms to find what you&apos;re
          looking for.
        </p>
      </div>
    );
  }

  const currentPage = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Count + sort header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {products.length} of {pagination?.totalCount ?? 0} products
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {products.map((p: any) => (
          <Link
            key={p.id}
            href={`/products/${p.category?.slug ?? "all"}/${p.slug}`}
            className="group bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square relative overflow-hidden bg-gray-100">
              <Image
                src={p.image}
                alt={p.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              {!p.inStock && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 space-y-1.5">
              <p className="text-xs text-gray-500">{p.category?.name}</p>
              <h3 className="font-medium text-gray-900 text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {p.name}
              </h3>
              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-bold text-gray-900">
                  ৳{Number(p.price).toLocaleString("en-BD")}
                </span>
                <span className="text-xs text-gray-500">/ {p.size}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={`?${new URLSearchParams({
                ...Object.fromEntries(searchParams.entries()),
                page: page.toString(),
              }).toString()}`}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                page === currentPage
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductsGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
