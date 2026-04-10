"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  BoxesIcon,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  Pencil,
  Search,
  Tag,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState, useMemo } from "react";
import { orpc } from "@/utils/orpc";

// ────────────────────────────────────────────────────────────────
// Types & Helpers
// ────────────────────────────────────────────────────────────────

type StockLevel = "in_stock" | "limited" | "low" | "out_of_stock";

function getStockLevel(qty: number): StockLevel {
  if (qty <= 0) return "out_of_stock";
  if (qty <= 5) return "low";
  if (qty <= 20) return "limited";
  return "in_stock";
}

function StockBadge({ level, qty, unit }: { level: StockLevel; qty: number; unit: string }) {
  const formatted = qty.toLocaleString();
  const configs: Record<StockLevel, { emoji: string; text: string; cls: string }> = {
    in_stock: { emoji: "✅", text: "In Stock", cls: "bg-emerald-100 text-emerald-700" },
    limited: { emoji: "⚠", text: "Limited", cls: "bg-amber-100 text-amber-700" },
    low: { emoji: "⚠", text: "Low Stock", cls: "bg-orange-100 text-orange-700" },
    out_of_stock: { emoji: "❌", text: "Out of Stock", cls: "bg-red-100 text-red-600" },
  };
  const c = configs[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className={`font-semibold ${level === "out_of_stock" ? "text-gray-400" : "text-gray-900"}`}>
        {formatted} {unit}
      </span>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.cls}`}>
        {c.emoji} {c.text}
      </span>
    </span>
  );
}

function getMeasurementUnit(packType?: string | null): string {
  const liquidTypes = ["bottle", "can", "jar"];
  if (packType && liquidTypes.includes(packType)) return "L";
  return "kg";
}

// ────────────────────────────────────────────────────────────────
// Grouping Logic
// ────────────────────────────────────────────────────────────────

interface GroupedCategory {
  categoryName: string;
  products: GroupedProduct[];
  totalQty: number;
  reservedQty: number;
}

interface GroupedProduct {
  productId: number;
  productName: string;
  productImage: string;
  totalQty: number;
  reservedQty: number;
  unit: string;
  muShort: string;
  variants: GroupedVariant[];
  packGroups: PackGroup[];
  looseQty: number;
}

interface GroupedVariant {
  inventoryId: number;
  variantId: number;
  label: string;
  qty: number;
  reserved: number;
  unit: string;
  weightKg: number;
  packType: string;
  price: string;
  retailPrice: string;
  sku: string;
  brand: string;
  color: string;
  size: string;
}

interface PackGroup {
  packType: string;
  packLabel: string;
  totalQty: number;
  totalKg: number;
  unit: string;
}

function groupInventory(items: any[]): GroupedCategory[] {
  const catMap = new Map<string, { products: Map<number, { raw: any[]; product: any }> }>();

  for (const item of items) {
    const variant = item.variant;
    if (!variant) continue;
    const product = variant.product;
    if (!product) continue;

    const catName = product.category?.name || "Uncategorized";
    if (!catMap.has(catName)) catMap.set(catName, { products: new Map() });
    const cat = catMap.get(catName)!;

    if (!cat.products.has(product.id)) {
      cat.products.set(product.id, { raw: [], product });
    }
    cat.products.get(product.id)!.raw.push(item);
  }

  const result: GroupedCategory[] = [];

  for (const [catName, catData] of catMap) {
    const products: GroupedProduct[] = [];

    for (const [productId, pData] of catData.products) {
      const product = pData.product;
      const img = product.images?.[0]?.imageUrl || product.images?.[0]?.url || product.image || "";

      let totalQty = 0;
      let reservedQty = 0;
      let looseQty = 0;
      const variants: GroupedVariant[] = [];
      const packMap = new Map<string, PackGroup>();

      // Determine primary unit from first variant
      const firstVariant = pData.raw[0]?.variant;
      const muShort = getMeasurementUnit(firstVariant?.packType);
      const primaryUnit = firstVariant?.unitLabel || "Unit";

      for (const item of pData.raw) {
        const v = item.variant;
        const qty = Number(item.availableQty || 0);
        const reserved = Number(item.reservedQty || 0);
        const wKg = Number(v.weightKg || 0);
        const packType = v.packType || "loose";
        const unit = v.unitLabel || "Unit";

        totalQty += qty;
        reservedQty += reserved;

        // Build variant label
        const parts: string[] = [];
        if (v.brand?.name) parts.push(v.brand.name);
        if (v.color) parts.push(v.color);
        if (v.size) parts.push(v.size);
        if (wKg > 0) parts.push(`${wKg}${muShort}`);
        if (v.packType && v.packType !== "loose") parts.push(v.packType);

        const label = parts.length > 0
          ? parts.join(" + ")
          : v.quantitySelectorLabel || v.sku || `Variant #${v.id}`;

        variants.push({
          inventoryId: item.id,
          variantId: v.id,
          label,
          qty,
          reserved,
          unit,
          weightKg: wKg,
          packType,
          price: v.price,
          retailPrice: item.retailPrice || v.price,
          sku: v.sku || "",
          brand: v.brand?.name || "",
          color: v.color || "",
          size: v.size || "",
        });

        // Pack grouping
        if (packType === "loose") {
          looseQty += qty;
        } else {
          const key = `${packType}-${wKg}`;
          if (!packMap.has(key)) {
            const packLabel = `${wKg > 0 ? wKg + muShort + " " : ""}${packType.charAt(0).toUpperCase() + packType.slice(1)}`;
            packMap.set(key, { packType, packLabel, totalQty: 0, totalKg: 0, unit });
          }
          const pg = packMap.get(key)!;
          pg.totalQty += qty;
          pg.totalKg += qty * wKg;
        }
      }

      products.push({
        productId,
        productName: product.name,
        productImage: img,
        totalQty,
        reservedQty,
        unit: primaryUnit,
        muShort,
        variants: variants.sort((a, b) => b.qty - a.qty),
        packGroups: Array.from(packMap.values()).sort((a, b) => b.totalQty - a.totalQty),
        looseQty,
      });
    }

    const catTotal = products.reduce((s, p) => s + p.totalQty, 0);
    const catReserved = products.reduce((s, p) => s + p.reservedQty, 0);

    result.push({
      categoryName: catName,
      products: products.sort((a, b) => a.productName.localeCompare(b.productName)),
      totalQty: catTotal,
      reservedQty: catReserved,
    });
  }

  return result.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

// ────────────────────────────────────────────────────────────────
// Category Section
// ────────────────────────────────────────────────────────────────

function CategorySection({
  category,
  onEditItem,
  editingId,
}: {
  category: GroupedCategory;
  onEditItem: (inv: GroupedVariant) => void;
  editingId: number | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const level = getStockLevel(category.totalQty);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Category Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <Tag className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-bold text-gray-900">{category.categoryName}</h2>
            <p className="text-xs text-gray-500">
              {category.products.length} {category.products.length === 1 ? "product" : "products"} · {category.totalQty.toLocaleString()} total units
              {category.reservedQty > 0 && ` · ${category.reservedQty.toLocaleString()} reserved`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StockBadge level={level} qty={category.totalQty} unit="units" />
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t divide-y divide-gray-100">
          {category.products.map((product) => (
            <ProductSection
              key={product.productId}
              product={product}
              onEditItem={onEditItem}
              editingId={editingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Product Section (Level 2)
// ────────────────────────────────────────────────────────────────

function ProductSection({
  product,
  onEditItem,
  editingId,
}: {
  product: GroupedProduct;
  onEditItem: (inv: GroupedVariant) => void;
  editingId: number | null;
}) {
  const [showVariants, setShowVariants] = useState(false);

  const level = getStockLevel(product.totalQty);
  const hasMultipleVariants = product.variants.length > 1;

  return (
    <div>
      {/* Product Summary Row */}
      <button
        onClick={() => hasMultipleVariants && setShowVariants(!showVariants)}
        className={`w-full flex items-center justify-between px-4 py-3 ${
          hasMultipleVariants ? "hover:bg-gray-50/50 cursor-pointer" : ""
        } transition-colors`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0">
            {product.productImage ? (
              <Image
                src={product.productImage}
                alt={product.productName}
                width={36}
                height={36}
                className="object-cover w-full h-full"
                unoptimized={product.productImage.startsWith("http")}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{product.productName}</p>
            <p className="text-[11px] text-gray-500">
              {hasMultipleVariants && `${product.variants.length} variants · `}
              {product.reservedQty > 0 && `${product.reservedQty} reserved · `}
              {hasMultipleVariants ? "Tap to expand" : product.variants[0]?.sku || ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StockBadge level={level} qty={product.totalQty} unit={product.unit} />
          {hasMultipleVariants && (
            showVariants ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Variant Detail */}
      {showVariants && hasMultipleVariants && (
        <div className="bg-gray-50/60 border-t">
          {/* Variant List Header */}
          <div className="px-5 py-2 border-b border-gray-200/80">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              📊 Stock — {product.productName} (VARIANT LEVEL)
            </p>
          </div>

          {/* Variant Rows */}
          <div className="divide-y divide-gray-100">
            {product.variants.map((v) => {
              const vLevel = getStockLevel(v.qty);
              return (
                <div
                  key={v.inventoryId}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-white/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{v.label}</span>
                    {v.sku && (
                      <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">{v.sku}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500">৳ {Number(v.retailPrice).toLocaleString()}</span>
                    <StockBadge level={vLevel} qty={v.qty} unit={v.unit} />
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditItem(v); }}
                      className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pack Type Supply Level */}
          {product.packGroups.length > 0 && (
            <div className="border-t border-gray-200/80">
              <div className="px-5 py-2 border-b border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  📦 Pack Type Stock (Supply Level)
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {product.packGroups.map((pg) => (
                  <div key={pg.packLabel} className="flex items-center justify-between px-5 py-2 text-sm">
                    <span className="text-gray-700 font-medium">{pg.packLabel}</span>
                    <span className="text-gray-600">
                      <span className="font-semibold">{pg.totalQty.toLocaleString()} {pg.unit}</span>
                      {pg.totalKg > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({pg.totalKg.toLocaleString()} {product.muShort})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loose / Ready Stock */}
          {product.looseQty > 0 && (
            <div className="border-t border-gray-200/80 px-5 py-2 flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-700 font-medium">📦 Loose / Ready Stock</span>
              </div>
              <span className="text-amber-600 font-medium">
                {product.looseQty.toLocaleString()} {product.muShort} ⚠ Ready to Pack
              </span>
            </div>
          )}
        </div>
      )}

      {/* Single variant — show inline detail */}
      {!hasMultipleVariants && product.variants[0] && (
        <div className="bg-gray-50/40 border-t px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {product.variants[0].brand && `${product.variants[0].brand} · `}
              {product.variants[0].weightKg > 0 && `${product.variants[0].weightKg}${product.muShort} · `}
              {product.variants[0].packType !== "loose" && `${product.variants[0].packType} · `}
              {product.variants[0].sku && `SKU: ${product.variants[0].sku}`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">
                ৳ {Number(product.variants[0].retailPrice).toLocaleString()}
              </span>
              <button
                onClick={() => onEditItem(product.variants[0])}
                className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                title="Edit"
              >
                <Pencil size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────

export default function WarehouseInventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getMyInventory", { search: "", page: 1, limit: 500 }],
    queryFn: () => orpc.warehouse.getMyInventory.call({ search: "", page: 1, limit: 500 }),
  });

  const updateMutation = useMutation({
    mutationFn: (d: { inventoryId: number; retailPrice?: string; availableQty?: string }) =>
      orpc.warehouse.updateInventoryItem.call(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyInventory"] });
      setEditingId(null);
    },
  });

  const allItems = data?.items ?? [];

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return allItems;
    const s = search.toLowerCase();
    return allItems.filter((item: any) =>
      item.variant?.product?.name?.toLowerCase().includes(s) ||
      item.variant?.sku?.toLowerCase().includes(s) ||
      item.variant?.brand?.name?.toLowerCase().includes(s)
    );
  }, [allItems, search]);

  const grouped = useMemo(() => groupInventory(filtered), [filtered]);

  // Stats from ALL items (unfiltered)
  const totalProducts = allItems.length;
  const totalStock = allItems.reduce((sum: number, i: any) => sum + Number(i.availableQty || 0), 0);
  const totalReserved = allItems.reduce((sum: number, i: any) => sum + Number(i.reservedQty || 0), 0);
  const lowStockCount = allItems.filter((i: any) => {
    const q = Number(i.availableQty || 0);
    return q > 0 && q <= 5;
  }).length;
  const outOfStockCount = allItems.filter((i: any) => Number(i.availableQty || 0) === 0).length;

  const handleEditItem = (v: GroupedVariant) => {
    setEditingId(v.inventoryId);
    setEditPrice(v.retailPrice || "0");
    setEditQty(String(v.qty));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BoxesIcon className="text-amber-600" size={24} />
          Stock Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Warehouse inventory grouped by category and product
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Products" value={totalProducts} />
        <StatCard label="Total Stock" value={totalStock} />
        <StatCard label="Reserved" value={totalReserved} color="blue" />
        <StatCard label="Low Stock" value={lowStockCount} color="amber" />
        <StatCard label="Out of Stock" value={outOfStockCount} color="red" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by product, SKU, or brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
      </div>

      {/* Edit Bar */}
      {editingId !== null && (
        <div className="sticky top-0 z-10 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3 shadow-sm">
          <Pencil size={14} className="text-amber-600 shrink-0" />
          <span className="text-sm font-medium text-amber-800">Editing:</span>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-gray-600">Price:</label>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="w-28 px-2 py-1 text-sm border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
            />
            <label className="text-xs text-gray-600 ml-2">Qty:</label>
            <input
              type="number"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
              className="w-24 px-2 py-1 text-sm border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
            />
          </div>
          <button
            onClick={() =>
              updateMutation.mutate({
                inventoryId: editingId,
                retailPrice: editPrice,
                availableQty: editQty,
              })
            }
            disabled={updateMutation.isPending}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
            title="Save"
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse space-y-3">
              <div className="h-6 w-40 bg-gray-100 rounded" />
              <div className="h-12 w-full bg-gray-100 rounded" />
              <div className="h-12 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-gray-50/50">
          <BoxesIcon className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">No inventory items</p>
          <p className="text-sm text-gray-400 mt-1">
            Go to{" "}
            <a href="/warehouse/dashboard/products" className="text-amber-600 underline font-medium">
              Products
            </a>{" "}
            to add products to your inventory.
          </p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border rounded-xl bg-gray-50/50">
          No results for "{search}"
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((cat) => (
            <CategorySection
              key={cat.categoryName}
              category={cat}
              onEditItem={handleEditItem}
              editingId={editingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Stat Card
// ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "amber" | "red" | "blue";
}) {
  const borderColor = color === "red"
    ? "border-red-200 bg-red-50/50"
    : color === "amber"
    ? "border-amber-200 bg-amber-50/50"
    : color === "blue"
    ? "border-blue-200 bg-blue-50/50"
    : "border-gray-200 bg-white";

  const textColor = color === "red"
    ? "text-red-600"
    : color === "amber"
    ? "text-amber-600"
    : color === "blue"
    ? "text-blue-600"
    : "text-gray-900";

  const labelColor = color === "red"
    ? "text-red-500"
    : color === "amber"
    ? "text-amber-500"
    : color === "blue"
    ? "text-blue-500"
    : "text-gray-400";

  return (
    <div className={`border rounded-lg px-4 py-3 ${borderColor}`}>
      <div className={`text-xs uppercase font-semibold ${labelColor}`}>{label}</div>
      <div className={`text-2xl font-bold mt-1 ${textColor}`}>{value.toLocaleString()}</div>
    </div>
  );
}
