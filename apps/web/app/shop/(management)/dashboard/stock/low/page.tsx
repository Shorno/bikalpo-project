"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Info,
  Package,
  Plus,
  ShieldAlert,
  ShoppingCart,
  Target,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLowStockProducts } from "@/hooks/use-shop-owner-api";

// ─── Status Config ─────────────────────────────────────────────

const STATUS_CONFIG = {
  ok: { label: "OK", color: "border-emerald-200 text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  low: { label: "⚠ Low", color: "border-amber-200 text-amber-700 bg-amber-50", dot: "bg-amber-500" },
  critical: { label: "🔴 Critical", color: "border-red-200 text-red-700 bg-red-50", dot: "bg-red-500" },
  out_of_stock: { label: "🔴 Out", color: "border-red-300 text-red-800 bg-red-100", dot: "bg-red-600" },
} as const;

// ─── KPI Card ──────────────────────────────────────────────────

function KPICard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: "amber" | "red" | "blue";
}) {
  const colors = {
    amber: {
      bg: "bg-amber-50/50 border-amber-200",
      icon: "bg-amber-100 text-amber-600",
      val: "text-amber-700",
      lbl: "text-amber-500",
    },
    red: {
      bg: "bg-red-50/50 border-red-200",
      icon: "bg-red-100 text-red-600",
      val: "text-red-700",
      lbl: "text-red-500",
    },
    blue: {
      bg: "bg-blue-50/50 border-blue-200",
      icon: "bg-blue-100 text-blue-600",
      val: "text-blue-700",
      lbl: "text-blue-500",
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

// ─── Main Page ─────────────────────────────────────────────────

export default function LowStockPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data, isLoading } = useLowStockProducts();

  const summary = (data as any)?.summary ?? { lowProducts: 0, criticalItems: 0, shortageVariants: 0 };
  const products: any[] = (data as any)?.products ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <AlertTriangle className="text-amber-600" size={22} />
            </div>
            ⚠ Low Stock Products
          </h1>
          <p className="text-sm text-gray-500 mt-1">Loading...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Scanning inventory levels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <AlertTriangle className="text-amber-600" size={22} />
            </div>
            ⚠ Low Stock Products
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Products with variants below minimum stock level
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
          📊 LOW STOCK SUMMARY KPIs
          ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard
          label="Low Products"
          value={summary.lowProducts}
          subtitle="Products with low variants"
          icon={AlertTriangle}
          color="amber"
        />
        <KPICard
          label="Critical Items"
          value={summary.criticalItems}
          subtitle="≤ 50% of minimum level"
          icon={ShieldAlert}
          color="red"
        />
        <KPICard
          label="Variants Below Minimum"
          value={summary.shortageVariants}
          subtitle="Configured variants needing stock"
          icon={TrendingDown}
          color="blue"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📋 LOW STOCK LIST
          ══════════════════════════════════════════════════════════════ */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-emerald-50/30">
          <CheckCircle2 className="text-emerald-300 mb-4" size={48} />
          <p className="text-emerald-700 text-lg font-medium">All stock levels are healthy!</p>
          <p className="text-sm text-emerald-500 mt-1">
            No products are below their minimum stock level.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-gradient-to-r from-amber-50/50 to-white">
                <TableHead className="w-[40px] py-3" />
                <TableHead className="w-[40px] py-3 font-bold text-gray-700">#</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Product (Core)</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Variants</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Issue</TableHead>
                <TableHead className="text-center py-3 font-bold text-gray-700">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any, idx: number) => {
                const isExpanded = expandedId === p.productId;
                const sc = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.low;

                return (
                  <>
                    {/* ── Product Row ── */}
                    <TableRow
                      key={p.productId}
                      className={`hover:bg-amber-50/30 cursor-pointer transition-colors ${isExpanded ? "bg-amber-50/40" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : p.productId)}
                    >
                      <TableCell className="py-3 pr-0">
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-xs font-bold text-gray-400">
                        {idx + 1}
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
                          <span className="text-sm font-semibold text-gray-800">
                            {p.productName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                          {p.variants.length} configured
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="text-sm text-gray-600">{p.issueLabel}</span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${sc.color}`}
                        >
                          {sc.label}
                        </Badge>
                      </TableCell>
                    </TableRow>

                    {/* ── Expanded Detail ── */}
                    {isExpanded && (
                      <TableRow key={`${p.productId}-detail`} className="bg-amber-50/20">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-6 py-5 border-t border-amber-100 space-y-4">
                            {/* Section: Variant Status */}
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <BarChart3 size={12} /> Variant Status
                              </h4>
                              <div className="bg-white border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="text-[11px] bg-gray-50">
                                      <TableHead className="py-2 font-bold text-gray-600">Brand · Variant</TableHead>
                                      <TableHead className="py-2 font-bold text-gray-600">Available</TableHead>
                                      <TableHead className="py-2 font-bold text-gray-600">Minimum</TableHead>
                                      <TableHead className="py-2 font-bold text-gray-600">Shortage</TableHead>
                                      <TableHead className="text-center py-2 font-bold text-gray-600">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {p.variants.map((v: any) => {
                                      const vs = STATUS_CONFIG[v.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ok;
                                      const shortage = Math.max(0, v.reorderLevel - v.availableQty);

                                      return (
                                        <TableRow key={v.variantId} className="hover:bg-gray-50/50">
                                          <TableCell className="py-2">
                                            <span className="text-sm font-medium text-gray-800">
                                              {v.brandName || "No Brand"} · {v.unitLabel}
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-2 text-sm font-bold text-gray-900 tabular-nums">
                                            {v.stockDisplay}
                                          </TableCell>
                                          <TableCell className="py-2 text-sm text-gray-500 tabular-nums">
                                            {v.reorderLevel} {v.operationalUnit}
                                          </TableCell>
                                          <TableCell className="py-2">
                                            {shortage > 0 ? (
                                              <span className="text-sm font-bold text-red-600 tabular-nums">
                                                -{shortage} {v.operationalUnit}
                                              </span>
                                            ) : (
                                              <span className="text-sm text-emerald-600">OK</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-center py-2">
                                            <Badge
                                              variant="outline"
                                              className={`text-[9px] font-bold ${vs.color}`}
                                            >
                                              {vs.label}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            {/* Section: Alert Reason */}
                            {p.alertReasons?.length > 0 && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                  <Info size={12} /> Alert Reason
                                </h4>
                                <p className="text-sm text-amber-800">
                                  Low Stock Triggered Because:
                                </p>
                                <ul className="mt-1 space-y-0.5">
                                  {p.alertReasons.map((reason: string, i: number) => (
                                    <li key={i} className="text-sm text-amber-700 flex items-center gap-1.5">
                                      <span className="text-amber-500">✔</span>
                                      {reason} Variant Below Minimum Level
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Section: Minimum Level Config */}
                            {p.minimumLevels?.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Target size={12} /> Minimum Level Configuration
                                </h4>
                                <div className="bg-white border rounded-lg divide-y divide-gray-100">
                                  {p.minimumLevels.map((ml: any, i: number) => (
                                    <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                                      <span className="text-sm text-gray-600">{ml.label}</span>
                                      <span className="text-sm font-bold text-gray-900 tabular-nums">
                                        Minimum: {ml.minimum} {ml.unit}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Section: Quick Actions */}
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                ⚙ Actions
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                                  <Link href={`/dashboard/orders?product=${p.productId}`}>
                                    <ShoppingCart size={12} /> Create Purchase
                                  </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                                  <Link href={`/dashboard/stock/add?product=${p.productId}`}>
                                    <Plus size={12} /> Add Stock
                                  </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                                  <Link href={`/dashboard/products/${p.productId}`}>
                                    <Eye size={12} /> View Full Product
                                  </Link>
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
          <div className="px-4 py-3 border-t bg-amber-50/30 text-xs text-gray-500">
            {products.length} product{products.length !== 1 ? "s" : ""} below minimum stock level
          </div>
        </div>
      )}
    </div>
  );
}
