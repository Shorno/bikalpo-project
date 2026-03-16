"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Loader2,
  MapPin,
  Package,
  Search,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

export default function WarehouseStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch warehouse info
  const {
    data: warehouse,
    isLoading: warehouseLoading,
    error: warehouseError,
  } = useQuery(
    orpc.warehouse.getStorefrontBySlug.queryOptions({
      input: { slug },
    }),
  );

  // Fetch categories
  const { data: categoriesData } = useQuery(
    orpc.warehouse.getStorefrontCategories.queryOptions({
      input: { slug },
    }),
  );

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery(
    orpc.warehouse.getStorefrontProducts.queryOptions({
      input: {
        slug,
        category: selectedCategory || undefined,
        search: search || undefined,
      },
    }),
  );

  if (warehouseLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (warehouseError || !warehouse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Warehouse Not Found
        </h1>
        <p className="text-gray-600">
          This warehouse does not exist or is no longer available.
        </p>
      </div>
    );
  }

  const categories = categoriesData?.categories || [];
  const products = productsData?.products || [];
  const pagination = productsData?.pagination;

  return (
    <div>
      {/* Warehouse Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <Warehouse className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {warehouse.warehouseName || warehouse.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                {warehouse.warehouseAddress && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{warehouse.warehouseAddress}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  <span>{warehouse.productCount} products available</span>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="mt-2 bg-amber-100 text-amber-700 border-amber-200"
              >
                Verified Warehouse
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Tabs */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={
                selectedCategory === null
                  ? "bg-amber-600 hover:bg-amber-700"
                  : ""
              }
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.slug ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.slug)}
                className={
                  selectedCategory === cat.slug
                    ? "bg-amber-600 hover:bg-amber-700"
                    : ""
                }
              >
                {cat.name} ({cat.productCount})
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-12">
        {productsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg font-medium">
              No products available
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {search
                ? "No products match your search."
                : "This warehouse hasn't added any products yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((item) => {
                const prod = item.product;
                const variant = item.variant;
                if (!prod) return null;

                const image = (prod as any).images?.[0]?.url || null;
                const price = variant?.price || item.retailPrice || "0";

                return (
                  <div
                    key={item.inventoryId}
                    className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                      {image ? (
                        <Image
                          src={image}
                          alt={prod.name}
                          width={400}
                          height={400}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-gray-300" />
                        </div>
                      )}
                      {Number(item.availableQty) > 0 ? (
                        <Badge className="absolute top-2 right-2 bg-green-100 text-green-700 border-green-200 text-xs">
                          In Stock
                        </Badge>
                      ) : (
                        <Badge className="absolute top-2 right-2 bg-red-100 text-red-700 border-red-200 text-xs">
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-gray-400 mb-1">
                        {(prod as any).category?.name}
                      </p>
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                        {prod.name}
                      </h3>
                      {variant?.sku && (
                        <p className="text-xs text-gray-400 font-mono mb-1.5">
                          SKU: {variant.sku}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-amber-700 font-bold">
                          ৳{Number(price).toLocaleString("en-BD")}
                        </p>
                        <span className="text-xs text-gray-400">
                          Qty: {item.availableQty}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination info */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <p className="text-sm text-gray-500">
                  Showing page {pagination.page} of {pagination.totalPages} (
                  {pagination.totalCount} products)
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
