"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BoxesIcon,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Layers,
  Package,
  PackageX,
  Plus,
  Search,
  ShieldAlert,
  ShoppingCart,
  Snail,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useMyRetailProducts, useStockOverview } from "@/hooks/use-shop-owner-api";

// ─── KPI Card ──────────────────────────────────────────────────

function KPICard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = "default",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: "default" | "amber" | "emerald" | "blue" | "red" | "purple" | "orange";
}) {
  const colors = {
    default: {
      bg: "bg-white border-gray-200",
      icon: "bg-gray-100 text-gray-600",
      val: "text-gray-900",
      lbl: "text-gray-500",
    },
    amber: {
      bg: "bg-amber-50/50 border-amber-200",
      icon: "bg-amber-100 text-amber-600",
      val: "text-amber-700",
      lbl: "text-amber-500",
    },
    emerald: {
      bg: "bg-emerald-50/50 border-emerald-200",
      icon: "bg-emerald-100 text-emerald-600",
      val: "text-emerald-700",
      lbl: "text-emerald-500",
    },
    blue: {
      bg: "bg-blue-50/50 border-blue-200",
      icon: "bg-blue-100 text-blue-600",
      val: "text-blue-700",
      lbl: "text-blue-500",
    },
    red: {
      bg: "bg-red-50/50 border-red-200",
      icon: "bg-red-100 text-red-600",
      val: "text-red-700",
      lbl: "text-red-500",
    },
    purple: {
      bg: "bg-purple-50/50 border-purple-200",
      icon: "bg-purple-100 text-purple-600",
      val: "text-purple-700",
      lbl: "text-purple-500",
    },
    orange: {
      bg: "bg-orange-50/50 border-orange-200",
      icon: "bg-orange-100 text-orange-600",
      val: "text-orange-700",
      lbl: "text-orange-500",
    },
  };
  const c = colors[color];

  return (
    <div className={`border rounded-xl p-4 transition-shadow hover:shadow-sm ${c.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${c.icon}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className={`text-2xl font-bold ${c.val} tabular-nums`}>{value}</div>
          <div className={`text-xs font-medium ${c.lbl}`}>{label}</div>
          {subtitle && (
            <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  emoji,
  action,
}: {
  icon: React.ElementType;
  title: string;
  emoji: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-gray-100 rounded-lg">
          <Icon size={14} className="text-gray-600" />
        </div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          {emoji} {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function StockPage() {
  const [search, setSearch] = useState("");
  const [showTable, setShowTable] = useState(false);

  const { data: overview, isLoading: overviewLoading } = useStockOverview();
  const { data: retailData, isLoading: retailLoading } = useMyRetailProducts({ search, limit: 50 });

  const items: any[] = (retailData as any)?.items ?? [];

  // Resolve brand
  const resolveBrand = (item: any) => {
    const v = item.variant;
    if (v?.brand?.name) return v.brand.name;
    const p = v?.product;
    if (p?.brand?.name) return p.brand.name;
    const pb = p?.productBrands?.[0]?.brand;
    if (pb?.name) return pb.name;
    return null;
  };

  if (overviewLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <BarChart3 className="text-blue-600" size={22} />
            </div>
            📦 Stock Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">Loading your stock dashboard...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading stock data...</p>
        </div>
      </div>
    );
  }

  const ov = overview as any;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <BarChart3 className="text-blue-600" size={22} />
            </div>
            📦 Stock Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete inventory position at a glance
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/stock/add">
            <Plus className="mr-2 h-4 w-4" />
            Add Stock
          </Link>
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 MAIN KPIs — STOCK POSITION
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={TrendingUp} title="Stock Position" emoji="📊" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard
            label="Total Products"
            value={ov?.totalProducts?.toLocaleString() ?? "0"}
            subtitle="Unique items in store"
            icon={Package}
            color="blue"
          />
          <KPICard
            label="Total Stock Value"
            value={`৳${(ov?.totalStockValue ?? 0).toLocaleString("en-IN")}`}
            subtitle="Based on retail price"
            icon={Tag}
            color="emerald"
          />
          <KPICard
            label="Total SKUs"
            value={ov?.totalSKUs?.toLocaleString() ?? "0"}
            subtitle="Variant-level inventory"
            icon={Layers}
            color="purple"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 STOCK STATUS
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={CheckCircle2} title="Stock Status" emoji="📊" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard
            label="In Stock"
            value={ov?.inStockCount?.toLocaleString() ?? "0"}
            subtitle="More than 5 units"
            icon={CheckCircle2}
            color="emerald"
          />
          <KPICard
            label="Low Stock"
            value={ov?.lowStockCount?.toLocaleString() ?? "0"}
            subtitle="≤ 5 units remaining"
            icon={AlertTriangle}
            color="orange"
          />
          <KPICard
            label="Out of Stock"
            value={ov?.outOfStockCount?.toLocaleString() ?? "0"}
            subtitle="0 units available"
            icon={PackageX}
            color="red"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 CATEGORY SNAPSHOT
          ══════════════════════════════════════════════════════════════ */}
      {ov?.categorySnapshot?.length > 0 && (
        <div>
          <SectionHeader icon={BoxesIcon} title="Category Snapshot" emoji="📊" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ov.categorySnapshot.map((cat: any) => (
              <div
                key={cat.categoryName}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
              >
                <div className="text-sm font-semibold text-gray-800 truncate">
                  {cat.categoryName}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-gray-900 tabular-nums">
                    {cat.totalQty.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">{cat.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ⚠ ALERT SUMMARY
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={AlertTriangle} title="Alert Summary" emoji="⚠" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard
            label="Low Stock"
            value={ov?.alerts?.lowStock ?? 0}
            subtitle="Products running low"
            icon={AlertTriangle}
            color="orange"
          />
          <KPICard
            label="Expiring Soon"
            value={ov?.alerts?.expiringSoon ?? 0}
            subtitle="Coming soon"
            icon={Clock}
            color="amber"
          />
          <KPICard
            label="Damaged"
            value={ov?.alerts?.damaged ?? 0}
            subtitle="Last 30 days"
            icon={ShieldAlert}
            color="red"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 TOP PRODUCTS (STOCK HEAVY)
          ══════════════════════════════════════════════════════════════ */}
      {ov?.topProducts?.length > 0 && (
        <div>
          <SectionHeader icon={TrendingUp} title="Top Products (Stock Heavy)" emoji="📊" />
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {ov.topProducts.map((p: any, idx: number) => (
                <div
                  key={idx}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.productName}
                        className="w-8 h-8 rounded-lg object-cover border"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package className="h-4 w-4 text-gray-300" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {p.productName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-gray-900 tabular-nums">
					  {p.stockDisplay ?? `${p.totalQty} ${p.unit}`}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        p.status === "high"
                          ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                          : p.status === "available"
                            ? "border-blue-200 text-blue-700 bg-blue-50"
                            : "border-amber-200 text-amber-700 bg-amber-50"
                      }`}
                    >
                      {p.status === "high" ? "✅ High Stock" : p.status === "available" ? "✅ Available" : "⚠ Low"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          📉 STOCK INSIGHTS
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={Zap} title="Stock Insights" emoji="📉" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-orange-100 rounded-lg">
                <Flame size={14} className="text-orange-500" />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Fast Moving
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {ov?.insights?.fastMoving ?? (
                <span className="text-gray-400 italic">Coming Soon</span>
              )}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <Snail size={14} className="text-blue-500" />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Slow Moving
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {ov?.insights?.slowMoving ?? (
                <span className="text-gray-400 italic">Coming Soon</span>
              )}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-red-100 rounded-lg">
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                At Risk
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {(ov?.insights?.atRiskCount ?? 0) > 0 ? (
                <span className="text-red-600">
                  {ov.insights.atRiskCount} product{ov.insights.atRiskCount > 1 ? "s" : ""} may go out of stock soon
                </span>
              ) : (
                <span className="text-emerald-600">No products at risk</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ⚙ QUICK ACTIONS
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={Zap} title="Quick Actions" emoji="⚙" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button variant="outline" className="h-12 gap-2" asChild>
            <Link href="/dashboard/stock">
              <Eye className="h-4 w-4" />
              View Stock
            </Link>
          </Button>
          <Button variant="outline" className="h-12 gap-2" asChild>
            <Link href="/dashboard/stock/add">
              <Plus className="h-4 w-4" />
              Add Stock
            </Link>
          </Button>
          <Button variant="outline" className="h-12 gap-2" asChild>
            <Link href="/dashboard/orders">
              <ShoppingCart className="h-4 w-4" />
              Create Purchase
            </Link>
          </Button>
          <Button variant="outline" className="h-12 gap-2" asChild>
            <Link href="/dashboard/damage">
              <AlertTriangle className="h-4 w-4" />
              View Damage
            </Link>
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📦 FULL INVENTORY TABLE (Togglable)
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader icon={BoxesIcon} title="Inventory" emoji="📦" />
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setShowTable(!showTable)}
          >
            {showTable ? "Hide" : "Show"} All Inventory
            <ArrowRight className={`h-3 w-3 transition-transform ${showTable ? "rotate-90" : ""}`} />
          </Button>
        </div>

        {showTable && (
          <>
            {/* Search */}
            <div className="relative max-w-md mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product or brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {retailLoading ? (
              <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Loading inventory...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
                <BoxesIcon className="text-gray-300 mb-4" size={48} />
                <p className="text-gray-500 text-lg font-medium">No inventory items</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add products to your store to start managing stock.
                </p>
                <Button asChild className="mt-4" variant="outline" size="sm">
                  <Link href="/dashboard/stock/add">
                    <Plus className="mr-1 h-3 w-3" /> Add Stock
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-gradient-to-r from-gray-50 to-white">
                      <TableHead className="py-3 font-bold text-gray-700">Product</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Brand</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Variant</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Unit</TableHead>
                      <TableHead className="text-center py-3 font-bold text-gray-700">Stock</TableHead>
                      <TableHead className="text-right py-3 font-bold text-gray-700">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any) => {
                      const variant = item.variant;
                      const product = variant?.product;
                      const qty = Number(item.availableQty ?? 0);
                      const price = item.retailPrice ? Number(item.retailPrice) : null;

                      return (
                        <TableRow key={item.id} className="hover:bg-gray-50/50">
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              {(product?.images?.[0]?.imageUrl || product?.images?.[0]?.url || product?.image) ? (
                                <img
                                  src={product.images?.[0]?.imageUrl || product.images?.[0]?.url || product.image}
                                  alt={product?.name}
                                  className="w-8 h-8 rounded-lg object-cover border"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                  <Package className="h-4 w-4 text-gray-300" />
                                </div>
                              )}
                              <span className="text-sm font-semibold text-gray-800 truncate max-w-[160px]">
                                {product?.name || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 py-3">
                            {resolveBrand(item) || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 py-3">
                            {variant?.quantitySelectorLabel || variant?.unitLabel || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-gray-400 py-3">
                            {variant?.orderUnit || variant?.sellUnit || "unit"}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-bold ${
                                qty > 10
                                  ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                  : qty > 0
                                    ? "border-amber-200 text-amber-700 bg-amber-50"
                                    : "border-red-200 text-red-700 bg-red-50"
                              }`}
                            >
                              {qty} {variant?.orderUnit || variant?.sellUnit || "unit"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm py-3">
                            {price != null ? (
                              <span className="font-bold text-gray-900">
                                ৳ {price.toLocaleString("en-IN")}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">Not set</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
