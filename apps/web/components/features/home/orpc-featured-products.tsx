/**
 * ORPC-powered Featured Products Section
 * Displays new arrivals or best-selling products using the customer API
 */
"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerProducts } from "@/hooks/use-customer-api";
import { cn } from "@/lib/utils";

interface OrpcFeaturedProductsProps {
  title: string;
  subtitle?: string;
  type: "new-arrivals" | "best-selling" | "featured";
  limit?: number;
  href?: string;
  className?: string;
}

export function OrpcFeaturedProducts({
  title,
  subtitle,
  type,
  limit = 8,
  href,
  className,
}: OrpcFeaturedProductsProps) {
  // Determine sort based on type
  const sortConfig =
    type === "new-arrivals"
      ? { sort: "newest" }
      : type === "best-selling"
        ? { sort: "popular" }
        : { sort: "newest" };

  const { data, isLoading, isError } = useCustomerProducts({
    ...sortConfig,
    limit: limit.toString(),
    page: "1",
  });

  if (isLoading) {
    return (
      <section className={cn("py-8", className)}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: limit }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data?.products || data.products.length === 0) {
    return null; // Don't show section if no products
  }

  const products = data.products.slice(0, limit);
  type FeaturedProduct = (typeof products)[number];

  return (
    <section className={cn("py-8", className)}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {href && (
            <Link
              href={href}
              className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product: FeaturedProduct) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="group bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-all"
            >
              <div className="aspect-square relative overflow-hidden bg-gray-100">
                <Image
                  src={product.image || "/placeholder-product.png"}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                {!product.inStock && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs font-semibold px-3 py-1 bg-red-500 rounded">
                      Out of Stock
                    </span>
                  </div>
                )}
                {type === "new-arrivals" && (
                  <div className="absolute top-2 left-2">
                    <span className="text-white text-xs font-semibold px-2 py-1 bg-emerald-500 rounded">
                      New
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                  {product.name}
                </h3>
                {product.size && (
                  <p className="text-xs text-gray-500 mt-1">{product.size}</p>
                )}
                <div className="mt-2">
                  <p className="text-lg font-bold text-gray-900">
                    ৳{Number(product.price || 0).toLocaleString("en-BD")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
