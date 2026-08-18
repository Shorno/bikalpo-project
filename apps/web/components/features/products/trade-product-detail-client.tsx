"use client";

import type {
  ProductFeatureGroup,
  QuantitySelectorOption,
} from "@bikalpo-project/db/schema";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type CylinderSaleMode,
  CylinderTypePreview,
  CylinderTypeRadios,
} from "@/components/features/products/cylinder-type-radios";
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
  cylinderSale?: {
    exchangeEnabled: boolean;
    exchangeCreditAmount: number;
    defaultMode: "new" | "exchange";
    newUnitPrice?: number;
    effectiveExchangeUnitPrice?: number;
  } | null;
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
  previewMode?: boolean;
  purchaseMode?: "open_order" | "retailer_selection" | "direct";
  directShopId?: string;
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
  previewMode = false,
  purchaseMode = "retailer_selection",
  directShopId,
}: ProductDetailClientProps) {
  const { data: session } = authClient.useSession();
  const userRole = session?.user?.role as string | undefined;

  // Filter variants by user role: shop_owner → TRADE, everyone else → RETAIL only
  const roleFiltered = useMemo(() => {
    const active = variants.filter((v) => v.isActive !== false);

    if (previewMode) {
      const retail = active.filter(
        (v) => v.variantType === "retail" || v.variantType == null,
      );
      return retail.length > 0 ? retail : active;
    }

    if (userRole === "shop_owner") {
      const trade = active.filter((v) => v.variantType === "trade");
      return trade.length > 0 ? trade : active; // fallback to all if no TRADE variants exist
    }

    if (userRole === "admin") {
      return active; // admin sees all
    }

    // Guests and consumers → RETAIL variants only
    const retail = active.filter(
      (v) => v.variantType === "retail" || v.variantType == null,
    );
    return retail.length > 0 ? retail : active; // fallback to all if no RETAIL variants exist
  }, [previewMode, variants, userRole]);

  const sorted = useMemo(
    () =>
      [...roleFiltered].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [roleFiltered],
  );

  const [selectedId, setSelectedId] = useState<number>(sorted[0]?.id ?? -1);

  const selected = sorted.find((v) => v.id === selectedId) ?? sorted[0] ?? null;
  const [cylinderSaleMode, setCylinderSaleMode] = useState<CylinderSaleMode>(
    sorted[0]?.cylinderSale?.defaultMode ?? "new",
  );

  // Seller selection state
  const [selectedSeller, setSelectedSeller] = useState<{
    shopId: string;
    shopName: string;
    retailPrice: number;
  } | null>(null);

  const selectedBasePrice = selectedSeller
    ? selectedSeller.retailPrice
    : selected
      ? Number(selected.price)
      : Number(product.price);
  const selectedExchangeCredit =
    purchaseMode === "open_order" &&
    selected?.cylinderSale?.exchangeEnabled &&
    cylinderSaleMode === "exchange"
      ? selected.cylinderSale.exchangeCreditAmount
      : 0;
  const displayPrice = Math.max(0, selectedBasePrice - selectedExchangeCredit);
  const displayStock =
    purchaseMode === "open_order"
      ? 999
      : selected
        ? (selected.stockQuantity ?? 0)
        : product.stockQuantity;
  const displaySize = selected ? selected.unitLabel : product.size;
  const hasMultiple = sorted.length > 1;

  return (
    <div className="flex flex-col">
      {/* ── Price ── */}
      <div className="mb-4">
        {purchaseMode === "open_order" && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Reference price
          </p>
        )}
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
                  onClick={() => {
                    setSelectedId(v.id);
                    setCylinderSaleMode(v.cylinderSale?.defaultMode ?? "new");
                  }}
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
      {purchaseMode === "retailer_selection" && (
        <ProductSellers
          productId={product.id}
          selectedSeller={selectedSeller}
          onSelectSeller={setSelectedSeller}
        />
      )}

      {purchaseMode === "open_order" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Add exact variants to one request. Nearby retailers with the complete
          stock can offer their store price, discount, and delivery charge. You
          choose only after all prices freeze.
        </div>
      )}

      {purchaseMode === "open_order" && selected?.cylinderSale ? (
        <div className="mb-6">
          {selected.cylinderSale.exchangeEnabled ? (
            <CylinderTypeRadios
              value={cylinderSaleMode}
              onChange={setCylinderSaleMode}
              hint
            />
          ) : (
            <CylinderTypePreview exchangeAvailable={false} />
          )}
          {selected.cylinderSale.exchangeEnabled ? (
            <p className="mt-2 text-xs text-emerald-700">
              Exchange reference credit: ৳
              {selected.cylinderSale.exchangeCreditAmount.toLocaleString(
                "en-BD",
              )}{" "}
              each. Retailer offers use each retailer&apos;s configured credit.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              Exchange is not configured for this exact variant.
            </p>
          )}
        </div>
      ) : null}

      {purchaseMode === "direct" && selected?.cylinderSale?.exchangeEnabled && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Exchange or buy New at checkout</p>
          <p className="mt-1 leading-5 text-emerald-800">
            Exchange is selected by default. Return one exact-match empty
            cylinder per unit
            {selected.cylinderSale.exchangeCreditAmount > 0
              ? ` and save ৳${selected.cylinderSale.exchangeCreditAmount.toLocaleString("en-BD")} each.`
              : "."}
          </p>
        </div>
      )}

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
      {previewMode ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ordering and item requests are disabled while viewing the customer
          preview.
        </div>
      ) : (
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
          shopId={
            purchaseMode === "direct" ? directShopId : selectedSeller?.shopId
          }
          purchaseMode={purchaseMode === "open_order" ? "open_order" : "direct"}
          cylinderSaleMode={
            purchaseMode === "open_order" ? cylinderSaleMode : undefined
          }
          variant={purchaseMode === "open_order" ? "emerald" : "default"}
          orderMin={selected?.orderMin ? Number(selected.orderMin) : undefined}
          orderMax={selected?.orderMax ? Number(selected.orderMax) : undefined}
          orderIncrement={
            selected?.orderIncrement
              ? Number(selected.orderIncrement)
              : undefined
          }
          categoryName={categoryName}
          brandName={brandName ?? undefined}
        />
      )}
    </div>
  );
}
