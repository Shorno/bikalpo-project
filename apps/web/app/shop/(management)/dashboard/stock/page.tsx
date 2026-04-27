"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BoxesIcon,
  CheckCircle2,
  Loader2,
  Package,
  PackageX,
  Plus,
  Search,
  Tag,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useMyRetailProducts } from "@/hooks/use-shop-owner-api";

// ─── KPI Card (same style as warehouse) ────────────────────────

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

// ─── Section Header (same style as warehouse) ──────────────────

function SectionHeader({
  icon: Icon,
  title,
  emoji,
}: {
  icon: React.ElementType;
  title: string;
  emoji: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="p-1.5 bg-gray-100 rounded-lg">
        <Icon size={14} className="text-gray-600" />
      </div>
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
        {emoji} {title}
      </h2>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function StockPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useMyRetailProducts({ search });
  const items: any[] = (data as any)?.items ?? [];

  // Derive stats
  const stats = useMemo(() => {
    let totalVariants = 0;
    let inStock = 0;
    let outOfStock = 0;
    let lowStock = 0;
    let totalUnits = 0;

    for (const item of items) {
      totalVariants++;
      const qty = Number(item.availableQty ?? 0);
      totalUnits += qty;
      if (qty <= 0) outOfStock++;
      else if (qty <= 5) lowStock++;
      else inStock++;
    }

    return { totalVariants, inStock, outOfStock, lowStock, totalUnits };
  }, [items]);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <BarChart3 className="text-blue-600" size={22} />
            </div>
            Stock Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your store inventory</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading stock data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <BarChart3 className="text-blue-600" size={22} />
            </div>
            Stock Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your store inventory
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
          📊 STOCK POSITION
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={TrendingUp} title="Stock Position" emoji="📊" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Total Variants"
            value={stats.totalVariants.toLocaleString()}
            icon={Tag}
            color="amber"
          />
          <KPICard
            label="Total Units"
            value={stats.totalUnits.toLocaleString()}
            icon={BoxesIcon}
            color="blue"
          />
          <KPICard
            label="In Stock"
            value={stats.inStock.toLocaleString()}
            icon={CheckCircle2}
            color="emerald"
          />
          <KPICard
            label="Products"
            value={
              new Set(items.map((i: any) => i.variant?.product?.id).filter(Boolean)).size.toLocaleString()
            }
            icon={Package}
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
            value={stats.inStock.toLocaleString()}
            subtitle={`> 5 units`}
            icon={CheckCircle2}
            color="emerald"
          />
          <KPICard
            label="Low Stock"
            value={stats.lowStock.toLocaleString()}
            subtitle="≤ 5 units"
            icon={AlertTriangle}
            color="orange"
          />
          <KPICard
            label="Out of Stock"
            value={stats.outOfStock.toLocaleString()}
            subtitle="0 units"
            icon={PackageX}
            color="red"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📦 INVENTORY TABLE
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={BoxesIcon} title="Inventory" emoji="📦" />

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

        {items.length === 0 ? (
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
                          {product?.images?.[0]?.url ? (
                            <img
                              src={product.images[0].url}
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
                        {variant?.weightKg ? `${variant.weightKg} KG` : "—"}
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
                          {qty}
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
      </div>
    </div>
  );
}
