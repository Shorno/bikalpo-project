"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/utils/orpc";
import Image from "next/image";
import { Package, Search, ShoppingBag, MapPin, Store, ChevronRight, Tag } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function ShopStorefrontPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.shopSlug as string;
  const selectedCategory = searchParams.get("category") || undefined;
  const [search, setSearch] = useState("");

  // Fetch shop info
  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ["shop-storefront", slug],
    queryFn: () => client.shopOwner.getShopStorefrontBySlug({ slug }),
    enabled: !!slug,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["shop-categories", slug],
    queryFn: () => client.shopOwner.getShopStorefrontCategories({ slug }),
    enabled: !!slug,
  });

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["shop-products", slug, selectedCategory, search],
    queryFn: () =>
      client.shopOwner.getShopStorefrontProducts({
        slug,
        category: selectedCategory,
        search: search || undefined,
      }),
    enabled: !!slug,
  });

  if (shopLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500">Loading shop...</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <Store className="w-16 h-16 text-gray-300 mx-auto" />
          <p className="text-xl font-semibold text-gray-900">Shop not found</p>
          <p className="text-gray-500">The shop &quot;{slug}&quot; does not exist or is not active.</p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-medium text-sm mt-4">
            ← Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const categories = categoriesData?.categories || [];
  const products = productsData?.products || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ─── Shop Header ─── */}
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {/* Shop Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-100 overflow-hidden shrink-0">
              {shop.image ? (
                <Image src={shop.image} alt={shop.shopName || shop.name} width={64} height={64} className="object-cover w-full h-full" unoptimized />
              ) : (
                <Store className="w-8 h-8 text-white" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                {shop.shopName || shop.name}
              </h1>
              {shop.shopAddress && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{shop.shopAddress}</span>
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  <ShoppingBag className="w-3 h-3" />
                  {shop.productCount} products
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* ─── Search Bar ─── */}
        <div className="max-w-md mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
            />
          </div>
        </div>

        {/* ─── Category Filter ─── */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href={`/store/${slug}`}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                !selectedCategory
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
              }`}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/store/${slug}?category=${cat.slug}`}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedCategory === cat.slug
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
              >
                {cat.name} ({cat.productCount})
              </Link>
            ))}
          </div>
        )}

        {/* ─── Products Grid ─── */}
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-5 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No products found</p>
            <p className="text-gray-400 text-sm mt-1">
              {search ? "Try a different search term." : "This shop hasn't stocked any products yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product: any) => (
              <ShopProductCard key={product.id} product={product} shopId={shop.id} slug={slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Product Card Component ─────────────────────────────────
function ShopProductCard({ product, shopId, slug }: { product: any; shopId: string; slug: string }) {
  const hasMultipleVariants = product.variants && product.variants.length > 1;

  return (
    <Link
      href={`/store/${slug}/product/${product.slug}`}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-emerald-100 transition-all duration-200"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-200" />
          </div>
        )}
        {/* Category Badge */}
        {product.categoryName && (
          <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[10px] font-medium text-gray-600 px-2 py-0.5 rounded-full border border-gray-100">
            {product.categoryName}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {product.name}
        </h3>

        {/* Variant info */}
        {hasMultipleVariants && (
          <p className="text-[10px] text-gray-400">
            {product.variants.length} variants available
          </p>
        )}
        {product.variants?.[0]?.brandName && (
          <span className="inline-block text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
            {product.variants[0].brandName}
          </span>
        )}

        {/* Price */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-emerald-700">
            ৳{product.price?.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">
            In Stock
          </span>
        </div>
      </div>
    </Link>
  );
}
