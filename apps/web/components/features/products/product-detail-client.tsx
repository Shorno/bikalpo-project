"use client";

import type {
  ProductFeatureGroup,
  QuantitySelectorOption,
} from "@bikalpo-project/db/schema";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductActions } from "@/components/features/products/product-actions";
import { ProductSellers } from "@/components/features/products/product-sellers";
import { ProductSpecs } from "@/components/features/products/product-specs";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/* ── Types ────────────────────────────────────────── */

export interface DetailVariant {
  id: number;
  sku: string | null;
  unitLabel: string;
  price: string;
  weightKg: string | null;
  packagingType: string | null;
  origin: string | null;
  shelfLife: string | null;
  orderMin: string | null;
  orderMax: string | null;
  orderIncrement: string | null;
  orderUnit: string | null;
  quantitySelectorOptions: QuantitySelectorOption[] | null;
  sortOrder: number | null;
  stockQuantity: number | null;
  variantType: string | null;
  packType: string | null;
  isActive: boolean | null;
}

interface ProductDetailClientProps {
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
    size: string;
    inStock: boolean;
    stockQuantity: number;
  };
  variants: DetailVariant[];
  categoryName: string;
  brandName?: string | null;
  subCategoryName?: string | null;
  productSize: string;
  features?: ProductFeatureGroup[] | null;
}

/* ── Component ────────────────────────────────────── */

export function ProductDetailClient({
  product,
  variants,
  categoryName,
  brandName,
  subCategoryName,
  productSize,
  features,
}: ProductDetailClientProps) {
  const { data: session } = authClient.useSession();
  const userRole = session?.user?.role as string | undefined;

  // Filter variants by user role: shop_owner → TRADE, everyone else → RETAIL only
  const roleFiltered = useMemo(() => {
    const active = variants.filter((v) => v.isActive !== false);

    if (userRole === "shop_owner") {
      const trade = active.filter((v) => v.variantType === "trade");
      return trade.length > 0 ? trade : active; // fallback to all if no TRADE variants exist
    }

    if (userRole === "admin") {
      return active; // admin sees all
    }

    // Guests and consumers → RETAIL variants only
    const retail = active.filter((v) => v.variantType === "retail" || v.variantType == null);
    return retail.length > 0 ? retail : active; // fallback to all if no RETAIL variants exist
  }, [variants, userRole]);

  const sorted = useMemo(
    () =>
      [...roleFiltered].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [roleFiltered],
  );

  const [selectedId, setSelectedId] = useState<number>(sorted[0]?.id ?? -1);

  const selected = sorted.find((v) => v.id === selectedId) ?? sorted[0] ?? null;

  // Seller selection state
  const [selectedSeller, setSelectedSeller] = useState<{
    shopId: string;
    shopName: string;
    retailPrice: number;
  } | null>(null);

  const displayPrice = selectedSeller
    ? selectedSeller.retailPrice
    : selected
      ? Number(selected.price)
      : Number(product.price);
  const displayStock = selected
    ? (selected.stockQuantity ?? 0)
    : product.stockQuantity;
  const displaySize = selected ? selected.unitLabel : product.size;
  const hasMultiple = sorted.length > 1;

  return (
    <div className="flex flex-col">
      {/* ── Price ── */}
      <div className="mb-4">
        {displayPrice > 0 ? (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              ৳{displayPrice.toLocaleString("en-BD")}
            </span>
            {displaySize && (
              <span className="text-sm text-gray-500">/ {displaySize}</span>
            )}
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium">
              <Link
                href="/signup"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Login
              </Link>{" "}
              to view price and stock availability
            </p>
          </div>
        )}
      </div>

      {/* ── Variant Selector ── */}
      {hasMultiple && (
        <div className="mb-6">
          <span className="text-sm font-medium text-gray-700 mb-2 block">
            Select Variant
          </span>
          <div className="flex flex-wrap gap-2">
            {sorted.map((v) => {
              const isSelected = v.id === selectedId;
              const price = Number(v.price);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    "relative px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                    "hover:border-blue-400 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isSelected
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-700",
                  )}
                >
                  <span className="block">{v.unitLabel}</span>
                  {price > 0 && (
                    <span
                      className={cn(
                        "block text-xs mt-0.5",
                        isSelected ? "text-blue-500" : "text-gray-400",
                      )}
                    >
                      ৳{price.toLocaleString("en-BD")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sellers selling this product ── */}
      <ProductSellers
        productId={product.id}
        selectedSeller={selectedSeller}
        onSelectSeller={setSelectedSeller}
      />

      {/* ── Specs ── */}
      <div className="mb-6">
        <ProductSpecs
          categoryName={categoryName}
          brandName={brandName ?? null}
          productSize={productSize}
          subCategoryName={subCategoryName ?? null}
          features={features}
          variants={selected ? [{ ...selected, sku: selected.sku }] : undefined}
        />
      </div>

      {/* ── Add to Cart ── */}
      <ProductActions
        product={{
          id: product.id,
          name: product.name,
          price: displayPrice,
          image: product.image,
          size: displaySize,
          inStock: product.inStock,
          stockQuantity: displayStock,
        }}
        variantId={selected?.id}
        shopId={selectedSeller?.shopId}
        orderMin={selected?.orderMin ? Number(selected.orderMin) : undefined}
        orderMax={selected?.orderMax ? Number(selected.orderMax) : undefined}
        orderIncrement={
          selected?.orderIncrement ? Number(selected.orderIncrement) : undefined
        }
        categoryName={categoryName}
        brandName={brandName ?? undefined}
      />
    </div>
  );
}
