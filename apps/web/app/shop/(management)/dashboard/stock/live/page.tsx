"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BoxesIcon,
  ChevronDown,
  ChevronRight,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  ArrowRightLeft,
  Printer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRealtimeStock } from "@/hooks/use-shop-owner-api";

// ─── Status Config ─────────────────────────────────────────────

const STATUS_CONFIG = {
  in_stock: { label: "In Stock", color: "border-emerald-200 text-emerald-700 bg-emerald-50", dot: "bg-emerald-500", dotRing: "ring-emerald-200" },
  low: { label: "Low Stock", color: "border-amber-200 text-amber-700 bg-amber-50", dot: "bg-amber-500", dotRing: "ring-amber-200" },
  out_of_stock: { label: "Out of Stock", color: "border-red-200 text-red-700 bg-red-50", dot: "bg-red-500", dotRing: "ring-red-200" },
} as const;

// ─── Main Page ─────────────────────────────────────────────────

export default function StockLivePage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low" | "out_of_stock">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const { data, isLoading } = useRealtimeStock({
    search: search || undefined,
    categoryId,
    status: statusFilter,
  });

  const products: any[] = (data as any)?.products ?? [];
  const categories: any[] = (data as any)?.categories ?? [];

  return (
    <div className="space-y-3 max-w-5xl">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-lg">
            <BoxesIcon className="text-emerald-600" size={16} />
          </div>
          📦 Stock (Real-time)
          <span className="text-[10px] text-gray-400 font-normal ml-1">Live inventory</span>
        </h1>
        <Button asChild size="sm" className="h-7 text-xs">
          <Link href="/dashboard/stock/add">
            <Plus className="mr-1 h-3 w-3" />
            Add Stock
          </Link>
        </Button>
      </div>

      {/* ── SEARCH / FILTERS (inline, compact) ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="SKU / Product Name / Brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select
          value={categoryId?.toString() ?? "all"}
          onValueChange={(v) => setCategoryId(v === "all" ? undefined : Number(v))}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id.toString()}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v: any) => setStatusFilter(v)}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">🟢 In Stock</SelectItem>
            <SelectItem value="low">🟡 Low Stock</SelectItem>
            <SelectItem value="out_of_stock">🔴 Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ════════════════════════════════════════════════════════
          PRODUCT TABLE
          ════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border rounded-xl">
          <div className="w-7 h-7 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3" />
          <p className="text-xs text-gray-500">Loading real-time stock...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed rounded-xl">
          <BoxesIcon className="text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 text-base font-medium">No products found</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {search ? "Try adjusting your search or filters." : "Add products to start tracking stock."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[32px_minmax(80px,0.8fr)_minmax(160px,2fr)_minmax(120px,1fr)_60px] bg-gray-50 border-b text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <div className="py-2 px-1" />
            <div className="py-2 px-2">SKU</div>
            <div className="py-2 px-2">Product Name</div>
            <div className="py-2 px-2">Stock Breakdown</div>
            <div className="py-2 px-2 text-center">Action</div>
          </div>

          {/* Product Rows */}
          <div className="divide-y divide-gray-100">
            {products.map((p: any) => {
              const isExpanded = expandedId === p.productId;
              const sc = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG];

              // Aggregate packs + loose across variants
              const totalPackKg = (p.variants || []).reduce((sum: number, v: any) => {
                const isPack = (v.packType || "").toLowerCase() !== "loose";
                return sum + (isPack ? v.availableQty * parseFloat(v.weightKg || "0") : 0);
              }, 0);

              return (
                <div key={p.productId}>
                  {/* ── Product Row ── */}
                  <div
                    className={`grid grid-cols-[32px_minmax(80px,0.8fr)_minmax(160px,2fr)_minmax(120px,1fr)_60px] items-center cursor-pointer transition-colors hover:bg-gray-50/80 ${isExpanded ? "bg-gray-50" : ""}`}
                    onClick={() => {
                      setExpandedId(isExpanded ? null : p.productId);
                      setSelectedVariantId(null);
                    }}
                  >
                    {/* Chevron */}
                    <div className="flex items-center justify-center py-2.5">
                      {isExpanded ? (
                        <ChevronDown size={13} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={13} className="text-gray-400" />
                      )}
                    </div>

                    {/* SKU */}
                    <div className="py-2.5 px-2">
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {p.sku || "—"}
                      </span>
                    </div>

                    {/* Product Name */}
                    <div className="py-2.5 px-2 flex items-center gap-2">
                      {p.productImage ? (
                        <img
                          src={p.productImage}
                          alt={p.productName}
                          className="w-7 h-7 rounded-md object-cover border flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-3.5 w-3.5 text-gray-300" />
                        </div>
                      )}
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {p.productName}
                      </span>
                    </div>

                    {/* Stock Breakdown */}
                    <div className="py-2.5 px-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 tabular-nums">
                          {Math.round(p.totalPackQty)} Pack
                        </span>
                        <span className="text-gray-300 text-[10px]">·</span>
                        <span className="text-xs font-bold text-gray-900 tabular-nums">
                          {Math.round(p.totalLooseQty * 100) / 100} KG Loose
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="py-2.5 px-2 flex justify-center">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sc.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        View
                      </span>
                    </div>
                  </div>

                  {/* ── Expanded Detail ── */}
                  {isExpanded && (
                    <ExpandedProductDetail
                      product={p}
                      selectedVariantId={selectedVariantId}
                      onSelectVariant={setSelectedVariantId}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t bg-gray-50/50 text-[10px] text-gray-500 flex items-center justify-between">
            <span>{(data as any)?.totalCount ?? 0} products</span>
            <span className="text-gray-400">Updates every 30s</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXPANDED PRODUCT DETAIL
// ═══════════════════════════════════════════════════════════════

function ExpandedProductDetail({
  product: p,
  selectedVariantId,
  onSelectVariant,
}: {
  product: any;
  selectedVariantId: number | null;
  onSelectVariant: (id: number | null) => void;
}) {
  const sc = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG];

  // Split variants into pack and loose
  const packVariants = (p.variants || []).filter((v: any) => (v.packType || "").toLowerCase() !== "loose");
  const looseVariants = (p.variants || []).filter((v: any) => (v.packType || "").toLowerCase() === "loose");

  const selectedVariant = selectedVariantId
    ? (p.variants || []).find((v: any) => v.variantId === selectedVariantId)
    : null;

  // Total loose across all loose variants
  const totalLooseKg = looseVariants.reduce((sum: number, v: any) => sum + v.availableQty, 0);

  return (
    <div className="bg-gray-50/80 border-t border-gray-100">
      <div className="px-5 py-5 space-y-5">
        {/* ── Product Header ── */}
        <div className="flex items-center gap-3">
          {p.productImage ? (
            <img src={p.productImage} alt={p.productName} className="w-10 h-10 rounded-lg object-cover border" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-gray-300" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              🧾 {p.productName}
              {p.sku && <span className="text-[10px] font-mono text-gray-400">({p.sku})</span>}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              Core Identity Level Stock
            </p>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className={`text-[10px] font-bold ${sc.color}`}>
              {sc.label}
            </Badge>
          </div>
        </div>

        {/* ── Summary Stats ── */}
        <div className="flex items-center gap-3 text-sm">
          <div className="bg-white border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-gray-400 text-xs">📦</span>
            <span className="font-bold text-gray-900">{Math.round(p.totalPackQty)} Pack</span>
          </div>
          <span className="text-gray-300">+</span>
          <div className="bg-white border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-gray-400 text-xs">🏷️</span>
            <span className="font-bold text-gray-900">{Math.round(p.totalLooseQty * 100) / 100} KG Loose</span>
          </div>
        </div>

        {/* ── Variant Stock Table (Pack Level) ── */}
        {packVariants.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <BarChart3 size={11} /> Variant Stock (Pack Level)
            </h4>
            <div className="bg-white border rounded-lg overflow-hidden divide-y divide-gray-50">
              {packVariants.map((v: any) => {
                const vStatus = v.availableQty <= 0 ? "out_of_stock" : v.availableQty <= 5 ? "low" : "in_stock";
                const vs = STATUS_CONFIG[vStatus];
                const isSelected = selectedVariantId === v.variantId;

                return (
                  <div
                    key={v.variantId}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/60 border-l-2 border-l-blue-500" : "hover:bg-gray-50/50 border-l-2 border-l-transparent"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVariant(isSelected ? null : v.variantId);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-gray-800">
                        {v.brandName || "No Brand"} + {v.weightKg}KG
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-bold text-gray-900 tabular-nums">
                        → {v.availableQty} Pack
                      </span>
                      <span className={`w-2 h-2 rounded-full ring-2 ${vs.dot} ${vs.dotRing}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Loose Stock ── */}
        <div>
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Tag size={11} /> Loose Stock
          </h4>
          <div className="bg-white border rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">Available Loose</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 tabular-nums">
                → {Math.round(totalLooseKg * 100) / 100} KG
              </span>
              <span className={`w-2 h-2 rounded-full ring-2 ${totalLooseKg > 0 ? "bg-emerald-500 ring-emerald-200" : "bg-red-500 ring-red-200"}`} />
            </div>
          </div>
        </div>

        {/* ── Selected Variant ── */}
        {selectedVariant && (
          <div>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <BarChart3 size={11} /> Selected Variant
            </h4>
            <div className="bg-white border border-blue-200 rounded-lg px-4 py-3 space-y-2">
              <p className="text-sm font-bold text-blue-900">
                Selected: {selectedVariant.brandName || "No Brand"} + {selectedVariant.weightKg}KG
                {(selectedVariant.packType || "").toLowerCase() === "loose" ? " / Loose" : ""}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-blue-50/50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-blue-400 font-medium uppercase">Available</p>
                  <p className="font-bold text-blue-900 mt-0.5">
                    → {selectedVariant.availableQty} {(selectedVariant.packType || "").toLowerCase() === "loose" ? "KG" : "Pack"}
                  </p>
                </div>
                <div className="bg-blue-50/50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-blue-400 font-medium uppercase">Loose Available</p>
                  <p className="font-bold text-blue-900 mt-0.5">
                    → +{Math.round(totalLooseKg * 100) / 100} KG
                  </p>
                </div>
              </div>
              <div className="pt-1 border-t border-blue-100 mt-2">
                <p className="text-xs text-gray-500">
                  MOQ: <span className="font-bold text-gray-800">1 Pack</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div>
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            ⚙ Quick Actions
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
              <Link href={`/dashboard/sales?product=${p.productId}`}>
                <ShoppingCart size={12} /> Sell Now
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
              <Link href={`/dashboard/stock/add?product=${p.productId}`}>
                <Plus size={12} /> Add Stock
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-gray-400" disabled>
              <Printer size={12} /> Generate Label
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-gray-400" disabled>
              <ArrowRightLeft size={12} /> Convert Loose → Pack
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
