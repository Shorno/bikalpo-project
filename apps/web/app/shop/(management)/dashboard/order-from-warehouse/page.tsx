"use client";

import type {
  FulfillmentMode,
  InventoryBehaviour,
  ProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";
import { INVENTORY_BEHAVIOUR_LABELS } from "@bikalpo-project/db/fulfillment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getDefaultWarehouseOrderMode,
  getFulfillmentFamilyLabel,
  getWarehouseModeDisplayLabel,
  getWarehouseOrderModeOptions,
} from "@/components/features/warehouse/warehouse-order-fulfillment";
import {
  usePlaceWarehouseOrder,
  useWarehouseCatalog,
} from "@/hooks/use-shop-owner-api";
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
  fulfillmentMode: FulfillmentMode;
  supplyMode: FulfillmentMode;
  modeLabel: string;
  quantityUnitLabel: string;
  targetVariantId?: number | null;
  targetVariantLabel?: string | null;
  familyLabel?: string;
};

type CartonOption = {
  weightKg: number;
  count: number;
  totalKg: number;
  packsPerCarton: number;
  cartonPrice?: string | null;
  deliveryCost?: string | null;
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
  type: {
    name: string;
    slug: string | null;
    inventoryBehaviour: InventoryBehaviour;
    trackingType: "none" | "batch" | "serial";
    isReturnablePack: boolean;
  };
  fulfillmentProfile: ProductTypeFulfillmentProfile;
  variants: VariantItem[];
};

/* ─── Group flat API data → category → product → variants ─── */
function groupByCategory(products: any[]): Map<string, GroupedProduct[]> {
  const productMap = new Map<number, GroupedProduct>();
  for (const item of products) {
    const pid = item.product?.id;
    if (!pid) continue;
    if (!productMap.has(pid)) {
      productMap.set(pid, {
        productId: pid,
        name: item.product.name,
        image: item.product.image,
        categoryName: item.product.categoryName || "Uncategorized",
        unitSize: item.product.unitSize || null,
        type: item.product.type,
        fulfillmentProfile: item.product.fulfillmentProfile,
        variants: [],
      });
    }
    productMap.get(pid)!.variants.push({
      inventoryId: item.inventoryId,
      variantId: item.variantId,
      availableQty: item.availableQty,
      price: item.price,
      canOrder: item.canOrder,
      variant: item.variant,
    });
  }
  const catMap = new Map<string, GroupedProduct[]>();
  for (const prod of productMap.values()) {
    const cat = prod.categoryName;
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(prod);
  }
  return catMap;
}

function getCartItemKey(item: {
  variantId: number;
  fulfillmentMode: FulfillmentMode;
  targetVariantId?: number | null;
}) {
  return `${item.variantId}:${item.fulfillmentMode}:${item.targetVariantId ?? "none"}`;
}

function buildWarehouseOrderUrl(warehouseSlug?: string | null) {
  if (!warehouseSlug) {
    return "/dashboard/order-from-warehouse";
  }

  return `/dashboard/order-from-warehouse?warehouse=${encodeURIComponent(warehouseSlug)}`;
}

/* ─── Product Card (grid card) ─── */
function ProductCard({
  product,
  cartQty,
  onClick,
}: {
  product: GroupedProduct;
  cartQty: number;
  onClick: () => void;
}) {
  const totalCartons = product.variants.reduce(
    (s, v) => s + (v.variant.totalCartonCount || 0),
    0,
  );
  const lowestPrice = Math.min(
    ...product.variants.map((v) => Number(v.price) || 0),
  );
  const variantCount = product.variants.length;
  const brandName = product.variants[0]?.variant.brandName;
  const familyLabel = getFulfillmentFamilyLabel(product.fulfillmentProfile);
  const behaviourLabel =
    INVENTORY_BEHAVIOUR_LABELS[product.type.inventoryBehaviour];
  const containerLabel = getWarehouseModeDisplayLabel(
    product.fulfillmentProfile,
    "carton",
  );
  const containerLabelLower = containerLabel.toLowerCase();

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
        <div className="absolute top-2 right-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              totalCartons > 10
                ? "text-blue-600 bg-blue-50 border-blue-200"
                : totalCartons > 3
                  ? "text-amber-600 bg-amber-50 border-amber-200"
                  : "text-red-600 bg-red-50 border-red-200"
            }`}
          >
            📦 {totalCartons} {containerLabel}
          </span>
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
          {product.name}
        </h3>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {familyLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
            {behaviourLabel}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {brandName && (
            <span className="text-blue-500 font-medium">{brandName}</span>
          )}
          {brandName && " • "}
          {variantCount} variant{variantCount > 1 ? "s" : ""} • 📦{" "}
          {totalCartons} {containerLabelLower}
        </p>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className="text-base font-bold text-gray-900">
            ৳{lowestPrice.toLocaleString()}
          </span>
          {variantCount > 1 && (
            <span className="text-[10px] text-gray-400">onwards</span>
          )}
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
  updateQty: (itemKey: string, delta: number) => void;
  onClose: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedCartonSizeIdx, setSelectedCartonSizeIdx] = useState(0);
  const [selectedMode, setSelectedMode] = useState<FulfillmentMode>(
    product.fulfillmentProfile.defaultMode,
  );

  // ── Group variants by brand ──
  const brandGroups = (() => {
    const map = new Map<
      string,
      {
        brandName: string;
        brandId: number | null;
        variants: (VariantItem & { idx: number })[];
      }
    >();
    product.variants.forEach((v, idx) => {
      const key = v.variant.brandName || "Unbranded";
      if (!map.has(key)) {
        map.set(key, {
          brandName: key,
          brandId: v.variant.brandId,
          variants: [],
        });
      }
      map.get(key)!.variants.push({ ...v, idx });
    });
    return Array.from(map.values());
  })();

  const hasBrands =
    brandGroups.length > 1 ||
    (brandGroups.length === 1 && brandGroups[0]!.brandName !== "Unbranded");

  const selected = product.variants[selectedIdx]!;
  const profile = product.fulfillmentProfile;
  const modeOptions = getWarehouseOrderModeOptions(profile, selected);
  const selectedModeOption =
    modeOptions.find((option) => option.mode === selectedMode) ??
    modeOptions[0];
  const selectedBrandKey = selected.variant.brandName || "Unbranded";
  const isLooseVariant =
    (selected.variant.packType || "").toLowerCase() === "loose";
  const variantWeightKg = Number(selected.variant.weightKg) || 0;
  const rawPrice = Number(selected.price) || 0;
  const usesContainerStock = selectedModeOption?.usesContainerStock ?? false;
  const selectedTargetVariantId = selectedModeOption?.requiresTargetVariant
    ? selected.variantId
    : null;
  const selectedCartKey = getCartItemKey({
    variantId: selected.variantId,
    fulfillmentMode: selectedModeOption?.mode ?? profile.defaultMode,
    targetVariantId: selectedTargetVariantId,
  });
  const inCart = cart.find((c) => getCartItemKey(c) === selectedCartKey);

  // ── Loose vs Carton: different stock & pricing logic ──
  const cartonOptions = selected.variant.cartonOptions || [];
  const selectedCarton = usesContainerStock
    ? cartonOptions[selectedCartonSizeIdx] || cartonOptions[0]
    : null;

  // For loose: stock is the raw availableQty (in KG); for carton: stock is carton count
  const looseStockKg =
    !usesContainerStock && isLooseVariant
      ? Number(selected.availableQty) || 0
      : 0;
  // For loose: max orderable qty = floor(total_loose_kg / variant_weight)
  const looseMaxQty =
    !usesContainerStock && isLooseVariant && variantWeightKg > 0
      ? Math.floor(looseStockKg / variantWeightKg)
      : 0;
  const directStockQty =
    !usesContainerStock && !isLooseVariant
      ? Math.floor(Number(selected.availableQty) || 0)
      : 0;
  const stockQty = usesContainerStock
    ? (selectedCarton?.count ?? selected.variant.totalCartonCount ?? 0)
    : isLooseVariant
      ? looseMaxQty
      : directStockQty;
  const canOrder = selected.canOrder !== false && stockQty > 0;

  // For loose: price is the base variant price (per weightKg unit, e.g. per 10KG)
  // For carton: calculate per-carton price from variant price
  const perUnitPrice = usesContainerStock
    ? Number(selectedCarton?.cartonPrice || rawPrice)
    : rawPrice;

  // Get variants for the currently selected brand
  const currentBrandGroup = brandGroups.find(
    (bg) => bg.brandName === selectedBrandKey,
  );
  const brandVariants = currentBrandGroup?.variants ?? [];
  const familyLabel = getFulfillmentFamilyLabel(profile);
  const behaviourLabel =
    INVENTORY_BEHAVIOUR_LABELS[product.type.inventoryBehaviour];
  const quantityUnitLabel =
    selectedModeOption?.quantityUnitLabel ??
    (isLooseVariant && variantWeightKg > 0
      ? `${variantWeightKg} KG`
      : selected.variant.unitLabel || "Unit");
  const containerLabel = getWarehouseModeDisplayLabel(profile, "carton");
  const containerLabelLower = containerLabel.toLowerCase();
  const selectedModeLabel = selectedModeOption?.label ?? "Unit";
  const selectedVariantLabel = selected.variant.unitLabel || quantityUnitLabel;
  const quantityDisplayLabel = usesContainerStock
    ? selectedModeLabel
    : quantityUnitLabel;
  const containerSelectionTitle = selectedModeOption?.label || containerLabel;
  const containerSelectionTitleLower = containerSelectionTitle.toLowerCase();
  const hasMeaningfulContainerWeight = (selectedCarton?.weightKg || 0) > 0;

  useEffect(() => {
    setSelectedMode(getDefaultWarehouseOrderMode(profile, selected));
  }, [profile, selected]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/90 hover:bg-gray-100 border border-gray-200 transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        {/* Product Image */}
        <div className="relative h-48 bg-gray-50 rounded-t-2xl overflow-hidden">
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
              <Package className="w-16 h-16 text-gray-300" />
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Product Name & Category */}
          <div>
            <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {product.categoryName}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                {familyLabel}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                {behaviourLabel}
              </span>
            </div>
          </div>

          {/* ─── Brand-wise Price Comparison ─── */}
          {hasBrands && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Brand-wise Pricing
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {brandGroups.map((bg) => {
                  const prices = bg.variants.map((v) => Number(v.price) || 0);
                  const minPrice = Math.min(...prices);
                  const maxPrice = Math.max(...prices);
                  const isActive = bg.brandName === selectedBrandKey;
                  const brandCartCount = bg.variants.reduce((sum, v) => {
                    const variantQty = cart
                      .filter((c) => c.variantId === v.variantId)
                      .reduce((variantSum, c) => variantSum + c.quantity, 0);
                    return sum + variantQty;
                  }, 0);
                  const totalBrandCartons = bg.variants.reduce(
                    (s, v) => s + (v.variant.totalCartonCount || 0),
                    0,
                  );

                  return (
                    <button
                      key={bg.brandName}
                      onClick={() => {
                        setSelectedIdx(bg.variants[0]!.idx);
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
                      <div
                        className={`text-xs font-semibold truncate ${isActive ? "text-blue-700" : "text-gray-800"}`}
                      >
                        {bg.brandName}
                      </div>
                      <div
                        className={`text-sm font-bold mt-1 ${isActive ? "text-blue-900" : "text-gray-900"}`}
                      >
                        ৳{minPrice.toLocaleString()}
                        {maxPrice > minPrice && (
                          <span className="text-[10px] font-normal text-gray-400">
                            {" "}
                            – ৳{maxPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {/* Variant size tags */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {bg.variants.map((v) => {
                          const vw = Number(v.variant.weightKg) || 0;
                          const isLooseV =
                            (v.variant.packType || "").toLowerCase() ===
                            "loose";
                          const looseW =
                            vw > 0 ? vw : Number(v.variant.unitLabel) || 0;
                          const label = isLooseV
                            ? `Loose${looseW > 0 ? ` ${looseW}kg` : ""}`
                            : `${vw > 0 ? `${vw}kg` : v.variant.unitLabel || "Pack"}`;
                          return (
                            <span
                              key={v.variantId}
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                isActive
                                  ? "bg-blue-100/80 text-blue-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-gray-400">
                          {bg.variants.length} variant
                          {bg.variants.length > 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-gray-300">•</span>
                        <span
                          className={`text-[10px] ${totalBrandCartons > 5 ? "text-blue-500" : totalBrandCartons > 0 ? "text-amber-500" : "text-red-400"}`}
                        >
                          📦 {totalBrandCartons} {containerLabelLower}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {modeOptions.length > 1 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Select Supply Mode
              </h3>
              <div className="flex flex-wrap gap-2">
                {modeOptions.map((option) => {
                  const isActive = option.mode === selectedModeOption?.mode;
                  return (
                    <button
                      key={`${selected.variantId}-${option.mode}`}
                      onClick={() => {
                        setSelectedMode(option.mode);
                        setQty(1);
                        setSelectedCartonSizeIdx(0);
                      }}
                      className={`px-3 py-2 rounded-lg border text-left transition-all ${
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                      }`}
                    >
                      <div className="text-xs font-semibold">
                        {option.label}
                      </div>
                      <div className="text-[10px] opacity-80">
                        {option.description}
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
                {!usesContainerStock ? (
                  selectedVariantLabel
                ) : isLooseVariant ? (
                  <>
                    {variantWeightKg > 0 ? `${variantWeightKg} KG` : "Loose"} –
                    Per Unit
                  </>
                ) : selectedCarton ? (
                  hasMeaningfulContainerWeight ? (
                    <>
                      {selectedCarton.weightKg} KG
                      {selectedCarton.packsPerCarton > 0 && variantWeightKg > 0
                        ? ` (${variantWeightKg} KG × ${selectedCarton.packsPerCarton} pcs)`
                        : ` – ${selectedModeLabel}`}
                    </>
                  ) : (
                    <>
                      {selectedVariantLabel} – {selectedModeLabel}
                    </>
                  )
                ) : (
                  `Select a ${containerSelectionTitleLower} size`
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isLooseVariant && (
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Loose
                  </span>
                )}
                {selected.variant.brandName && (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                    {selected.variant.brandName}
                  </span>
                )}
              </div>
            </div>
            {selected.variant.sku && (
              <div className="text-[10px] text-gray-400 mt-1">
                SKU: {selected.variant.sku}
              </div>
            )}
          </div>

          {/* Price & Stock */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-gray-900">
                ৳{perUnitPrice.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400">
                {usesContainerStock
                  ? `per ${selectedModeLabel.toLowerCase()}`
                  : `per ${quantityUnitLabel.toLowerCase()}`}
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  stockQty > 10
                    ? "text-blue-600 bg-blue-50 border-blue-200"
                    : stockQty > 0
                      ? "text-amber-600 bg-amber-50 border-amber-200"
                      : "text-red-600 bg-red-50 border-red-200"
                }`}
              >
                {!usesContainerStock && isLooseVariant
                  ? looseStockKg > 0
                    ? `🏷️ ${looseStockKg} KG available (${looseMaxQty} × ${variantWeightKg}KG)`
                    : "Out of stock"
                  : stockQty > 0
                    ? `📦 ${stockQty} ${quantityDisplayLabel} available`
                    : "Out of stock"}
              </span>
            </div>
          </div>

          {/* ─── Select Variant within selected brand ─── */}
          {brandVariants.length > 1 &&
            (() => {
              const packVars = brandVariants.filter(
                (v) => (v.variant.packType || "").toLowerCase() !== "loose",
              );
              const looseVars = brandVariants.filter(
                (v) => (v.variant.packType || "").toLowerCase() === "loose",
              );
              const selectedIsLoose =
                (selected.variant.packType || "").toLowerCase() === "loose";

              return (
                <div className="space-y-3">
                  {/* Pack variant buttons */}
                  {packVars.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {profile.family === "lpg"
                          ? "Select Cylinder Capacity"
                          : "Select Variant"}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {packVars.map((v) => {
                          const vWeight = Number(v.variant.weightKg) || 0;
                          const isSelected = v.idx === selectedIdx;
                          const vCartQty = cart
                            .filter((c) => c.variantId === v.variantId)
                            .reduce((sum, c) => sum + c.quantity, 0);
                          const vTotalCartons = v.variant.totalCartonCount || 0;

                          return (
                            <button
                              key={v.variantId}
                              onClick={() => {
                                setSelectedIdx(v.idx);
                                setSelectedCartonSizeIdx(0);
                                setQty(1);
                              }}
                              className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all text-left ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                              }`}
                            >
                              <div className="font-semibold">
                                {profile.family === "lpg"
                                  ? v.variant.unitLabel ||
                                    `${vWeight} KG Cylinder`
                                  : vWeight > 0
                                    ? `${vWeight} KG`
                                    : v.variant.unitLabel || "Unit"}
                              </div>
                              <div
                                className={`text-[9px] mt-0.5 ${isSelected ? "text-blue-200" : "text-gray-400"}`}
                              >
                                ৳{Number(v.price).toLocaleString()}
                              </div>
                              {vTotalCartons > 0 && (
                                <div
                                  className={`text-[9px] mt-0.5 font-medium ${isSelected ? "text-blue-200" : "text-blue-500"}`}
                                >
                                  📦 {vTotalCartons} {containerLabelLower}
                                </div>
                              )}
                              {vCartQty > 0 && (
                                <div
                                  className={`text-[9px] mt-0.5 ${isSelected ? "text-blue-200" : "text-blue-500"}`}
                                >
                                  {vCartQty} in cart
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Loose dropdown */}
                  {looseVars.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Loose
                      </h3>
                      <select
                        value={selectedIsLoose ? String(selectedIdx) : ""}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          if (!Number.isNaN(idx)) {
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
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        }}
                      >
                        <option value="">— Select loose variant —</option>
                        {looseVars.map((v) => {
                          const opts = v.variant.cartonOptions || [];
                          const sizeLabel =
                            opts.length > 0
                              ? opts
                                  .map((o) =>
                                    o.weightKg > 0
                                      ? `${o.weightKg} KG × ${o.count}`
                                      : `${o.count} ${containerLabelLower}`,
                                  )
                                  .join(", ")
                              : `${v.variant.totalCartonCount || 0} ${containerLabelLower}`;
                          return (
                            <option key={v.variantId} value={String(v.idx)}>
                              {v.variant.brandName || "Loose"} — {sizeLabel} — ৳
                              {Number(v.price).toLocaleString()}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* ─── Select Carton Size (hidden for loose) ─── */}
          {usesContainerStock && cartonOptions.length >= 1 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Select {containerSelectionTitle} Size
              </h3>
              <div className="flex flex-wrap gap-2">
                {cartonOptions.map((opt, optIdx) => {
                  const isSelected = optIdx === selectedCartonSizeIdx;
                  return (
                    <button
                      key={`${selected.variantId}-${optIdx}`}
                      onClick={() => {
                        setSelectedCartonSizeIdx(optIdx);
                        setQty(1);
                      }}
                      className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all text-left ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                    >
                      <div className="font-semibold">
                        {opt.weightKg > 0
                          ? `${opt.weightKg} KG`
                          : selectedVariantLabel}
                      </div>
                      <div
                        className={`text-[9px] mt-0.5 font-medium ${isSelected ? "text-blue-200" : "text-blue-500"}`}
                      >
                        {opt.totalKg > 0
                          ? `📦 ${opt.count} ${containerSelectionTitleLower} (${opt.totalKg} KG)`
                          : `📦 ${opt.count} ${containerSelectionTitleLower}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Quantity ─── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Quantity
            </h3>
            {!canOrder ? (
              selected.canOrder === false ? (
                <button
                  onClick={() => toast.info("Access request sent.")}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm bg-amber-50 text-amber-600 border border-amber-200 rounded-lg font-medium"
                >
                  <Lock size={14} /> Request Access
                </button>
              ) : (
                <div className="text-center text-sm text-red-400 py-3 bg-red-50 rounded-lg border border-red-100">
                  Out of stock
                </div>
              )
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-gray-900">
                      {qty}
                    </span>
                    <span className="text-sm text-gray-500 ml-1.5">
                      {!usesContainerStock && isLooseVariant
                        ? `× ${variantWeightKg} KG`
                        : quantityDisplayLabel}
                    </span>
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
                  <span>
                    {!usesContainerStock && isLooseVariant
                      ? `Total: ${qty} × ${variantWeightKg} KG × ৳${perUnitPrice.toLocaleString()}`
                      : `Total: ${qty} ${quantityDisplayLabel} × ৳${perUnitPrice.toLocaleString()}`}
                  </span>
                  <span className="font-bold text-gray-900">
                    = ৳{(qty * perUnitPrice).toLocaleString()}
                  </span>
                </div>

                {isLooseVariant ? (
                  <div className="text-center text-[10px] text-emerald-600 font-medium mt-1">
                    = {(qty * variantWeightKg).toFixed(1)} KG total added to
                    loose stock
                  </div>
                ) : selectedCarton ? (
                  <div className="text-center text-[10px] text-blue-500 mt-1">
                    {selectedCarton.weightKg > 0
                      ? `= ${(qty * selectedCarton.weightKg).toFixed(1)} KG total`
                      : `= ${qty} ${quantityDisplayLabel} selected`}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* ─── Action Buttons ─── */}
          {canOrder && (
            <div className="flex gap-2 pt-1">
              {inCart ? (
                <>
                  <button
                    onClick={() => {
                      updateQty(selectedCartKey, qty - inCart.quantity);
                      onClose();
                    }}
                    className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShoppingCart size={14} /> Update Cart ({qty})
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
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
                        unitLabel: usesContainerStock
                          ? selectedModeLabel
                          : quantityUnitLabel,
                        weightKg:
                          !usesContainerStock && isLooseVariant
                            ? String(variantWeightKg)
                            : selectedCarton
                              ? String(selectedCarton.weightKg)
                              : selected.variant.weightKg,
                        retailPrice: String(perUnitPrice),
                        productImage: product.image || "",
                        innerPackSizeKg: selected.variant.innerPackSizeKg,
                        packCountInside: selected.variant.packCountInside,
                        fulfillmentMode:
                          selectedModeOption?.mode ?? profile.defaultMode,
                        supplyMode:
                          selectedModeOption?.mode ?? profile.defaultMode,
                        modeLabel: selectedModeOption?.label ?? "Unit",
                        quantityUnitLabel,
                        targetVariantId: selectedTargetVariantId,
                        targetVariantLabel: selectedTargetVariantId
                          ? selected.variant.unitLabel
                          : null,
                        familyLabel,
                      });
                      onClose();
                    }}
                    className={`flex-1 py-2.5 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      !usesContainerStock && isLooseVariant
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    <ShoppingCart size={14} />
                    {!usesContainerStock && isLooseVariant
                      ? `Add ${qty * variantWeightKg} KG — ৳${(qty * perUnitPrice).toLocaleString()}`
                      : `Add to Cart — ৳${(qty * perUnitPrice).toLocaleString()}`}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
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
export default function OrderFromWarehousePage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkedWarehouseSlug = searchParams.get("warehouse");
  const [step, setStep] = useState<
    "connect" | "browse" | "checkout" | "success"
  >(deepLinkedWarehouseSlug ? "browse" : "connect");
  const [warehouseInput, setWarehouseInput] = useState(
    deepLinkedWarehouseSlug ?? "",
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    deepLinkedWarehouseSlug,
  );
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(
    null,
  );
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [orderResult, setOrderResult] = useState<any>(null);

  const { data: connectedData, isLoading: loadingConnected } = useQuery({
    queryKey: ["shopOwner", "getConnectedWarehouses"],
    queryFn: () => orpc.shopOwner.getConnectedWarehouses.call(),
  });
  const recentWarehouses = connectedData?.warehouses ?? [];

  const connectMutation = useMutation({
    mutationFn: (slug: string) =>
      orpc.shopOwner.connectToWarehouse.call({ warehouseSlug: slug }),
    onSuccess: (data) => {
      if (
        (data.status as string) === "connected" ||
        data.status === "already_connected"
      ) {
        setSelectedSlug(data.warehouse.warehouseSlug);
        setStep("browse");
        router.replace(buildWarehouseOrderUrl(data.warehouse.warehouseSlug));
      }
      queryClient.invalidateQueries({
        queryKey: ["shopOwner", "getConnectedWarehouses"],
      });
    },
  });

  const {
    data: productsData,
    isLoading: loadingProducts,
    error: productsError,
  } = useWarehouseCatalog({
    warehouseSlug: selectedSlug ?? "",
    search,
    page: "1",
    limit: "100",
    enabled: !!selectedSlug && step === "browse",
  });

  const orderMutation = usePlaceWarehouseOrder();

  useEffect(() => {
    if (!deepLinkedWarehouseSlug || deepLinkedWarehouseSlug === selectedSlug) {
      return;
    }

    setWarehouseInput(deepLinkedWarehouseSlug);
    setSelectedSlug(deepLinkedWarehouseSlug);
    setStep("browse");
  }, [deepLinkedWarehouseSlug, selectedSlug]);

  function parseSlug(input: string): string | null {
    const t = input.trim();
    if (!t) return null;
    if (!t.includes("/")) return t;
    const m = t.match(/\/(?:warehouse|w)\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  function addToCart(item: CartItem) {
    setCart((prev) => {
      const itemKey = getCartItemKey(item);
      const ex = prev.find((c) => getCartItemKey(c) === itemKey);
      if (ex) {
        return prev.map((c) =>
          getCartItemKey(c) === itemKey
            ? { ...c, quantity: c.quantity + item.quantity }
            : c,
        );
      }
      return [...prev, item];
    });
  }

  function updateQty(itemKey: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          getCartItemKey(c) === itemKey
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }

  function removeFromCart(itemKey: string) {
    setCart((prev) => prev.filter((c) => getCartItemKey(c) !== itemKey));
  }

  const cartTotal = cart.reduce(
    (s, c) => s + Number(c.retailPrice) * c.quantity,
    0,
  );
  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0);
  const rawProducts = productsData?.products ?? [];
  const categoryGroups = groupByCategory(rawProducts);

  function getProductCartQty(prod: GroupedProduct) {
    return cart
      .filter((c) => prod.variants.some((v) => v.variantId === c.variantId))
      .reduce((s, c) => s + c.quantity, 0);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Warehouse className="text-blue-600" size={24} /> Order from Warehouse
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect to a warehouse, browse products, and place your order
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-xs">
        {(["connect", "browse", "checkout", "success"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full font-medium ${step === s ? "bg-blue-100 text-blue-700" : ["connect", "browse", "checkout", "success"].indexOf(step) > i ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 3 && <ArrowRight size={12} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: CONNECT ═══ */}
      {step === "connect" && (
        <div className="space-y-4">
          {recentWarehouses.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                <Clock size={14} className="text-blue-500" /> Recent Warehouses
              </h2>
              <div className="space-y-2">
                {recentWarehouses.map((wh: any) => (
                  <button
                    key={wh.connectionId}
                    onClick={() =>
                      wh.warehouseSlug &&
                      connectMutation.mutate(wh.warehouseSlug)
                    }
                    disabled={connectMutation.isPending}
                    className="w-full flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                      <Warehouse className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {wh.warehouseName || wh.name}
                      </p>
                      {wh.warehouseAddress && (
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {wh.warehouseAddress}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-emerald-600 font-medium shrink-0">
                      {wh.productCount} products
                    </span>
                    <ArrowRight size={14} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {loadingConnected && recentWarehouses.length === 0 && (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Link2 size={14} className="text-gray-500" />{" "}
              {recentWarehouses.length > 0
                ? "Or Enter Warehouse ID / URL"
                : "Enter Warehouse ID / URL"}
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. algoverse"
                value={warehouseInput}
                onChange={(e) => setWarehouseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const slug = parseSlug(warehouseInput);
                    if (slug) connectMutation.mutate(slug);
                  }
                }}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={() => {
                  const slug = parseSlug(warehouseInput);
                  if (slug) connectMutation.mutate(slug);
                }}
                disabled={!warehouseInput.trim() || connectMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {connectMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Connect"
                )}
              </button>
            </div>
            {connectMutation.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                <p className="text-sm text-red-600 font-medium">
                  {(connectMutation.error as any)?.message ||
                    "Warehouse not found"}
                </p>
              </div>
            )}
            {connectMutation.data?.status === "pending" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Connection Pending
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {connectMutation.data.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ STEP 2: BROWSE (Store Grid View) ═══ */}
      {step === "browse" && (
        <div className="space-y-4">
          {/* Banner */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-sm text-blue-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 🏭 Connected
              to: {selectedSlug}
            </span>
            <button
              onClick={() => {
                setStep("connect");
                setSelectedSlug(null);
                setCart([]);
                setSearch("");
                setWarehouseInput("");
                router.replace(buildWarehouseOrderUrl(null));
              }}
              className="text-xs text-blue-500 hover:underline"
            >
              Change warehouse
            </button>
          </div>

          {productsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Unable to open this warehouse
                  </p>
                  <p className="mt-0.5 text-xs text-red-600">
                    {(productsError as Error)?.message ||
                      "This warehouse is not available for ordering right now."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search + Cart count */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setStep("checkout")}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ShoppingCart size={16} /> <span>{cartItemCount} items</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                  ৳{cartTotal.toLocaleString()}
                </span>
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {/* Product Grid */}
            <div className="lg:col-span-3 space-y-6">
              {loadingProducts ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse"
                    >
                      <div className="aspect-[4/3] bg-gray-100" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-3/4" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : rawProducts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Package className="mx-auto text-gray-300 mb-3" size={40} />
                  <p className="text-sm text-gray-500 font-medium">
                    No products available
                  </p>
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
                          key={prod.productId}
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
                    <ShoppingCart
                      className="mx-auto text-gray-200 mb-2"
                      size={32}
                    />
                    <p className="text-xs text-gray-400">
                      Add products to your cart
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {cart.map((item) => (
                        <div
                          key={getCartItemKey(item)}
                          className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                        >
                          {item.productImage && (
                            <Image
                              src={item.productImage}
                              alt=""
                              width={28}
                              height={28}
                              className="w-7 h-7 rounded object-cover shrink-0"
                              unoptimized
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-gray-800 truncate">
                              {item.productName}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {item.modeLabel} • {item.unitLabel} ×{" "}
                              {item.quantity}
                            </div>
                            {item.targetVariantLabel && (
                              <div className="text-[10px] text-blue-500">
                                Target: {item.targetVariantLabel}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[11px] font-semibold">
                              ৳
                              {(
                                Number(item.retailPrice) * item.quantity
                              ).toLocaleString()}
                            </span>
                            <button
                              onClick={() =>
                                removeFromCart(getCartItemKey(item))
                              }
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t font-semibold text-sm">
                      <span>Total</span>
                      <span className="text-emerald-700">
                        ৳{cartTotal.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => setStep("checkout")}
                      className="w-full mt-3 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={14} /> Checkout
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: CHECKOUT ═══ */}
      {step === "checkout" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-800">
            Shipping Details
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="text-xs text-gray-500 font-medium block mb-1">
                Full Name *
              </span>
              <input
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Shop Owner Name"
              />
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium block mb-1">
                Phone *
              </span>
              <input
                value={shippingPhone}
                onChange={(e) => setShippingPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="01XXXXXXXXX"
              />
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium block mb-1">
              Address *
            </span>
            <input
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="Full delivery address"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="text-xs text-gray-500 font-medium block mb-1">
                City *
              </span>
              <input
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Dhaka"
              />
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium block mb-1">
                Note (optional)
              </span>
              <input
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Delivery instructions..."
              />
            </div>
          </div>
          <div className="border-t pt-4 mt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Order Summary
            </h3>
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={getCartItemKey(item)}
                  className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                >
                  {item.productImage && (
                    <Image
                      src={item.productImage}
                      alt=""
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded object-cover"
                      unoptimized
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800 font-medium truncate block">
                      {item.productName}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {item.modeLabel} • {item.unitLabel} × {item.quantity}
                    </span>
                    {item.targetVariantLabel && (
                      <span className="block text-[10px] text-blue-500">
                        Target: {item.targetVariantLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold shrink-0">
                    ৳
                    {(
                      Number(item.retailPrice) * item.quantity
                    ).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-sm pt-2 border-t mt-2">
                <span>Total</span>
                <span className="text-emerald-700">
                  ৳{cartTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          {orderMutation.isError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {(orderMutation.error as any)?.message || "Failed to place order"}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setStep("browse")}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (
                  !shippingName ||
                  !shippingPhone ||
                  !shippingAddress ||
                  !shippingCity
                ) {
                  alert("Please fill in all required shipping fields");
                  return;
                }
                orderMutation.mutate(
                  {
                    warehouseSlug: selectedSlug!,
                    items: cart.map((c) => ({
                      variantId: c.variantId,
                      quantity: c.quantity,
                      fulfillmentMode: c.fulfillmentMode,
                      supplyMode: c.supplyMode,
                      targetVariantId: c.targetVariantId,
                    })),
                    shippingName,
                    shippingPhone,
                    shippingAddress,
                    shippingCity,
                    customerNote: customerNote || undefined,
                  },
                  {
                    onSuccess: (result) => {
                      setOrderResult(result);
                      setStep("success");
                      setCart([]);
                    },
                  },
                );
              }}
              disabled={orderMutation.isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {orderMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Placing
                  Order...
                </>
              ) : (
                <>Place Order — ৳{cartTotal.toLocaleString()}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: SUCCESS ═══ */}
      {step === "success" && orderResult && (
        <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Order Placed Successfully!
          </h2>
          <p className="text-sm text-gray-500 mb-1">{orderResult.message}</p>
          <p className="text-xs text-gray-400 font-mono mb-6">
            Order #{orderResult.order?.orderNumber}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setCart([]);
                setOrderResult(null);
                if (selectedSlug) {
                  setStep("browse");
                  router.replace(buildWarehouseOrderUrl(selectedSlug));
                  return;
                }
                setStep("connect");
                router.replace(buildWarehouseOrderUrl(null));
              }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              New Order
            </button>
            <a
              href="/dashboard/orders"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              View My Orders
            </a>
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
