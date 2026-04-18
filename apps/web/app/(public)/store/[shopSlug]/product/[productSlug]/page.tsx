"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/utils/orpc";
import Image from "next/image";
import { Package, Store, ArrowLeft, ShoppingBag, MapPin, Tag } from "lucide-react";
import Link from "next/link";

export default function ShopProductDetailPage() {
  const params = useParams();
  const shopSlug = params.shopSlug as string;
  const productSlug = params.productSlug as string;

  // Fetch shop info
  const { data: shop } = useQuery({
    queryKey: ["shop-storefront", shopSlug],
    queryFn: () => client.shopOwner.getShopStorefrontBySlug({ slug: shopSlug }),
    enabled: !!shopSlug,
  });

  // Fetch shop products — find the one matching the productSlug
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["shop-products", shopSlug],
    queryFn: () =>
      client.shopOwner.getShopStorefrontProducts({
        slug: shopSlug,
        limit: "100",
      }),
    enabled: !!shopSlug,
  });

  const product = productsData?.products?.find((p: any) => p.slug === productSlug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <Package className="w-16 h-16 text-gray-200 mx-auto" />
          <p className="text-xl font-semibold text-gray-900">Product not found</p>
          <Link
            href={`/store/${shopSlug}`}
            className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-medium text-sm mt-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link href={`/store/${shopSlug}`} className="hover:text-emerald-600 transition-colors">
            {shop?.shopName || shop?.name || shopSlug}
          </Link>
          <span>/</span>
          <span className="text-gray-600 font-medium truncate">{product.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-10">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Product Image */}
            <div className="aspect-square bg-gray-50 relative">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-20 h-20 text-gray-200" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="p-6 md:p-8 space-y-6">
              {/* Category */}
              {product.categoryName && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                  <Tag className="w-3 h-3" />
                  {product.categoryName}
                </span>
              )}

              {/* Name */}
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{product.name}</h1>

              {/* Price */}
              <div>
                <span className="text-3xl font-bold text-emerald-700">
                  ৳{product.price?.toLocaleString()}
                </span>
                {product.variants?.length > 1 && (
                  <span className="text-sm text-gray-400 ml-2">starting from</span>
                )}
              </div>

              {/* Variants */}
              {product.variants && product.variants.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Available Variants
                  </h3>
                  <div className="space-y-2">
                    {product.variants.map((v: any) => {
                      const displayPrice = v.retailPrice ?? v.price;
                      const isLoose = (v.packType || "").toLowerCase() === "loose";
                      return (
                        <div
                          key={v.variantId}
                          className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:border-emerald-200 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {isLoose ? `Loose ${v.weightKg}KG` : `${v.unitLabel || 'Pack'} — ${v.weightKg}KG`}
                              </span>
                              {v.brandName && (
                                <span className="ml-2 text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                  {v.brandName}
                                </span>
                              )}
                              {v.sku && (
                                <span className="ml-2 text-[10px] text-gray-400">{v.sku}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-emerald-700">
                              ৳{displayPrice?.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {Number(v.availableQty)} {isLoose ? "KG" : "pcs"} available
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shop Info */}
              {shop && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center overflow-hidden shrink-0">
                      {shop.image ? (
                        <Image src={shop.image} alt={shop.shopName || shop.name} width={40} height={40} className="object-cover w-full h-full" unoptimized />
                      ) : (
                        <Store className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{shop.shopName || shop.name}</p>
                      {shop.shopAddress && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {shop.shopAddress}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
