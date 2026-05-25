"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import Image from "next/image";
import { use, useState } from "react";
import Link from "next/link";
import { orpc } from "@/utils/orpc";

/* ─── Types ─── */
type CartItem = {
  variantId: number;
  quantity: number;
  productName: string;
  unitLabel: string;
  weightKg: string;
  retailPrice: string;
  productImage: string;
  innerPackSizeKg?: string | null;
  packCountInside?: number | null;
  supplyMode: "loose" | "pack";
  targetVariantId?: number;
};

type CartonOption = {
  weightKg: number;
  count: number;
  totalKg: number;
  packsPerCarton: number;
};

type VariantItem = {
  inventoryId: number;
  variantId: number;
  availableQty: string;
  price: string;
  canOrder: boolean;
  variant: {
    unitLabel: string;
    weightKg: string;
    sku: string;
    price: string;
    packType: string | null;
    innerPackSizeKg: string | null;
    packCountInside: number | null;
    brandId: number | null;
    brandName: string | null;
    cartonOptions: CartonOption[];
    totalCartonCount: number;
  };
};

type GroupedProduct = {
  productId: number;
  name: string;
  image: string | null;
  categoryName: string;
  unitSize: string | null;
  brandName?: string;
  variants: VariantItem[];
};

/* ─── Compute per-carton price for a variant ─── */
function getCartonPriceForVariant(v: VariantItem): number {
  const rawPrice = Number(v.price) || 0;
  const isLoose = (v.variant.packType || "").toLowerCase() === "loose";
  const weightKg = Number(v.variant.weightKg) || 0;
  const opts = v.variant.cartonOptions || [];
  const firstCarton = opts[0];

  // 1. Use actual carton price from DB
  const dbPrice = Number(firstCarton?.cartonPrice || 0);
  if (dbPrice > 0) return dbPrice;

  // 2. Fallback: calculate
  if (firstCarton) {
    if (isLoose) {
      const perKg = weightKg > 0 ? rawPrice / weightKg : rawPrice;
      return perKg * firstCarton.weightKg;
    }
    if (firstCarton.packsPerCarton > 0) {
      return rawPrice * firstCarton.packsPerCarton;
    }
  }
  return rawPrice;
}

/* ─── Group flat API data → category → product×brand → variants ─── */
function groupByCategory(products: any[]): Map<string, GroupedProduct[]> {
  // Group by product+brand combination (each brand gets its own card)
  const productBrandMap = new Map<string, GroupedProduct>();
  for (const item of products) {
    const pid = item.product?.id;
    if (!pid) continue;
    const brandName = item.variant?.brandName || "Unbranded";
    const brandId = item.variant?.brandId || 0;
    const key = `${pid}_${brandId}`;
    
    if (!productBrandMap.has(key)) {
      productBrandMap.set(key, {
        productId: pid,
        name: item.product.name,
        image: item.product.image,
        categoryName: item.product.categoryName || "Uncategorized",
        unitSize: item.product.unitSize || null,
        brandName,
        variants: [],
      });
    }
    productBrandMap.get(key)!.variants.push({
      inventoryId: item.inventoryId,
      variantId: item.variantId,
      availableQty: item.availableQty,
      price: item.price,
      canOrder: item.canOrder,
      variant: item.variant,
    });
  }
  const catMap = new Map<string, GroupedProduct[]>();
  for (const prod of productBrandMap.values()) {
    const cat = prod.categoryName;
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(prod);
  }
  return catMap;
}

/* ─── Product Card (grid card) — one per product×brand ─── */
function ProductCard({
  product,
  cartQty,
  onClick,
}: {
  product: GroupedProduct;
  cartQty: number;
  onClick: () => void;
}) {
  const totalCartons = product.variants.reduce((s, v) => s + (v.variant.totalCartonCount || 0), 0);
  const looseKg = product.variants
    .filter((v) => (v.variant.packType || "").toLowerCase() === "loose" && (v.variant.totalCartonCount || 0) === 0)
    .reduce((s, v) => s + Number(v.availableQty || 0), 0);
  const lowestPrice = Math.min(...product.variants.map((v) => Number(v.price) || 0));
  const variantCount = product.variants.length;
  const brandName = product.brandName || product.variants[0]?.variant.brandName;

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300 text-left w-full"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package className="w-14 h-14 text-gray-300" />
          </div>
        )}
        {/* Stock badge */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {totalCartons > 0 && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                totalCartons > 10
                  ? "text-blue-600 bg-blue-50 border-blue-200"
                  : totalCartons > 3
                    ? "text-amber-600 bg-amber-50 border-amber-200"
                    : "text-red-600 bg-red-50 border-red-200"
              }`}
            >
              📦 {totalCartons} Carton
            </span>
          )}
          {looseKg > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border text-emerald-600 bg-emerald-50 border-emerald-200">
              🏷️ {Math.round(looseKg * 100) / 100} KG Loose
            </span>
          )}
          {totalCartons === 0 && looseKg === 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border text-red-600 bg-red-50 border-red-200">
              Out of stock
            </span>
          )}
        </div>
        {/* Brand badge */}
        {brandName && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 text-gray-700 border border-gray-200 shadow-sm backdrop-blur-sm">
              {brandName}
            </span>
          </div>
        )}
        {/* Cart badge */}
        {cartQty > 0 && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-lg">
              {cartQty}
            </span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
          {product.name}{brandName ? ` - ${brandName}` : ""}
        </h3>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {variantCount} variant{variantCount > 1 ? "s" : ""}{totalCartons > 0 ? ` • 📦 ${totalCartons} carton` : ""}{looseKg > 0 ? ` • 🏷️ ${Math.round(looseKg * 100) / 100} KG` : ""}
        </p>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className="text-base font-bold text-gray-900">৳{lowestPrice.toLocaleString()}</span>
          {variantCount > 1 && <span className="text-[10px] text-gray-400">onwards</span>}
        </div>
      </div>
    </button>
  );
}

/* ─── Variant Selection Modal with Brand-wise Pricing ─── */
function VariantModal({
  product,
  cart,
  addToCart,
  updateQty,
  onClose,
}: {
  product: GroupedProduct;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQty: (variantId: number, delta: number) => void;
  onClose: () => void;
}) {
  const defaultIdx = product.variants.findIndex(v => (v.variant.totalCartonCount || 0) > 0);
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [qty, setQty] = useState(1);
  const [selectedCartonSizeIdx, setSelectedCartonSizeIdx] = useState(0);

  // ── Group variants by brand ──
  const brandGroups = (() => {
    const map = new Map<string, { brandName: string; brandId: number | null; variants: (VariantItem & { idx: number })[] }>();
    product.variants.forEach((v, idx) => {
      const key = v.variant.brandName || "Unbranded";
      if (!map.has(key)) {
        map.set(key, { brandName: key, brandId: v.variant.brandId, variants: [] });
      }
      map.get(key)!.variants.push({ ...v, idx });
    });
    return Array.from(map.values());
  })();

  const hasBrands = brandGroups.length > 1 || (brandGroups.length === 1 && brandGroups[0]!.brandName !== "Unbranded");

  const selected = product.variants[selectedIdx]!;
  const selectedBrandKey = selected.variant.brandName || "Unbranded";
  const inCart = cart.find((c) => c.variantId === selected.variantId);
  const cartonOptions = selected.variant.cartonOptions || [];
  const selectedCarton = cartonOptions[selectedCartonSizeIdx] || cartonOptions[0];
  const isLooseVariant = (selected.variant.packType || "").toLowerCase() === "loose";
  const isLooseWithoutCartons = isLooseVariant && cartonOptions.length === 0;
  const looseAvailableKg = isLooseWithoutCartons ? Number(selected.availableQty || 0) : 0;
  const stockQty = isLooseWithoutCartons ? looseAvailableKg : (selectedCarton?.count ?? 0);
  const canOrder = selected.canOrder !== false && stockQty > 0;

  // Calculate per-carton price
  const variantWeightKg = Number(selected.variant.weightKg) || 0;
  const rawPrice = Number(selected.price) || 0;
  const perCartonPrice = (() => {
    // Use actual carton price from carton table if available
    const cartonPriceFromDB = Number(selectedCarton?.cartonPrice || 0);
    if (cartonPriceFromDB > 0) return cartonPriceFromDB;

    // Fallback: calculate from pack/unit price
    if (isLooseVariant && selectedCarton) {
      if (variantWeightKg > 0) {
        const perKg = rawPrice / variantWeightKg;
        return perKg * selectedCarton.weightKg;
      }
      return rawPrice * selectedCarton.weightKg;
    }
    // Pack: multiply per-pack price by packs per carton
    if (selectedCarton && selectedCarton.packsPerCarton > 0) {
      return rawPrice * selectedCarton.packsPerCarton;
    }
    return rawPrice;
  })();

  // Get variants for the currently selected brand
  const currentBrandGroup = brandGroups.find(bg => bg.brandName === selectedBrandKey);
  const brandVariants = currentBrandGroup?.variants ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/90 hover:bg-gray-100 border border-gray-200 transition-colors">
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {/* Product Image */}
        <div className="relative h-48 bg-gray-50 rounded-t-2xl overflow-hidden">
          {product.image ? (
            <Image src={product.image} alt={product.name} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-gray-300" />
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Product Name & Category */}
          <div>
            <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{product.categoryName}</p>
          </div>

          {/* ─── Brand-wise Price Comparison ─── */}
          {hasBrands && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Brand-wise Pricing
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {brandGroups.map((bg) => {
                  const orderableVariants = bg.variants;
                  const cartonPrices = orderableVariants
                    .map(v => {
                      const isLooseV = (v.variant.packType || "").toLowerCase() === "loose";
                      const hasCartons = (v.variant.totalCartonCount || 0) > 0;
                      if (isLooseV && !hasCartons) return Number(v.price) || 0;
                      return getCartonPriceForVariant(v);
                    })
                    .filter(p => p > 0);
                  const minPrice = cartonPrices.length > 0 ? Math.min(...cartonPrices) : 0;
                  const maxPrice = cartonPrices.length > 0 ? Math.max(...cartonPrices) : 0;
                  const isActive = bg.brandName === selectedBrandKey;
                  const brandCartCount = bg.variants.reduce((sum, v) => {
                    const ci = cart.find(c => c.variantId === v.variantId);
                    return sum + (ci?.quantity ?? 0);
                  }, 0);
                  const totalBrandCartons = bg.variants.reduce((s, v) => s + (v.variant.totalCartonCount || 0), 0);
                  const totalBrandLooseKg = bg.variants
                    .filter(v => (v.variant.packType || "").toLowerCase() === "loose" && (v.variant.totalCartonCount || 0) === 0)
                    .reduce((s, v) => s + Number(v.availableQty || 0), 0);

                  return (
                    <button
                      key={bg.brandName}
                      onClick={() => {
                        // Prefer first variant with cartons
                        const withCartons = bg.variants.find(v => (v.variant.totalCartonCount || 0) > 0);
                        setSelectedIdx((withCartons || bg.variants[0])!.idx);
                        setSelectedCartonSizeIdx(0);
                        setQty(1);
                      }}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                        isActive
                          ? "border-blue-500 bg-blue-50/70 shadow-sm"
                          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50"
                      }`}
                    >
                      {brandCartCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] font-bold shadow">
                          {brandCartCount}
                        </span>
                      )}
                      <div className={`text-xs font-semibold truncate ${isActive ? "text-blue-700" : "text-gray-800"}`}>
                        {bg.brandName}
                      </div>
                      <div className={`text-sm font-bold mt-1 ${isActive ? "text-blue-900" : "text-gray-900"}`}>
                        ৳{minPrice.toLocaleString()}
                        {maxPrice > minPrice && (
                          <span className="text-[10px] font-normal text-gray-400"> – ৳{maxPrice.toLocaleString()}</span>
                        )}
                      </div>
                      {/* Variant size tags */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {bg.variants
                          .map((v) => {
                          const vw = Number(v.variant.weightKg) || 0;
                          const isLooseV = (v.variant.packType || "").toLowerCase() === "loose";
                          const looseW = vw > 0 ? vw : (Number(v.variant.unitLabel) || 0);
                          const label = isLooseV
                            ? `Loose${looseW > 0 ? ` ${looseW}kg` : ""}`
                            : `${vw > 0 ? `${vw}kg` : v.variant.unitLabel || "Pack"}`;
                          return (
                            <span
                              key={v.variantId}
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                isActive ? "bg-blue-100/80 text-blue-600" : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-gray-400">{bg.variants.length} variant{bg.variants.length > 1 ? "s" : ""}</span>
                        <span className="text-[10px] text-gray-300">•</span>
                        {totalBrandCartons > 0 && (
                          <span className={`text-[10px] ${totalBrandCartons > 5 ? "text-blue-500" : "text-amber-500"}`}>
                            📦 {totalBrandCartons} carton
                          </span>
                        )}
                        {totalBrandLooseKg > 0 && (
                          <>
                            {totalBrandCartons > 0 && <span className="text-[10px] text-gray-300">•</span>}
                            <span className="text-[10px] text-emerald-500">
                              🏷️ {Math.round(totalBrandLooseKg * 100) / 100} KG
                            </span>
                          </>
                        )}
                        {totalBrandCartons === 0 && totalBrandLooseKg === 0 && (
                          <span className="text-[10px] text-red-400">No stock</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variant Info */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">
                {isLooseWithoutCartons
                  ? <>{variantWeightKg > 0 ? `${variantWeightKg} KG` : "Loose"} — KG Ordering</>
                  : selectedCarton
                    ? <>{selectedCarton.weightKg} KG{selectedCarton.packsPerCarton > 0 && variantWeightKg > 0 ? ` (${variantWeightKg} KG × ${selectedCarton.packsPerCarton} pcs)` : " – Carton"}</>
                    : "Select a carton size"
                }
              </div>
              {selected.variant.brandName && (
                <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                  {selected.variant.brandName}
                </span>
              )}
            </div>
            {selected.variant.sku && (
              <div className="text-[10px] text-gray-400 mt-1">SKU: {selected.variant.sku}</div>
            )}
          </div>

          {/* Price & Stock */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-gray-900">৳{isLooseWithoutCartons ? rawPrice.toLocaleString() : perCartonPrice.toLocaleString()}</div>
              <div className="text-[10px] text-gray-400">{isLooseWithoutCartons ? (variantWeightKg > 0 ? `per ${variantWeightKg} KG` : "per KG") : "per Carton"}</div>
            </div>
            <div className="text-right">
              {isLooseWithoutCartons ? (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  looseAvailableKg > 50 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
                  looseAvailableKg > 0 ? "text-amber-600 bg-amber-50 border-amber-200" :
                  "text-red-600 bg-red-50 border-red-200"
                }`}>
                  {looseAvailableKg > 0 ? `🏷️ ${Math.round(looseAvailableKg * 100) / 100} KG available` : "Out of stock"}
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  stockQty > 10 ? "text-blue-600 bg-blue-50 border-blue-200" :
                  stockQty > 0 ? "text-amber-600 bg-amber-50 border-amber-200" :
                  "text-red-600 bg-red-50 border-red-200"
                }`}>
                  {stockQty > 0 ? `📦 ${stockQty} Carton available` : "Out of stock"}
                </span>
              )}
            </div>
          </div>

          {/* ─── Select Variant within selected brand ─── */}
          {brandVariants.length > 1 && (() => {
            const packVars = brandVariants.filter(v => (v.variant.packType || "").toLowerCase() !== "loose");
            const looseVars = brandVariants.filter(v => (v.variant.packType || "").toLowerCase() === "loose");
            const selectedIsLoose = (selected.variant.packType || "").toLowerCase() === "loose";

            return (
              <div className="space-y-3">
                {/* Pack variant buttons */}
                {packVars.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Select Pack
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {packVars.map((v) => {
                        const vWeight = Number(v.variant.weightKg) || 0;
                        const isSelected = v.idx === selectedIdx;
                        const vInCart = cart.find((c) => c.variantId === v.variantId);
                        const vTotalCartons = v.variant.totalCartonCount || 0;
                        const vCartonPrice = getCartonPriceForVariant(v);

                        return (
                          <button
                            key={v.variantId}
                            onClick={() => { setSelectedIdx(v.idx); setSelectedCartonSizeIdx(0); setQty(1); }}
                            className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all text-left ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                            }`}
                          >
                            <div className="font-semibold">{vWeight > 0 ? `${vWeight} KG` : v.variant.unitLabel || "Pack"}</div>
                            <div className={`text-[9px] mt-0.5 ${isSelected ? "text-blue-200" : "text-gray-400"}`}>
                              ৳{vCartonPrice.toLocaleString()}
                            </div>
                            {vTotalCartons > 0 && (
                              <div className={`text-[9px] mt-0.5 font-medium ${isSelected ? "text-blue-200" : "text-blue-500"}`}>
                                📦 {vTotalCartons} carton
                              </div>
                            )}
                            {vInCart && (
                              <div className={`text-[9px] mt-0.5 ${isSelected ? "text-blue-200" : "text-blue-500"}`}>
                                {vInCart.quantity} in cart
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Loose variants — show all (with or without cartons) */}
                {looseVars.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Loose
                    </h3>
                    <select
                      value={selectedIsLoose ? String(selectedIdx) : ""}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        if (!isNaN(idx)) {
                          setSelectedIdx(idx);
                          setSelectedCartonSizeIdx(0);
                          setQty(1);
                        }
                      }}
                      className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium border transition-all appearance-none bg-no-repeat bg-[length:16px] bg-[right_12px_center] cursor-pointer ${
                        selectedIsLoose
                          ? "bg-blue-50 text-blue-700 border-blue-300"
                          : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                      }`}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
                    >
                      <option value="">— Select loose variant —</option>
                      {looseVars.map((v) => {
                        const opts = v.variant.cartonOptions || [];
                        const hasCartons = (v.variant.totalCartonCount || 0) > 0;
                        const vAvailKg = Number(v.availableQty || 0);
                        const sizeLabel = hasCartons
                          ? (opts.length > 0
                              ? opts.map(o => `${o.weightKg} KG × ${o.count}`).join(", ")
                              : `${v.variant.totalCartonCount} carton`)
                          : `${Math.round(vAvailKg * 100) / 100} KG available`;
                        const priceLabel = hasCartons
                          ? `৳${getCartonPriceForVariant(v).toLocaleString()}`
                          : `৳${(Number(v.price) || 0).toLocaleString()}/unit`;
                        return (
                          <option key={v.variantId} value={String(v.idx)}>
                            {v.variant.brandName || "Loose"} — {sizeLabel} — {priceLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── Select Carton Size ─── */}
          {cartonOptions.length >= 1 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Select Carton Size
              </h3>
              <div className="flex flex-wrap gap-2">
                {cartonOptions.map((opt, optIdx) => {
                  const isSelected = optIdx === selectedCartonSizeIdx;
                  return (
                    <button
                      key={`${selected.variantId}-${opt.weightKg}`}
                      onClick={() => { setSelectedCartonSizeIdx(optIdx); setQty(1); }}
                      className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all text-left ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                    >
                      <div className="font-semibold">{opt.weightKg} KG</div>
                      <div className={`text-[9px] mt-0.5 font-medium ${isSelected ? "text-blue-200" : "text-blue-500"}`}>
                        📦 {opt.count} carton ({opt.totalKg} KG)
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Quantity ─── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quantity</h3>
            {!canOrder ? (
              selected.canOrder === false ? (
                <button
                  onClick={() => toast.info("Access request sent.")}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm bg-amber-50 text-amber-600 border border-amber-200 rounded-lg font-medium"
                >
                  <Lock size={14} /> Request Access
                </button>
              ) : (
                <div className="text-center text-sm text-red-400 py-3 bg-red-50 rounded-lg border border-red-100">Out of stock</div>
              )
            ) : isLooseWithoutCartons ? (
              /* ── KG-based stepper for loose without cartons ── */
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-gray-900">{qty}</span>
                    <span className="text-sm text-gray-500 ml-1.5">{variantWeightKg > 0 ? `× ${variantWeightKg} KG` : "KG"}</span>
                  </div>
                  <button
                    onClick={() => setQty(Math.min(Math.floor(looseAvailableKg), qty + 1))}
                    className="w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Total calculation */}
                <div className="flex items-center justify-between mt-2 px-2 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-500">
                  <span>Total: {qty} × ৳{rawPrice.toLocaleString()}</span>
                  <span className="font-bold text-gray-900">= ৳{(qty * rawPrice).toLocaleString()}</span>
                </div>

                {variantWeightKg > 0 && (
                  <div className="text-center text-[10px] text-emerald-500 mt-1">
                    = {(qty * variantWeightKg).toFixed(1)} KG total
                  </div>
                )}
              </>
            ) : (
              /* ── Carton-based stepper ── */
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-gray-900">{qty}</span>
                    <span className="text-sm text-gray-500 ml-1.5">Carton</span>
                  </div>
                  <button
                    onClick={() => setQty(Math.min(stockQty, qty + 1))}
                    className="w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Total calculation */}
                <div className="flex items-center justify-between mt-2 px-2 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-500">
                  <span>Total: {qty} Carton × ৳{perCartonPrice.toLocaleString()}</span>
                  <span className="font-bold text-gray-900">= ৳{(qty * perCartonPrice).toLocaleString()}</span>
                </div>

                {selectedCarton && (
                  <div className="text-center text-[10px] text-blue-500 mt-1">
                    = {(qty * selectedCarton.weightKg).toFixed(1)} KG total
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── Action Buttons ─── */}
          {canOrder && (
            <div className="flex gap-2 pt-1">
              {inCart ? (
                <>
                  <button
                    onClick={() => { updateQty(selected.variantId, qty - inCart.quantity); onClose(); }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShoppingCart size={14} /> Update Cart ({qty})
                  </button>
                  <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      addToCart({
                        variantId: selected.variantId,
                        quantity: qty,
                        productName: product.name,
                        unitLabel: isLooseWithoutCartons ? "KG" : "Carton",
                        weightKg: isLooseWithoutCartons ? selected.variant.weightKg : (selectedCarton ? String(selectedCarton.weightKg) : selected.variant.weightKg),
                        retailPrice: isLooseWithoutCartons ? String(rawPrice) : String(perCartonPrice),
                        productImage: product.image || "",
                        innerPackSizeKg: selected.variant.innerPackSizeKg,
                        packCountInside: selected.variant.packCountInside,
                        supplyMode: isLooseWithoutCartons ? "loose" : "pack",
                        targetVariantId: selected.variantId,
                      });
                      onClose();
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShoppingCart size={14} /> Add to Cart — ৳{(qty * (isLooseWithoutCartons ? rawPrice : perCartonPrice)).toLocaleString()}
                  </button>
                  <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Close
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function OrderFromWarehousePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"browse" | "checkout" | "success">("browse");
  const selectedSlug = slug;
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(null);
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [orderResult, setOrderResult] = useState<any>(null);

  const { data: productsData, isLoading: loadingProducts, error: productsError } = useQuery({
    queryKey: ["shopOwner", "getWarehouseProductsFiltered", selectedSlug, search],
    queryFn: () =>
      orpc.shopOwner.getWarehouseProductsFiltered.call({
        warehouseSlug: selectedSlug,
        search: search || undefined,
        page: "1",
        limit: "100",
      }),
    enabled: !!selectedSlug && step === "browse",
    retry: false,
  });

  const orderMutation = useMutation({
    mutationFn: (data: any) => orpc.shopOwner.placeWarehouseOrder.call(data),
    onSuccess: (result) => {
      setOrderResult(result);
      setStep("success");
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ["shopOwner", "getMyWarehouses"] });
    },
  });

  function addToCart(item: CartItem) {
    setCart((prev) => {
      const ex = prev.find((c) => c.variantId === item.variantId);
      if (ex) return prev.map((c) => (c.variantId === item.variantId ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, item];
    });
  }

  function updateQty(variantId: number, delta: number) {
    setCart((prev) =>
      prev.map((c) => (c.variantId === variantId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)).filter((c) => c.quantity > 0),
    );
  }

  function removeFromCart(variantId: number) {
    setCart((prev) => prev.filter((c) => c.variantId !== variantId));
  }

  const cartTotal = cart.reduce((s, c) => s + Number(c.retailPrice) * c.quantity, 0);
  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0);
  const rawProducts = productsData?.products ?? [];
  const categoryGroups = groupByCategory(rawProducts);

  function getProductCartQty(prod: GroupedProduct) {
    return cart
      .filter((c) => prod.variants.some((v) => v.variantId === c.variantId))
      .reduce((s, c) => s + c.quantity, 0);
  }

  if (productsError) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <div className="bg-red-50 text-red-600 rounded-xl p-8 border border-red-100">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-bold mb-2">Access Denied or Not Found</h2>
          <p className="text-sm opacity-90">
            {(productsError as any)?.message || "You don't have access to this warehouse or it doesn't exist."}
          </p>
          <div className="mt-6">
            <Link href="/dashboard/warehouses" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors bg-white border rounded-md hover:bg-gray-50 text-gray-700">
              Back to My Warehouses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse className="text-blue-600" size={24} /> Order from Warehouse
          </h1>
          <p className="text-sm text-gray-500 mt-1">Browse products and place your order</p>
        </div>
        <Link href="/dashboard/warehouses" className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          Back
        </Link>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-xs">
        {(["browse", "checkout", "success"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full font-medium ${step === s ? "bg-blue-100 text-blue-700" : ["browse", "checkout", "success"].indexOf(step) > i ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 2 && <ArrowRight size={12} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: BROWSE (Store Grid View) ═══ */}
      {step === "browse" && (
        <div className="space-y-4">
          {/* Banner */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-sm text-blue-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 🏭 Connected to: {selectedSlug}
            </span>
          </div>

          {/* Search + Cart count */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
            {cart.length > 0 && (
              <button onClick={() => setStep("checkout")}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                <ShoppingCart size={16} /> <span>{cartItemCount} items</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">৳{cartTotal.toLocaleString()}</span>
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {/* Product Grid */}
            <div className="lg:col-span-3 space-y-6">
              {loadingProducts ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                      <div className="aspect-[4/3] bg-gray-100" />
                      <div className="p-3 space-y-2"><div className="h-4 bg-gray-100 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
                    </div>
                  ))}
                </div>
              ) : rawProducts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Package className="mx-auto text-gray-300 mb-3" size={40} />
                  <p className="text-sm text-gray-500 font-medium">No products available</p>
                </div>
              ) : (
                Array.from(categoryGroups.entries()).map(([catName, prods]) => (
                  <div key={catName}>
                    {/* Category Header */}
                    <div className="flex items-center gap-2 mb-3">
                       <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
                       <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                         {catName} ({prods.length})
                       </h2>
                       <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />
                     </div>
 
                     {/* Product Cards Grid */}
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                       {prods.map((prod) => (
                         <ProductCard
                           key={`${prod.productId}_${prod.brandName || ''}`}
                           product={prod}
                           cartQty={getProductCartQty(prod)}
                           onClick={() => setSelectedProduct(prod)}
                         />
                       ))}
                     </div>
                   </div>
                 ))
               )}
             </div>
 
             {/* Cart Sidebar */}
             <div className="lg:col-span-1">
               <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4">
                 <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                   <ShoppingCart size={14} /> Cart ({cartItemCount} items)
                 </h3>
                 {cart.length === 0 ? (
                   <div className="text-center py-6">
                     <ShoppingCart className="mx-auto text-gray-200 mb-2" size={32} />
                     <p className="text-xs text-gray-400">Add products to your cart</p>
                   </div>
                 ) : (
                   <>
                     <div className="space-y-2 max-h-[300px] overflow-y-auto">
                       {cart.map((item) => (
                         <div key={item.variantId} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                           {item.productImage && <Image src={item.productImage} alt="" width={28} height={28} className="w-7 h-7 rounded object-cover shrink-0" unoptimized />}
                           <div className="flex-1 min-w-0">
                             <div className="text-[11px] font-medium text-gray-800 truncate">{item.productName}</div>
                             <div className="text-[10px] text-gray-400">{item.unitLabel} × {item.quantity}</div>
                           </div>
                           <div className="flex flex-col items-end gap-1 shrink-0">
                             <span className="text-[11px] font-semibold">৳{(Number(item.retailPrice) * item.quantity).toLocaleString()}</span>
                             <button onClick={() => removeFromCart(item.variantId)} className="text-red-400 hover:text-red-600"><Trash2 size={10} /></button>
                           </div>
                         </div>
                       ))}
                     </div>
                     <div className="flex items-center justify-between mt-3 pt-2 border-t font-semibold text-sm">
                       <span>Total</span>
                       <span className="text-emerald-700">৳{cartTotal.toLocaleString()}</span>
                     </div>
                     <button onClick={() => setStep("checkout")}
                       className="w-full mt-3 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                       <ShoppingCart size={14} /> Checkout
                     </button>
                   </>
                 )}
               </div>
             </div>
           </div>
         </div>
       )}
 
       {/* ═══ STEP 2: CHECKOUT ═══ */}
       {step === "checkout" && (
         <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
           <h2 className="text-sm font-semibold text-gray-800">Shipping Details</h2>
           <div className="grid gap-4 md:grid-cols-2">
             <div><span className="text-xs text-gray-500 font-medium block mb-1">Full Name *</span><input value={shippingName} onChange={(e) => setShippingName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Shop Owner Name" /></div>
             <div><span className="text-xs text-gray-500 font-medium block mb-1">Phone *</span><input value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" placeholder="01XXXXXXXXX" /></div>
           </div>
           <div><span className="text-xs text-gray-500 font-medium block mb-1">Address *</span><input value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Full delivery address" /></div>
           <div className="grid gap-4 md:grid-cols-2">
             <div><span className="text-xs text-gray-500 font-medium block mb-1">City *</span><input value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Dhaka" /></div>
             <div><span className="text-xs text-gray-500 font-medium block mb-1">Note (optional)</span><input value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Delivery instructions..." /></div>
           </div>
           <div className="border-t pt-4 mt-4">
             <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Order Summary</h3>
             <div className="space-y-2">
               {cart.map((item) => (
                 <div key={item.variantId} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                   {item.productImage && <Image src={item.productImage} alt="" width={36} height={36} className="w-9 h-9 rounded object-cover" unoptimized />}
                   <div className="flex-1 min-w-0"><span className="text-sm text-gray-800 font-medium truncate block">{item.productName}</span><span className="text-[10px] text-gray-400">{item.unitLabel} × {item.quantity}</span></div>
                   <span className="text-sm font-semibold shrink-0">৳{(Number(item.retailPrice) * item.quantity).toLocaleString()}</span>
                 </div>
               ))}
               <div className="flex justify-between font-semibold text-sm pt-2 border-t mt-2"><span>Total</span><span className="text-emerald-700">৳{cartTotal.toLocaleString()}</span></div>
             </div>
           </div>
           {orderMutation.isError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{(orderMutation.error as any)?.message || "Failed to place order"}</div>}
           <div className="flex gap-3">
             <button onClick={() => setStep("browse")} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Back</button>
             <button onClick={() => {
               if (!shippingName || !shippingPhone || !shippingAddress || !shippingCity) { alert("Please fill in all required shipping fields"); return; }
               orderMutation.mutate({ warehouseSlug: selectedSlug!, items: cart.map((c) => ({ variantId: c.variantId, quantity: c.quantity, supplyMode: c.supplyMode, targetVariantId: c.targetVariantId })), shippingName, shippingPhone, shippingAddress, shippingCity, customerNote: customerNote || undefined });
             }} disabled={orderMutation.isPending}
               className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
               {orderMutation.isPending ? (<><Loader2 size={14} className="animate-spin" /> Placing Order...</>) : (<>Place Order — ৳{cartTotal.toLocaleString()}</>)}
             </button>
           </div>
         </div>
       )}
 
       {/* ═══ STEP 3: SUCCESS ═══ */}
       {step === "success" && orderResult && (
         <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center">
           <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h2>
           <p className="text-sm text-gray-500 mb-1">{orderResult.message}</p>
           <p className="text-xs text-gray-400 font-mono mb-6">Order #{orderResult.order?.orderNumber}</p>
           <div className="flex gap-3 justify-center">
             <Link href="/dashboard/warehouses" className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Back to Warehouses</Link>
             <Link href="/dashboard/orders" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">View My Orders</Link>
           </div>
         </div>
       )}
 
       {/* ═══ Variant Selection Modal ═══ */}
       {selectedProduct && (
         <VariantModal
           product={selectedProduct}
           cart={cart}
           addToCart={addToCart}
           updateQty={updateQty}
           onClose={() => setSelectedProduct(null)}
         />
       )}
     </div>
   );
 }
