"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Package,
  PackageOpen,
  Recycle,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useEmptyPackSummary } from "@/hooks/use-shop-owner-api";

// ─── Status Config ─────────────────────────────────────────────

const STATUS_CONFIG = {
  reusable: { label: "♻ Reusable", color: "border-emerald-200 text-emerald-700 bg-emerald-50" },
  return_pending: { label: "🔁 Return Pending", color: "border-blue-200 text-blue-700 bg-blue-50" },
} as const;

const CONDITION_CONFIG = {
  reusable: { label: "♻ Reusable", color: "border-emerald-200 text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  pending: { label: "⏳ Pending", color: "border-amber-200 text-amber-700 bg-amber-50", dot: "bg-amber-500" },
  damaged: { label: "⚠ Damaged", color: "border-red-200 text-red-700 bg-red-50", dot: "bg-red-500" },
} as const;

// ─── KPI Card ──────────────────────────────────────────────────

function KPICard({
  label, value, subtitle, icon: Icon, color,
}: {
  label: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color: "teal" | "blue" | "emerald";
}) {
  const c = {
    teal: { bg: "bg-teal-50/50 border-teal-200", icon: "bg-teal-100 text-teal-600", val: "text-teal-700", lbl: "text-teal-500" },
    blue: { bg: "bg-blue-50/50 border-blue-200", icon: "bg-blue-100 text-blue-600", val: "text-blue-700", lbl: "text-blue-500" },
    emerald: { bg: "bg-emerald-50/50 border-emerald-200", icon: "bg-emerald-100 text-emerald-600", val: "text-emerald-700", lbl: "text-emerald-500" },
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

// ─── Main Page ─────────────────────────────────────────────────

export default function EmptyPackPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data, isLoading } = useEmptyPackSummary();

  const summary = (data as any)?.summary ?? { totalEmptyPacks: 0, returnPending: 0, reusableStock: 0 };
  const products: any[] = (data as any)?.products ?? [];
  const returnTracking: any[] = (data as any)?.returnTracking ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <PackageOpen className="text-teal-600" size={22} />
            </div>
            🫙 Empty Pack Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Loading...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading empty pack data...</p>
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
            <div className="p-2 bg-teal-100 rounded-xl">
              <PackageOpen className="text-teal-600" size={22} />
            </div>
            🫙 Empty Pack Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track, manage, and return collected empty packs
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 EMPTY PACK SUMMARY KPIs
          ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard
          label="Total Empty Packs"
          value={`${summary.totalEmptyPacks} pcs`}
          subtitle="All collected empty packs"
          icon={PackageOpen}
          color="teal"
        />
        <KPICard
          label="Return Pending"
          value={`${summary.returnPending} pcs`}
          subtitle="Awaiting return to supplier"
          icon={RotateCcw}
          color="blue"
        />
        <KPICard
          label="Reusable Stock"
          value={`${summary.reusableStock} pcs`}
          subtitle="Verified & ready to reuse"
          icon={Recycle}
          color="emerald"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📋 EMPTY PACK LIST + RETURN TRACKING
          ══════════════════════════════════════════════════════════════ */}
      {products.length === 0 && returnTracking.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <PackageOpen className="text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 text-lg font-medium">No empty packs recorded</p>
          <p className="text-sm text-gray-400 mt-1">
            Empty packs will appear here when collected during deliveries.
          </p>
        </div>
      ) : (
        <>
          {/* Empty Pack Product List */}
          {products.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-teal-100 rounded-lg">
                  <Package size={14} className="text-teal-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  📋 Empty Pack List (Product-wise)
                </h2>
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-gradient-to-r from-teal-50/50 to-white">
                      <TableHead className="w-[40px] py-3" />
                      <TableHead className="w-[40px] py-3 font-bold text-gray-700">#</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Product (Core)</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Empty Qty</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Type</TableHead>
                      <TableHead className="text-center py-3 font-bold text-gray-700">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p: any, idx: number) => {
                      const isExpanded = expandedId === p.productId;
                      const sc = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.reusable;

                      return (
                        <>
                          <TableRow
                            key={p.productId}
                            className={`hover:bg-teal-50/30 cursor-pointer transition-colors ${isExpanded ? "bg-teal-50/40" : ""}`}
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
                              <span className="text-sm font-bold text-gray-900 tabular-nums">{p.emptyQty} pcs</span>
                            </TableCell>
                            <TableCell className="py-3">
                              <span className="text-sm text-gray-600">{p.packType}</span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <Badge variant="outline" className={`text-[10px] font-bold ${sc.color}`}>
                                {sc.label}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Detail */}
                          {isExpanded && (
                            <TableRow key={`${p.productId}-detail`} className="bg-teal-50/20">
                              <TableCell colSpan={6} className="p-0">
                                <div className="px-6 py-5 border-t border-teal-100 space-y-4">
                                  {/* Pack Status (Variant Level) */}
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <BarChart3 size={12} /> Pack Status
                                    </h4>
                                    <div className="bg-white border rounded-lg overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="text-[11px] bg-gray-50">
                                            <TableHead className="py-2 font-bold text-gray-600">Brand · Type</TableHead>
                                            <TableHead className="py-2 font-bold text-gray-600">Collected</TableHead>
                                            <TableHead className="py-2 font-bold text-gray-600">Verified</TableHead>
                                            <TableHead className="py-2 font-bold text-gray-600">Rejected</TableHead>
                                            <TableHead className="text-center py-2 font-bold text-gray-600">Condition</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {p.variants.map((v: any, vi: number) => {
                                            const cc = CONDITION_CONFIG[v.condition as keyof typeof CONDITION_CONFIG] ?? CONDITION_CONFIG.pending;
                                            return (
                                              <TableRow key={vi} className="hover:bg-gray-50/50">
                                                <TableCell className="py-2">
                                                  <span className="text-sm font-medium text-gray-800">
                                                    {v.brandName || "Unknown"} · {v.packDescription}
                                                  </span>
                                                </TableCell>
                                                <TableCell className="py-2 text-sm font-bold text-gray-900 tabular-nums">
                                                  {v.collected} pcs
                                                </TableCell>
                                                <TableCell className="py-2 text-sm text-emerald-600 tabular-nums">
                                                  {v.verified} pcs
                                                </TableCell>
                                                <TableCell className="py-2 text-sm text-red-600 tabular-nums">
                                                  {v.rejected} pcs
                                                </TableCell>
                                                <TableCell className="text-center py-2">
                                                  <Badge variant="outline" className={`text-[9px] font-bold ${cc.color}`}>
                                                    {cc.label}
                                                  </Badge>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>

                                  {/* Condition Breakdown */}
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                      📊 Condition Breakdown
                                    </h4>
                                    <div className="bg-white border rounded-lg divide-y divide-gray-100">
                                      <div className="px-4 py-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                          <span className="text-sm text-gray-600">Reusable</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                                          {p.totalVerified} pcs
                                        </span>
                                      </div>
                                      <div className="px-4 py-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-red-500" />
                                          <span className="text-sm text-gray-600">Damaged</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                                          {p.totalRejected} pcs
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Movement Info */}
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                      📊 Movement Info
                                    </h4>
                                    <div className="bg-white border rounded-lg divide-y divide-gray-100">
                                      <div className="px-4 py-2.5 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Collected from Customers</span>
                                        <span className="text-sm font-bold text-gray-900 tabular-nums">{p.totalCollected} pcs</span>
                                      </div>
                                      <div className="px-4 py-2.5 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Returned to Supplier</span>
                                        <span className="text-sm font-bold text-gray-900 tabular-nums">{p.totalReturned} pcs</span>
                                      </div>
                                      <div className="px-4 py-2.5 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Currently in Store</span>
                                        <span className="text-sm font-bold text-teal-700 tabular-nums">{p.totalCollected - p.totalReturned} pcs</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quick Actions */}
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">⚙ Actions</h4>
                                    <div className="flex flex-wrap gap-2">
                                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-gray-400" disabled>
                                        <RotateCcw size={12} /> Return to Supplier
                                      </Button>
                                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-gray-400" disabled>
                                        <Trash2 size={12} /> Mark as Damaged
                                      </Button>
                                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                                        <Link href={`/dashboard/products/${p.productId}`}>
                                          <Eye size={12} /> View Product
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

                <div className="px-4 py-3 border-t bg-teal-50/30 text-xs text-gray-500">
                  {products.length} product{products.length !== 1 ? "s" : ""} with empty packs
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              📦 RETURN TRACKING
              ══════════════════════════════════════════════════════════════ */}
          {returnTracking.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <RotateCcw size={14} className="text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  📦 Return Tracking
                </h2>
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-gradient-to-r from-blue-50/50 to-white">
                      <TableHead className="py-3 font-bold text-gray-700">Product</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Pending Return</TableHead>
                      <TableHead className="py-3 font-bold text-gray-700">Supplier</TableHead>
                      <TableHead className="text-center py-3 font-bold text-gray-700">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnTracking.map((r: any) => (
                      <TableRow key={r.productId} className="hover:bg-blue-50/30">
                        <TableCell className="py-3">
                          <span className="text-sm font-semibold text-gray-800">{r.productName}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-sm font-bold text-blue-700 tabular-nums">{r.pendingReturn} pcs</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-gray-600">{r.supplierName || "Unknown"}</span>
                            {r.hasReturnAgreement && (
                              <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600 bg-emerald-50">
                                Agreement ✓
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-gray-400" disabled>
                            <RotateCcw size={10} /> Return Now
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="px-4 py-3 border-t bg-blue-50/30 text-xs text-gray-500">
                  {returnTracking.length} product{returnTracking.length !== 1 ? "s" : ""} pending return
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
