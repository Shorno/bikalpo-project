"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Package,
  RotateCcw,
  ShieldAlert,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useExpiredProducts } from "@/hooks/use-shop-owner-api";

// ─── KPI Card ──────────────────────────────────────────────────

function KPICard({
  label, value, subtitle, icon: Icon, color,
}: {
  label: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color: "red" | "amber" | "blue";
}) {
  const c = {
    red: { bg: "bg-red-50/50 border-red-200", icon: "bg-red-100 text-red-600", val: "text-red-700", lbl: "text-red-500" },
    amber: { bg: "bg-amber-50/50 border-amber-200", icon: "bg-amber-100 text-amber-600", val: "text-amber-700", lbl: "text-amber-500" },
    blue: { bg: "bg-blue-50/50 border-blue-200", icon: "bg-blue-100 text-blue-600", val: "text-blue-700", lbl: "text-blue-500" },
  }[color];

  return (
    <div className={`border rounded-xl p-4 hover:shadow-sm transition-shadow ${c.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${c.icon}`}><Icon size={20} /></div>
        <div className="min-w-0">
          <div className={`text-2xl font-bold tabular-nums ${c.val}`}>{value}</div>
          <div className={`text-xs font-medium ${c.lbl}`}>{label}</div>
          {subtitle && <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Format date helper ─────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function daysAgo(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "1 day ago";
    return `${diff} days ago`;
  } catch {
    return "";
  }
}

// ─── Main Page ─────────────────────────────────────────────────

export default function ExpiredProductsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data, isLoading } = useExpiredProducts();

  const summary = (data as any)?.summary ?? { expiredProducts: 0, expiringSoon: 0, lossValue: 0 };
  const expiredProducts: any[] = (data as any)?.expiredProducts ?? [];
  const watchlist: any[] = (data as any)?.expiryEnabledProducts ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <XCircle className="text-red-600" size={22} />
            </div>
            ❌ Expired Products
          </h1>
          <p className="text-sm text-gray-500 mt-1">Loading...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Scanning expiry data...</p>
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
            <div className="p-2 bg-red-100 rounded-xl">
              <XCircle className="text-red-600" size={22} />
            </div>
            ❌ Expired Products
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Products expired or nearing expiry date
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/damage/create">
            <Trash2 className="mr-2 h-4 w-4" />
            Record Expired
          </Link>
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 EXPIRY SUMMARY KPIs
          ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard
          label="Expired Products"
          value={summary.expiredProducts}
          subtitle="Products with expired batches"
          icon={XCircle}
          color="red"
        />
        <KPICard
          label="Expiring Soon"
          value={summary.expiringSoon}
          subtitle="Expiry-tracked products in stock"
          icon={Clock}
          color="amber"
        />
        <KPICard
          label="Loss Value"
          value={`৳${summary.lossValue.toLocaleString("en-IN")}`}
          subtitle="Total expired stock loss"
          icon={Tag}
          color="blue"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📋 EXPIRED PRODUCT LIST
          ══════════════════════════════════════════════════════════════ */}
      {expiredProducts.length === 0 && watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-emerald-50/30">
          <CheckCircle2 className="text-emerald-300 mb-4" size={48} />
          <p className="text-emerald-700 text-lg font-medium">No expired products!</p>
          <p className="text-sm text-emerald-500 mt-1">
            All items are within valid date.
          </p>
          <Button asChild className="mt-4" variant="outline" size="sm">
            <Link href="/dashboard/stock">📦 View Inventory</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Expired Products Table */}
          {expiredProducts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <XCircle size={14} className="text-red-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  ❌ Expired Product List
                </h2>
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-gradient-to-r from-red-50/50 to-white">
                      <TableHead className="w-[40px] py-3" />
                      <TableHead className="w-[40px] py-3 font-bold text-gray-700">#</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Product (Core)</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Affected Variants</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Last Expiry</TableHead>
                      <TableHead className="text-center py-3 font-bold text-gray-700">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiredProducts.map((p: any, idx: number) => {
                      const isExpanded = expandedId === p.productId;

                      return (
                        <>
                          <TableRow
                            key={p.productId}
                            className={`hover:bg-red-50/30 cursor-pointer transition-colors ${isExpanded ? "bg-red-50/40" : ""}`}
                            onClick={() => setExpandedId(isExpanded ? null : p.productId)}
                          >
                            <TableCell className="py-3 pr-0">
                              {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                            </TableCell>
                            <TableCell className="py-3 text-xs font-bold text-gray-400">{idx + 1}</TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2.5">
                                {p.productImage ? (
                                  <img src={p.productImage} alt={p.productName} className="w-8 h-8 rounded-lg object-cover border" />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <Package className="h-4 w-4 text-gray-300" />
                                  </div>
                                )}
                                <span className="text-sm font-semibold text-gray-800">{p.productName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="text-sm font-bold text-gray-900 tabular-nums">
                                {p.variants.length} configured
                              </span>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="text-sm text-gray-600">{formatDate(p.lastExpiryDate)}</span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <Badge variant="outline" className="text-[10px] font-bold border-red-200 text-red-700 bg-red-50">
                                ❌ Expired
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Detail */}
                          {isExpanded && (
                            <TableRow key={`${p.productId}-detail`} className="bg-red-50/20">
                              <TableCell colSpan={6} className="p-0">
                                <div className="px-6 py-5 border-t border-red-100 space-y-4">
                                  {/* Variant Status */}
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <BarChart3 size={12} /> Variant Status
                                    </h4>
                                    <div className="bg-white border rounded-lg overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="text-[11px] bg-gray-50">
                                            <TableHead className="py-2 font-bold text-gray-600">Brand · Variant</TableHead>
                                            <TableHead className="py-2 font-bold text-gray-600">Qty</TableHead>
                                            <TableHead className="py-2 font-bold text-gray-600">Unit Price</TableHead>
                                            <TableHead className="py-2 font-bold text-gray-600">Loss</TableHead>
                                            <TableHead className="text-center py-2 font-bold text-gray-600">Status</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {p.variants.map((v: any, vi: number) => (
                                            <TableRow key={vi} className="hover:bg-gray-50/50">
                                              <TableCell className="py-2">
                                                <span className="text-sm font-medium text-gray-800">
                                                  {v.brandName || "No Brand"} · {v.unitLabel}
                                                </span>
                                              </TableCell>
                                              <TableCell className="py-2 text-sm font-bold text-gray-900 tabular-nums">
                                                {v.stockDisplay}
                                              </TableCell>
                                              <TableCell className="py-2 text-sm text-gray-600 tabular-nums">
                                                ৳{v.unitPrice.toLocaleString("en-IN")}
                                              </TableCell>
                                              <TableCell className="py-2">
                                                <span className="text-sm font-bold text-red-600 tabular-nums">
                                                  ৳{v.totalValue.toLocaleString("en-IN")}
                                                </span>
                                              </TableCell>
                                              <TableCell className="text-center py-2">
                                                <Badge variant="outline" className="text-[9px] font-bold border-red-200 text-red-700 bg-red-50">
                                                  ❌ Expired
                                                </Badge>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>

                                  {/* Expiry Info */}
                                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                      <Calendar size={12} /> Expiry Info
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                      <div>
                                        <span className="text-xs text-red-500">Last Expiry Date</span>
                                        <p className="text-sm font-bold text-red-800">{formatDate(p.lastExpiryDate)}</p>
                                      </div>
                                      <div>
                                        <span className="text-xs text-red-500">Expired Since</span>
                                        <p className="text-sm font-bold text-red-800">{daysAgo(p.lastExpiryDate)}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Loss Impact */}
                                  <div className="bg-white border rounded-lg px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ShieldAlert size={14} className="text-red-500" />
                                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Estimated Loss
                                      </span>
                                    </div>
                                    <span className="text-lg font-bold text-red-600 tabular-nums">
                                      ৳{p.lossValue.toLocaleString("en-IN")}
                                    </span>
                                  </div>

                                  {/* Quick Actions */}
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">⚙ Actions</h4>
                                    <div className="flex flex-wrap gap-2">
                                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                                        <Link href="/dashboard/damage/create?type=expired">
                                          <Trash2 size={12} /> Remove from Stock
                                        </Link>
                                      </Button>
                                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-gray-400" disabled>
                                        <RotateCcw size={12} /> Return to Supplier
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

                <div className="px-4 py-3 border-t bg-red-50/30 text-xs text-gray-500">
                  {expiredProducts.length} expired product{expiredProducts.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              📦 EXPIRING SOON WATCHLIST
              ══════════════════════════════════════════════════════════════ */}
          {watchlist.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  📦 Expiry-Tracked Products (Watchlist)
                </h2>
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-gradient-to-r from-amber-50/50 to-white">
                      <TableHead className="py-3 font-bold text-gray-700">Product</TableHead>
                       <TableHead className="py-3 font-bold text-gray-700">Tracked Variants</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Shelf Life</TableHead>
                      <TableHead className="text-center py-3 font-bold text-gray-700">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {watchlist.map((w: any) => (
                      <TableRow key={w.productId} className="hover:bg-amber-50/30">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            {w.productImage ? (
                              <img src={w.productImage} alt={w.productName} className="w-8 h-8 rounded-lg object-cover border" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                <Package className="h-4 w-4 text-gray-300" />
                              </div>
                            )}
                            <span className="text-sm font-semibold text-gray-800">{w.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-sm font-bold text-gray-900 tabular-nums">
                          {w.configuredVariants} configured
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-600">
                          {w.shelfLife || "—"}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700 bg-amber-50 cursor-pointer">
                            ⚡ Track Expiry
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="px-4 py-3 border-t bg-amber-50/30 text-xs text-gray-500">
                  {watchlist.length} product{watchlist.length !== 1 ? "s" : ""} with expiry tracking enabled
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
