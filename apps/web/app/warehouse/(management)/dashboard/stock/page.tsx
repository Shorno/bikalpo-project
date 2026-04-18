"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BoxesIcon,
  ChevronDown,
  ChevronRight,
  Droplets,
  Package,
  Search,
  Tag,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

/* ─── Stock status badge ─── */
function StatusBadge({ badge }: { badge: string }) {
  const map: Record<string, { bg: string; text: string; border: string; icon: boolean; label: string }> = {
    in_stock: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", icon: false, label: "In Stock" },
    limited: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", icon: true, label: "Limited" },
    low: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", icon: true, label: "Low" },
    out_of_stock: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", icon: true, label: "Out of Stock" },
  };
  const s = map[badge] || map.in_stock;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 ${s.bg} ${s.text} border ${s.border} rounded-full font-semibold whitespace-nowrap`}>
      {s.icon && <AlertTriangle size={10} />}
      {s.label}
    </span>
  );
}

/* ─── Level 2: Variant × Brand breakdown ─── */
function StockBreakdown({ productId, ownerType }: { productId: number; ownerType: "warehouse" | "shop" | "super_seller" }) {
  const { data, isLoading } = useQuery({
    queryKey: ["stockOverview", "breakdown", productId, ownerType],
    queryFn: () => orpc.stockOverview.getStockBreakdown.call({ productId, ownerType }),
  });

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-gray-400 animate-pulse">
        Loading breakdown…
      </div>
    );
  }

  const groups = data?.variantGroups ?? [];
  const loosePool = data?.loosePool;

  if (groups.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-400">
        No variant details available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group, gi) => {
        const isLoose = group.packType === "loose";
        const groupTotal = group.items.reduce((s, i) => s + i.availableQty, 0);
        return (
          <div key={gi} className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
            {/* Group header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100/70">
              <div className="flex items-center gap-2">
                {isLoose ? (
                  <Droplets size={14} className="text-blue-500" />
                ) : (
                  <Package size={14} className="text-amber-600" />
                )}
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  {isLoose
                    ? "Loose / Open"
                    : group.unitLabel}
                </span>
                {!isLoose && group.innerPackSizeKg && (
                  <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                    {group.innerPackSizeKg}kg × {group.packCountInside || Math.floor(parseFloat(group.weightKg) / parseFloat(group.innerPackSizeKg))} pcs inside
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {groupTotal.toLocaleString()} {isLoose ? "KG" : "pcs"}
              </span>
            </div>

            {/* Items within this variant group */}
            <div className="divide-y divide-gray-100">
              {group.items.map((item, ii) => (
                <div key={ii} className="flex items-center justify-between px-4 py-2 hover:bg-white transition-colors">
                  <div className="flex items-center gap-2">
                    {item.brand ? (
                      <>
                        <Tag size={12} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-800">{item.brand.name}</span>
                      </>
                    ) : item.color || item.size ? (
                      <>
                        {item.color && (
                          <span
                            className="w-3 h-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: item.color.toLowerCase() }}
                          />
                        )}
                        <span className="text-sm font-medium text-gray-800">
                          {[item.color, item.size].filter(Boolean).join(" / ")}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">General</span>
                    )}
                    {item.sku && (
                      <span className="text-[10px] text-gray-400 font-mono">{item.sku}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold tabular-nums ${
                      item.availableQty <= 0 ? "text-red-500" :
                      item.status.badge === "low" ? "text-orange-600" :
                      item.status.badge === "limited" ? "text-amber-600" :
                      "text-gray-900"
                    }`}>
                      {item.availableQty.toLocaleString()}
                    </span>
                    <StatusBadge badge={item.status.badge} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Loose pool summary */}
      {loosePool && (loosePool.openStock > 0 || loosePool.fullDrum > 0) && (
        <div className="bg-blue-50 rounded-lg border border-blue-100 px-4 py-3">
          <div className="text-xs font-bold text-blue-700 uppercase mb-2">Loose Pool Summary</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-blue-500 uppercase font-semibold">Open Stock</div>
              <div className="text-lg font-bold text-blue-800">{loosePool.openStock.toLocaleString()} KG</div>
            </div>
            <div>
              <div className="text-[10px] text-blue-500 uppercase font-semibold">Full Drum</div>
              <div className="text-lg font-bold text-blue-800">{loosePool.fullDrum.toLocaleString()} KG</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Types for grouped products ─── */
type ProductOverview = {
  productId: number;
  productName: string;
  productSlug: string;
  productImage: string | null;
  category: string | null;
  subCategory: string | null;
  brandId: number | null;
  brandName: string | null;
  totalQty: number;
  totalWeightKg: number;
  unitSizeKg: number;
  cartonCount: number;
  remainderKg: number;
  variantCount: number;
  primaryUnit: string;
  status: { label: string; badge: string };
};

type CoreProductGroup = {
  name: string;
  category: string | null;
  image: string | null;
  unitSizeKg: number;
  products: ProductOverview[];
  // Aggregated totals across all brands
  totalQty: number;
  totalWeightKg: number;
  totalVariants: number;
  cartonCount: number;
  remainderKg: number;
  primaryUnit: string;
  worstBadge: string;
};

/** Group products by name+category → core product groups */
function groupByCoreProduct(products: ProductOverview[]): CoreProductGroup[] {
  const map = new Map<string, CoreProductGroup>();

  for (const p of products) {
    const key = `${p.productName}__${p.category || ""}`;
    if (!map.has(key)) {
      map.set(key, {
        name: p.productName,
        category: p.category,
        image: p.productImage,
        unitSizeKg: p.unitSizeKg,
        products: [],
        totalQty: 0,
        totalWeightKg: 0,
        totalVariants: 0,
        cartonCount: 0,
        remainderKg: 0,
        primaryUnit: p.primaryUnit,
        worstBadge: "in_stock",
      });
    }
    const group = map.get(key)!;
    group.products.push(p);
    group.totalQty += p.totalQty;
    group.totalWeightKg += p.totalWeightKg;
    group.totalVariants += p.variantCount;
    // Use image from first product that has one
    if (!group.image && p.productImage) group.image = p.productImage;
    // Recalculate carton from aggregated weight
    if (group.unitSizeKg > 0) {
      group.cartonCount = Math.floor(group.totalWeightKg / group.unitSizeKg);
      group.remainderKg = group.totalWeightKg % group.unitSizeKg;
    }
    // Worst status wins
    const badgePriority: Record<string, number> = { out_of_stock: 3, low: 2, limited: 1, in_stock: 0 };
    if ((badgePriority[p.status.badge] ?? 0) > (badgePriority[group.worstBadge] ?? 0)) {
      group.worstBadge = p.status.badge;
    }
  }

  return Array.from(map.values());
}

/* ─── Brand sub-entry inside a core product group ─── */
function BrandProductEntry({
  product,
  isExpanded,
  onToggle,
  ownerType,
}: {
  product: ProductOverview;
  isExpanded: boolean;
  onToggle: () => void;
  ownerType: "warehouse" | "shop" | "super_seller";
}) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50/50 transition-colors"
      >
        {/* Brand tag */}
        <div className="shrink-0">
          <Tag size={12} className="text-gray-400" />
        </div>

        {/* Brand product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800 truncate">
              {product.brandName || product.productName}
            </span>
            {product.subCategory && (
              <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {product.subCategory}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Stock */}
        <div className="text-right shrink-0">
          {product.unitSizeKg > 0 ? (
            <>
              <div className={`text-sm font-bold tabular-nums ${
                product.status.badge === "out_of_stock" ? "text-red-500" :
                product.status.badge === "low" ? "text-orange-600" :
                "text-gray-900"
              }`}>
                {product.cartonCount.toLocaleString()}
              </div>
              <div className="text-[9px] text-gray-400 uppercase">
                {product.unitSizeKg}KG Carton
              </div>
              <div className="text-[8px] text-gray-300">
                {product.totalWeightKg.toLocaleString()}KG total
                {product.remainderKg > 0 && ` + ${product.remainderKg.toFixed(1)}KG`}
              </div>
            </>
          ) : (
            <>
              <div className={`text-sm font-bold tabular-nums ${
                product.status.badge === "out_of_stock" ? "text-red-500" :
                product.status.badge === "low" ? "text-orange-600" :
                "text-gray-900"
              }`}>
                {product.totalQty.toLocaleString()}
              </div>
              <div className="text-[9px] text-gray-400 uppercase">{product.primaryUnit}</div>
            </>
          )}
        </div>

        <div className="shrink-0">
          <StatusBadge badge={product.status.badge} />
        </div>

        <div className="shrink-0 text-gray-400">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50/30">
          <StockBreakdown productId={product.productId} ownerType={ownerType} />
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─── */
export default function StockOverviewPage() {
  const ownerType = "warehouse" as const;
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");

  // Fetch categories
  const { data: catData } = useQuery({
    queryKey: ["stockOverview", "categories", ownerType],
    queryFn: () => orpc.stockOverview.getStockCategories.call({ ownerType }),
  });

  // Fetch stock overview
  const { data: overviewData, isLoading } = useQuery({
    queryKey: ["stockOverview", "overview", ownerType, selectedCategory],
    queryFn: () =>
      orpc.stockOverview.getStockOverview.call({
        ownerType,
        categoryId: selectedCategory,
      }),
  });

  const categories = catData?.categories ?? [];
  const allProducts = (overviewData?.products ?? []) as ProductOverview[];

  // Client-side search filter
  const filteredProducts = search.trim()
    ? allProducts.filter((p) =>
        p.productName.toLowerCase().includes(search.toLowerCase())
      )
    : allProducts;

  // Group by core product name
  const coreGroups = groupByCoreProduct(filteredProducts);

  // Aggregate stats across all products (not groups)
  const totalUniqueProducts = coreGroups.length;
  const totalBrandProducts = filteredProducts.length;
  const totalStock = filteredProducts.reduce((s, p) => s + p.totalQty, 0);
  const outOfStockCount = filteredProducts.filter((p) => p.status.badge === "out_of_stock").length;
  const lowStockCount = filteredProducts.filter(
    (p) => p.status.badge === "low" || p.status.badge === "limited"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BoxesIcon className="text-amber-600" size={24} />
          Stock Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Hierarchical view of your warehouse stock by product and variant
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400 uppercase font-semibold">Products</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{totalUniqueProducts}</div>
          {totalBrandProducts > totalUniqueProducts && (
            <div className="text-[10px] text-gray-400">{totalBrandProducts} brand entries</div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400 uppercase font-semibold">Total Stock</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{totalStock.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-lg px-4 py-3 bg-amber-50/50">
          <div className="text-xs text-amber-600 uppercase font-semibold">Low / Limited</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{lowStockCount}</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg px-4 py-3 bg-red-50/50">
          <div className="text-xs text-red-500 uppercase font-semibold">Out of Stock</div>
          <div className="text-2xl font-bold text-red-500 mt-1">{outOfStockCount}</div>
        </div>
      </div>

      {/* Category filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2 flex-1">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              !selectedCategory
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id)
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                selectedCategory === cat.id
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
              }`}
            >
              {cat.name} ({cat.productCount})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      {/* Core product cards */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm animate-pulse">
          Loading stock overview…
        </div>
      ) : coreGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-gray-50/50">
          <BoxesIcon className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">No stock found</p>
          <p className="text-sm text-gray-400 mt-1">
            Add products to your inventory to see the stock overview.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {coreGroups.map((group) => {
            const groupKey = `${group.name}__${group.category || ""}`;
            const isMultiBrand = group.products.length > 1;
            const isGroupExpanded = expandedGroup === groupKey;

            // Single-brand product — render exactly as before (flat, no nesting)
            if (!isMultiBrand) {
              const p = group.products[0]!;
              const isExpanded = expandedProduct === p.productId;
              return (
                <div
                  key={p.productId}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-sm"
                >
                  <button
                    onClick={() =>
                      setExpandedProduct(isExpanded ? null : p.productId)
                    }
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                      {p.productImage ? (
                        <Image
                          src={p.productImage}
                          alt={p.productName}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-cover"
                        />
                      ) : (
                        <Package size={20} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {p.productName}
                        </span>
                        {p.subCategory && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {p.subCategory}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {p.category} • {p.variantCount} variant{p.variantCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {p.unitSizeKg > 0 ? (
                        <>
                          <div className={`text-lg font-bold tabular-nums ${
                            p.status.badge === "out_of_stock" ? "text-red-500" :
                            p.status.badge === "low" ? "text-orange-600" :
                            "text-gray-900"
                          }`}>
                            {p.cartonCount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase">
                            {p.unitSizeKg}KG Carton
                          </div>
                          <div className="text-[9px] text-gray-300">
                            {p.totalWeightKg.toLocaleString()}KG total
                            {p.remainderKg > 0 && ` + ${p.remainderKg.toFixed(1)}KG`}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`text-lg font-bold tabular-nums ${
                            p.status.badge === "out_of_stock" ? "text-red-500" :
                            p.status.badge === "low" ? "text-orange-600" :
                            "text-gray-900"
                          }`}>
                            {p.totalQty.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase">{p.primaryUnit}</div>
                        </>
                      )}
                    </div>
                    <div className="shrink-0">
                      <StatusBadge badge={p.status.badge} />
                    </div>
                    <div className="shrink-0 text-gray-400">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/30">
                      <StockBreakdown productId={p.productId} ownerType={ownerType} />
                    </div>
                  )}
                </div>
              );
            }

            // Multi-brand product — grouped parent card
            return (
              <div
                key={groupKey}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-sm"
              >
                {/* Parent card header */}
                <button
                  onClick={() =>
                    setExpandedGroup(isGroupExpanded ? null : groupKey)
                  }
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
                >
                  {/* Product image */}
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    {group.image ? (
                      <Image
                        src={group.image}
                        alt={group.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 object-cover"
                      />
                    ) : (
                      <Package size={20} className="text-gray-400" />
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">
                        {group.name}
                      </span>
                      <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full font-medium border border-indigo-100">
                        {group.products.length} brands
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {group.category} • {group.totalVariants} variant{group.totalVariants !== 1 ? "s" : ""} total
                    </div>
                  </div>

                  {/* Stock total (aggregated) */}
                  <div className="text-right shrink-0">
                    {group.unitSizeKg > 0 ? (
                      <>
                        <div className={`text-lg font-bold tabular-nums ${
                          group.worstBadge === "out_of_stock" ? "text-red-500" :
                          group.worstBadge === "low" ? "text-orange-600" :
                          "text-gray-900"
                        }`}>
                          {group.cartonCount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase">
                          {group.unitSizeKg}KG Carton
                        </div>
                        <div className="text-[9px] text-gray-300">
                          {group.totalWeightKg.toLocaleString()}KG total
                          {group.remainderKg > 0 && ` + ${group.remainderKg.toFixed(1)}KG`}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={`text-lg font-bold tabular-nums ${
                          group.worstBadge === "out_of_stock" ? "text-red-500" :
                          group.worstBadge === "low" ? "text-orange-600" :
                          "text-gray-900"
                        }`}>
                          {group.totalQty.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase">{group.primaryUnit}</div>
                      </>
                    )}
                  </div>

                  {/* Worst status badge */}
                  <div className="shrink-0">
                    <StatusBadge badge={group.worstBadge} />
                  </div>

                  {/* Expand chevron */}
                  <div className="shrink-0 text-gray-400">
                    {isGroupExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {/* Expanded: brand sub-entries */}
                {isGroupExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/30 space-y-2">
                    {group.products.map((p) => (
                      <BrandProductEntry
                        key={p.productId}
                        product={p}
                        isExpanded={expandedProduct === p.productId}
                        onToggle={() =>
                          setExpandedProduct(expandedProduct === p.productId ? null : p.productId)
                        }
                        ownerType={ownerType}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
