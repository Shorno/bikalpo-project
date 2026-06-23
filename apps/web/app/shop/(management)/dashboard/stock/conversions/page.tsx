"use client";

import {
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useConversionHistory } from "@/hooks/use-shop-owner-api";

// ─── Status Config ──────────────────────────────────────────

const STATUS_CONFIG = {
  converted: { label: "✅ Converted", color: "border-emerald-200 text-emerald-700 bg-emerald-50", icon: CheckCircle2 },
  pending: { label: "⏳ Pending", color: "border-amber-200 text-amber-700 bg-amber-50", icon: Clock },
  failed: { label: "❌ Failed", color: "border-red-200 text-red-700 bg-red-50", icon: XCircle },
} as const;

function getModeConfig(item: { supplyMode?: string | null; supplyModeLabel?: string | null }) {
  if (item.supplyMode === "loose") {
    return {
      label: item.supplyModeLabel || "Loose",
      color: "border-teal-200 text-teal-700 bg-teal-50",
    };
  }

  if (item.supplyMode === "drum") {
    return {
      label: item.supplyModeLabel || "Drum",
      color: "border-amber-200 text-amber-700 bg-amber-50",
    };
  }

  if (item.supplyMode === "cylinder") {
    return {
      label: item.supplyModeLabel || "Cylinder",
      color: "border-orange-200 text-orange-700 bg-orange-50",
    };
  }

  if (item.supplyMode === "pair") {
    return {
      label: item.supplyModeLabel || "Pair",
      color: "border-violet-200 text-violet-700 bg-violet-50",
    };
  }

  return {
    label: item.supplyModeLabel || item.supplyMode || "Legacy",
    color: "border-blue-200 text-blue-700 bg-blue-50",
  };
}

// ─── KPI Card ───────────────────────────────────────────────

function KPICard({
  label, value, subtitle, icon: Icon, color,
}: {
  label: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color: "indigo" | "emerald" | "amber" | "red";
}) {
  const c = {
    indigo: { bg: "bg-indigo-50/50 border-indigo-200", icon: "bg-indigo-100 text-indigo-600", val: "text-indigo-700", lbl: "text-indigo-500" },
    emerald: { bg: "bg-emerald-50/50 border-emerald-200", icon: "bg-emerald-100 text-emerald-600", val: "text-emerald-700", lbl: "text-emerald-500" },
    amber: { bg: "bg-amber-50/50 border-amber-200", icon: "bg-amber-100 text-amber-600", val: "text-amber-700", lbl: "text-amber-500" },
    red: { bg: "bg-red-50/50 border-red-200", icon: "bg-red-100 text-red-600", val: "text-red-700", lbl: "text-red-500" },
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

// ─── Main Page ──────────────────────────────────────────────

export default function ConversionHistoryPage() {
  const { data, isLoading } = useConversionHistory();

  const summary = (data as any)?.summary ?? { totalItems: 0, converted: 0, pending: 0, failed: 0 };
  const items: any[] = (data as any)?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <ArrowRightLeft className="text-indigo-600" size={22} />
            </div>
            🔄 Stock Conversions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Loading...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading conversion history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <ArrowRightLeft className="text-indigo-600" size={22} />
          </div>
          🔄 Stock Conversions
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          B2B → B2C conversion history from warehouse orders
        </p>
      </div>

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KPICard label="Total Items" value={summary.totalItems} subtitle="All order items" icon={Package} color="indigo" />
        <KPICard label="Converted" value={summary.converted} subtitle="Successfully converted" icon={CheckCircle2} color="emerald" />
        <KPICard label="Pending" value={summary.pending} subtitle="Awaiting delivery" icon={Clock} color="amber" />
        <KPICard label="Failed" value={summary.failed} subtitle="Needs manual action" icon={XCircle} color="red" />
      </div>

      {/* ── Conversion List ── */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <RefreshCw className="text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 text-lg font-medium">No conversions yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Conversions will appear here when warehouse orders are delivered.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-xs bg-gradient-to-r from-indigo-50/50 to-white">
                <TableHead className="w-[40px] py-3 font-bold text-gray-700">#</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Order</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Product</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Ordered</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Mode</TableHead>
                <TableHead className="py-3 font-bold text-gray-700">Converted Qty</TableHead>
                <TableHead className="text-center py-3 font-bold text-gray-700">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, idx: number) => {
                const sc = STATUS_CONFIG[item.conversionStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                const mc = item.supplyMode ? getModeConfig(item) : null;

                return (
                  <TableRow key={item.orderItemId} className="hover:bg-indigo-50/20">
                    <TableCell className="py-3 text-xs font-bold text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="py-3">
                      <div>
                        <span className="text-xs font-mono font-bold text-indigo-600">{item.orderNumber}</span>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(item.orderedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2.5">
                        {item.productImage ? (
                          <img src={item.productImage} alt={item.productName} className="w-8 h-8 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="h-4 w-4 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <span className="text-sm font-semibold text-gray-800">{item.productName}</span>
                          <div className="text-[10px] text-gray-400">{item.productSize}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{item.quantity}</span>
                      <span className="text-xs text-gray-400 ml-1">units</span>
                    </TableCell>
                    <TableCell className="py-3">
                      {mc ? (
                        <Badge variant="outline" className={`text-[10px] font-bold ${mc.color}`}>
                          {mc.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {item.convertedQty ? (
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">
                          {Number(item.convertedQty).toFixed(0)} {item.supplyMode === "loose" ? "KG" : "pcs"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <Badge variant="outline" className={`text-[10px] font-bold ${sc.color}`}>
                        {sc.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t bg-indigo-50/30 text-xs text-gray-500">
            {items.length} conversion{items.length !== 1 ? "s" : ""} total
          </div>
        </div>
      )}
    </div>
  );
}
