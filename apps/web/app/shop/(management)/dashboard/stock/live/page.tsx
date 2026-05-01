"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BoxesIcon,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Package,
  PackageX,
  Plus,
  Search,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useRealtimeStock } from "@/hooks/use-shop-owner-api";

// ─── Status Config ─────────────────────────────────────────────

const STATUS_CONFIG = {
  in_stock: { label: "In Stock", color: "border-emerald-200 text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  low: { label: "Low Stock", color: "border-amber-200 text-amber-700 bg-amber-50", dot: "bg-amber-500" },
  out_of_stock: { label: "Out of Stock", color: "border-red-200 text-red-700 bg-red-50", dot: "bg-red-500" },
} as const;

// ─── Main Page ─────────────────────────────────────────────────

export default function StockLivePage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low" | "out_of_stock">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useRealtimeStock({
    search: search || undefined,
    categoryId,
    status: statusFilter,
  });

  const products: any[] = (data as any)?.products ?? [];
  const categories: any[] = (data as any)?.categories ?? [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <BoxesIcon className="text-emerald-600" size={22} />
            </div>
            📦 Stock (Real-time)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Live inventory by product — pack &amp; loose breakdown
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/stock/add">
            <Plus className="mr-2 h-4 w-4" />
            Add Stock
          </Link>
        </Button>
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU, product name, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryId?.toString() ?? "all"}
          onValueChange={(v) => setCategoryId(v === "all" ? undefined : Number(v))}
        >
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[160px]">
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

      {/* ── Loading ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading real-time stock...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <BoxesIcon className="text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 text-lg font-medium">No products found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? "Try adjusting your search or filters." : "Add products to start tracking stock."}
          </p>
        </div>
      ) : (
        /* ── Product Table ── */
        <div className="bg-white border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-gradient-to-r from-gray-50 to-white">
                <TableHead className="w-[40px] py-3" />
                <TableHead className="py-3 font-bold text-gray-700">SKU</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Product Name</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Stock Breakdown</TableHead>
                <TableHead className="text-center py-3 font-bold text-gray-700">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any) => {
                const isExpanded = expandedId === p.productId;
                const sc = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG];

                // Calculate total KG for pack variants
                const totalPackKg = (p.variants || []).reduce((sum: number, v: any) => {
                  const isPack = (v.packType || "").toLowerCase() !== "loose";
                  return sum + (isPack ? v.availableQty * parseFloat(v.weightKg || "0") : 0);
                }, 0);

                return (
                  <>
                    {/* ── Product Row ── */}
                    <TableRow
                      key={p.productId}
                      className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${isExpanded ? "bg-gray-50/80" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : p.productId)}
                    >
                      <TableCell className="py-3 pr-0">
                        <div className="flex items-center justify-center">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {p.sku || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          {p.productImage ? (
                            <img
                              src={p.productImage}
                              alt={p.productName}
                              className="w-8 h-8 rounded-lg object-cover border"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Package className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-semibold text-gray-800">
                              {p.productName}
                            </span>
                            {p.categoryName && (
                              <span className="text-[10px] text-gray-400 ml-2">
                                {p.categoryName}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">
                            {Math.round(p.totalPackQty)} Pack
                            {totalPackKg > 0 && (
                              <span className="text-xs text-gray-400 font-normal ml-1">({Math.round(totalPackKg * 100) / 100} KG)</span>
                            )}
                          </span>
                          <span className="text-gray-300">+</span>
                          <span className="text-sm font-bold text-gray-900 tabular-nums">
                            {Math.round(p.totalLooseQty * 100) / 100} KG Loose
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold gap-1.5 ${sc.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          View
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* ── Expanded Detail ── */}
                    {isExpanded && (
                      <TableRow key={`${p.productId}-detail`} className="bg-gray-50/50">
                        <TableCell colSpan={5} className="p-0">
                          <div className="px-6 py-4 border-t border-gray-100">
                            {/* Product Summary */}
                            <div className="flex items-center gap-3 mb-4">
                              {p.productImage ? (
                                <img
                                  src={p.productImage}
                                  alt={p.productName}
                                  className="w-10 h-10 rounded-lg object-cover border"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-gray-300" />
                                </div>
                              )}
                              <div>
                                <h3 className="text-sm font-bold text-gray-900">
                                  🧾 {p.productName}
                                  {p.sku && (
                                    <span className="text-xs font-mono text-gray-400 ml-2">({p.sku})</span>
                                  )}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  📦 {Math.round(p.totalPackQty)} Pack{totalPackKg > 0 ? ` (${Math.round(totalPackKg * 100) / 100} KG)` : ''} + {Math.round(p.totalLooseQty * 100) / 100} KG Loose
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-bold ml-2 ${sc.color}`}
                                  >
                                    {sc.label}
                                  </Badge>
                                </p>
                              </div>
                            </div>

                            {/* Variant Stock Table */}
                            <div className="mb-4">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <BarChart3 size={12} /> Variant Stock (Pack Level)
                              </h4>
                              <div className="bg-white border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="text-[11px] bg-gray-50">
                                      <TableHead className="py-2 font-bold text-gray-600">Brand · Weight</TableHead>
                                      <TableHead className="py-2 font-bold text-gray-600">Available</TableHead>
                                      <TableHead className="py-2 font-bold text-gray-600">In Carton</TableHead>
                                      <TableHead className="py-2 font-bold text-gray-600">Loose</TableHead>
                                      <TableHead className="text-center py-2 font-bold text-gray-600">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {p.variants.map((v: any) => {
                                      const vStatus =
                                        v.availableQty <= 0 ? "out_of_stock" :
                                        v.availableQty <= 5 ? "low" : "in_stock";
                                      const vs = STATUS_CONFIG[vStatus];

                                      return (
                                        <TableRow key={v.variantId} className="hover:bg-gray-50/50">
                                          <TableCell className="py-2">
                                            <span className="text-sm font-medium text-gray-800">
                                              {v.brandName || "No Brand"} · {(v.packType || "").toLowerCase() === "loose" ? "Loose" : `${v.weightKg}KG`}
                                            </span>
                                            <span className="text-[10px] text-gray-400 ml-1.5">
                                              {(v.packType || "").toLowerCase() === "loose" ? "KG" : v.unitLabel}
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-2 text-sm font-bold text-gray-900 tabular-nums">
                                            {(v.packType || "").toLowerCase() === "loose"
                                              ? `${v.availableQty} KG`
                                              : `${v.availableQty} pcs (${Math.round(v.availableQty * parseFloat(v.weightKg || "0") * 100) / 100} KG)`
                                            }
                                          </TableCell>
                                          <TableCell className="py-2 text-sm text-gray-600 tabular-nums">
                                            {v.inCartonQty > 0 ? `${v.inCartonQty} Pack` : "—"}
                                          </TableCell>
                                          <TableCell className="py-2 text-sm text-gray-600 tabular-nums">
                                            {(v.packType || "").toLowerCase() === "loose"
                                              ? `${Math.round(v.looseQty * 100) / 100} KG`
                                              : v.looseQty > 0 ? `${Math.round(v.looseQty * 100) / 100} pcs` : "—"
                                            }
                                          </TableCell>
                                          <TableCell className="text-center py-2">
                                            <span className={`inline-block w-2 h-2 rounded-full ${vs.dot}`} />
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            {/* Loose Stock Summary */}
                            <div className="mb-4 bg-white border rounded-lg px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Tag size={14} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  Total Loose Stock
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 tabular-nums">
                                  {Math.round(p.totalLooseQty * 100) / 100} KG
                                </span>
                                <span className={`w-2 h-2 rounded-full ${p.totalLooseQty > 0 ? "bg-emerald-500" : "bg-red-500"}`} />
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs h-8 text-gray-400"
                                  disabled
                                >
                                  🔄 Convert Loose → Pack
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs h-8 text-gray-400"
                                  disabled
                                >
                                  🏷 Generate Label
                                </Button>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50/50 text-xs text-gray-500 flex items-center justify-between">
            <span>{(data as any)?.totalCount ?? 0} products</span>
            <span className="text-gray-400">Updates every 30s</span>
          </div>
        </div>
      )}
    </div>
  );
}
