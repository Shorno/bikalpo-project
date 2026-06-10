"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Package, StoreIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

function StockBadge({ qty }: { qty: number }) {
  if (qty <= 10)
    return (
      <Badge variant="destructive" className="text-[10px]">
        {qty} left
      </Badge>
    );
  if (qty <= 50)
    return (
      <Badge className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">
        {qty} in stock
      </Badge>
    );
  return (
    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
      {qty} in stock
    </Badge>
  );
}

function getPublicStorefrontBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_AUTH_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    return window.location.origin.replace("//warehouse.", "//");
  }

  return "http://bikalpo.localhost:3001";
}

export default function WarehouseStorePage() {
  const { data: session } = authClient.useSession();
  const user = session?.user as any;
  const slug = user?.warehouseSlug;
  const storefrontPath = slug ? `/w/${slug}` : "";
  const storefrontUrl = slug
    ? `${getPublicStorefrontBaseUrl()}${storefrontPath}`
    : "";

  const { data: warehouse } = useQuery({
    queryKey: ["warehouse-storefront", slug],
    queryFn: () => client.warehouse.getStorefrontBySlug({ slug: slug! }),
    enabled: !!slug,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["warehouse-categories", slug],
    queryFn: () => client.warehouse.getStorefrontCategories({ slug: slug! }),
    enabled: !!slug,
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["warehouse-products", slug],
    queryFn: () => client.warehouse.getStorefrontProducts({ slug: slug! }),
    enabled: !!slug,
  });

  const categories = categoriesData?.categories || [];
  const products = productsData?.products || [];
  const totalProducts = productsData?.pagination?.totalCount ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Storefront</h1>

      {/* Storefront URL Card */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <StoreIcon className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold">Your Warehouse Storefront</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Your warehouse storefront is accessible via direct URL only. Share
          this link or QR code with shop owners.
        </p>

        {slug ? (
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-amber-800">
                Storefront URL:
              </span>
              <code className="text-sm font-mono text-amber-700 bg-white rounded px-2 py-1">
                {storefrontPath}
              </code>
            </div>
            <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" />
                Open Storefront
              </Button>
            </a>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Your warehouse slug has not been configured yet.
          </div>
        )}
      </div>

      {/* Stats Row */}
      {slug && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Products</p>
            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Categories</p>
            <p className="text-2xl font-bold text-gray-900">
              {categories.length}
            </p>
          </div>
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <p className="text-xs text-muted-foreground mb-1">Warehouse</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {warehouse?.warehouseName || warehouse?.name || "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {warehouse?.warehouseAddress || "—"}
            </p>
          </div>
        </div>
      )}

      {/* Products Listed in Storefront */}
      {slug && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-base font-semibold">Products in Storefront</h2>
            <span className="text-xs text-muted-foreground">
              {products.length} items visible to shop owners
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600">
                No products in storefront
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Add inventory to make products visible to shop owners.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {products.map((item: any) => {
                const variant = item.variant;
                const product = item.product || variant?.product;
                const qty = Number(item.availableQty) || 0;
                const unitLabel =
                  variant?.unitLabel || variant?.packType || "Unit";
                const price = item.retailPrice || variant?.price || "0";
                const category = product?.category?.name;

                return (
                  <div
                    key={item.inventoryId || variant?.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product?.name || "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {category && (
                          <span className="text-xs text-muted-foreground">
                            {category}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {unitLabel}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        ৳ {price}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        / {unitLabel}
                      </p>
                    </div>

                    {/* Stock */}
                    <div className="shrink-0 w-24 text-right">
                      <StockBadge qty={qty} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
