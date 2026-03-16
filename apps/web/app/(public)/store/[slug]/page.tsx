"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  MapPin,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddToCart } from "@/hooks/use-customer-api";
import { orpc } from "@/utils/orpc";

export default function ShopStorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, isLoading, isError } = useQuery(
    orpc.customer.getShopBySlug.queryOptions({
      input: { slug },
      enabled: !!slug,
    }),
  );
  const addToCart = useAddToCart();

  const shop = data?.shop;
  const products = data?.products ?? [];

  if (isLoading) {
    return <StoreSkeleton />;
  }

  if (isError || !shop) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium text-lg">Shop not found</p>
        <Link
          href="/store"
          className="text-sm text-emerald-600 hover:underline mt-2 inline-block"
        >
          ← Browse all shops
        </Link>
      </div>
    );
  }

  const handleAddToCart = (
    productId: number,
    variantId: number | undefined,
  ) => {
    addToCart.mutate({
      productId,
      variantId,
      shopId: shop.id,
      quantity: 1,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Shop Header */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 md:p-8 mb-8">
        <div className="flex items-center gap-5">
          {shop.image ? (
            <Image
              src={shop.image}
              alt={shop.shopName || shop.name}
              width={72}
              height={72}
              className="rounded-full object-cover border-3 border-white shadow-md"
            />
          ) : (
            <div className="w-[72px] h-[72px] bg-emerald-100 rounded-full flex items-center justify-center border-3 border-white shadow-md">
              <Store className="w-8 h-8 text-emerald-600" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {shop.shopName || shop.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <Badge variant="outline" className="capitalize">
                <ShoppingBag className="w-3 h-3 mr-1" />
                {shop.businessType || "Retail"}
              </Badge>
              {shop.shopAddress && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {shop.shopAddress}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Products ({products.length})
        </h2>
        <Link
          href="/store"
          className="text-sm text-emerald-600 hover:underline"
        >
          ← All shops
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No products available yet</p>
          <p className="text-sm text-gray-400 mt-1">
            This shop hasn&apos;t listed any retail products
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: any) => {
            const img = product.images?.[0]?.url || product.image;
            const firstVariant = product.variants?.[0];
            const price = firstVariant?.retailPrice || firstVariant?.basePrice;

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* Product Image — links to detail */}
                <Link
                  href={`/products/${product.category?.slug ?? "all"}/${product.slug}`}
                  className="group block"
                >
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {img ? (
                      <Image
                        src={img}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-gray-200" />
                      </div>
                    )}
                    {product.category && (
                      <Badge className="absolute top-2 left-2 bg-white/90 text-gray-600 text-xs border-0">
                        {product.category.name}
                      </Badge>
                    )}
                  </div>
                </Link>

                {/* Product Info + Add to Cart */}
                <div className="p-4">
                  <Link
                    href={`/products/${product.category?.slug ?? "all"}/${product.slug}`}
                  >
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2 hover:text-emerald-600 transition-colors">
                      {product.name}
                    </h3>
                  </Link>

                  <div className="flex items-end justify-between mb-3">
                    {price ? (
                      <p className="text-lg font-bold text-emerald-600">
                        ৳{Number(price).toLocaleString("en-BD")}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">Price not set</p>
                    )}

                    {product.variants?.length > 1 && (
                      <span className="text-xs text-gray-400">
                        {product.variants.length} variants
                      </span>
                    )}
                  </div>

                  {firstVariant?.unitLabel && (
                    <p className="text-xs text-gray-400 mb-3">
                      {firstVariant.unitLabel}
                    </p>
                  )}

                  {/* Add to Cart Button */}
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!price || addToCart.isPending}
                    onClick={() =>
                      handleAddToCart(product.id, firstVariant?.variantId)
                    }
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StoreSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-gray-50 rounded-xl p-8 mb-8 flex items-center gap-5">
        <Skeleton className="w-[72px] h-[72px] rounded-full" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-32 mt-2" />
        </div>
      </div>
      <Skeleton className="h-6 w-32 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-4">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-6 w-20 mb-3" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
