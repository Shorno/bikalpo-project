"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Box,
  BoxesIcon,
  Calendar,
  CheckCircle2,
  Layers,
  Package,
  PackageX,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { orpc } from "@/utils/orpc";
import { Badge } from "@/components/ui/badge";

// ─── Types ─────────────────────────────────────────────────────

type KPIData = {
  mainKPI: {
    totalProducts: number;
    totalSKU: number;
    totalUnits: number;
    totalStockValue: number;
  };
  stockStatus: {
    inStock: number;
    outOfStock: number;
  };
  packTypeBreakdown: Array<{
    packagingType: string;
    totalUnits: number;
    itemCount: number;
  }>;
  alerts: {
    expiringSoon: number;
  };
  quickInsights: {
    topCategories: Array<{
      name: string;
      value: number;
    }>;
  };
};

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

// ─── Section Header ────────────────────────────────────────────

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

// ─── Pack Type Label ───────────────────────────────────────────

function formatPackType(type: string): string {
  const map: Record<string, string> = {
    loose: "Loose",
    packet: "Packet",
    sack: "Sack",
    carton: "Carton",
    bottle: "Bottle",
    can: "Can",
    jar: "Jar",
    pouch: "Pouch",
    box: "Box",
  };
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function getPackIcon(type: string): React.ElementType {
  switch (type) {
    case "loose":
      return Layers;
    case "carton":
    case "box":
      return BoxesIcon;
    default:
      return Package;
  }
}

// ─── Main Page ─────────────────────────────────────────────────

export default function StockOverviewDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["stockOverview", "dashboardKPI", "warehouse"],
    queryFn: () =>
      (orpc.stockOverview as any).getStockDashboardKPI.call({
        ownerType: "warehouse",
      }),
  });

  const kpi: KPIData | null = data ?? null;

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
          <p className="text-sm text-gray-500 mt-1">KPI dashboard for your warehouse stock</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
        <BoxesIcon className="text-gray-300 mb-4" size={48} />
        <p className="text-gray-500 text-lg font-medium">No stock data</p>
        <p className="text-sm text-gray-400 mt-1">
          Add products to your inventory to see the stock overview.
        </p>
      </div>
    );
  }

  const totalItems = kpi.stockStatus.inStock + kpi.stockStatus.outOfStock;
  const inStockPercent =
    totalItems > 0 ? Math.round((kpi.stockStatus.inStock / totalItems) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <BarChart3 className="text-blue-600" size={22} />
          </div>
          Stock Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          KPI dashboard for your warehouse stock position
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 MAIN KPI — STOCK POSITION
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={TrendingUp} title="Stock Position" emoji="📊" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Total Products"
            value={kpi.mainKPI.totalProducts.toLocaleString()}
            icon={Package}
            color="amber"
          />
          <KPICard
            label="Total Stock Value"
            value={`৳ ${kpi.mainKPI.totalStockValue.toLocaleString()}`}
            icon={Wallet}
            color="emerald"
          />
          <KPICard
            label="Total Units"
            value={kpi.mainKPI.totalUnits.toLocaleString()}
            icon={BoxesIcon}
            color="blue"
          />
          <KPICard
            label="Total SKU"
            value={kpi.mainKPI.totalSKU.toLocaleString()}
            icon={Tag}
            color="purple"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 STOCK STATUS
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader icon={CheckCircle2} title="Stock Status" emoji="📊" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border rounded-xl p-5 bg-emerald-50/50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-lg">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-emerald-700 tabular-nums">
                    {kpi.stockStatus.inStock}
                  </div>
                  <div className="text-xs font-medium text-emerald-500">In Stock Items</div>
                </div>
              </div>
              {totalItems > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                  {inStockPercent}%
                </Badge>
              )}
            </div>
            {/* Simple progress bar */}
            {totalItems > 0 && (
              <div className="mt-3 h-2 bg-emerald-200/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${inStockPercent}%` }}
                />
              </div>
            )}
          </div>

          <div className="border rounded-xl p-5 bg-red-50/50 border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 rounded-lg">
                  <PackageX size={20} className="text-red-600" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-700 tabular-nums">
                    {kpi.stockStatus.outOfStock}
                  </div>
                  <div className="text-xs font-medium text-red-500">Out of Stock Items</div>
                </div>
              </div>
              {totalItems > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                  {100 - inStockPercent}%
                </Badge>
              )}
            </div>
            {totalItems > 0 && (
              <div className="mt-3 h-2 bg-red-200/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${100 - inStockPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 PACK / INVENTORY TYPE
          ══════════════════════════════════════════════════════════════ */}
      {kpi.packTypeBreakdown.length > 0 && (
        <div>
          <SectionHeader icon={Box} title="Pack / Inventory Type" emoji="📊" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {kpi.packTypeBreakdown.map((pack) => {
              const PackIcon = getPackIcon(pack.packagingType);
              return (
                <div
                  key={pack.packagingType}
                  className="border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-gray-100 rounded-lg">
                      <PackIcon size={14} className="text-gray-600" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {formatPackType(pack.packagingType)} Stock
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 tabular-nums">
                    {pack.totalUnits.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {pack.itemCount} {pack.itemCount === 1 ? "item" : "items"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ⚠ ALERT SUMMARY
          ══════════════════════════════════════════════════════════════ */}
      {kpi.alerts.expiringSoon > 0 && (
        <div>
          <SectionHeader icon={AlertTriangle} title="Alert Summary" emoji="⚠" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="border rounded-xl p-4 bg-orange-50/50 border-orange-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar size={18} className="text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-700 tabular-nums">
                    {kpi.alerts.expiringSoon}
                  </div>
                  <div className="text-xs font-medium text-orange-500">
                    Expiring within 30 days
                  </div>
                </div>
              </div>
            </div>

            {/* Placeholder for future: Low Stock, Damaged */}
            <div className="border rounded-xl p-4 bg-gray-50/50 border-gray-200 border-dashed">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <AlertTriangle size={18} className="text-gray-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-300">—</div>
                  <div className="text-xs font-medium text-gray-400">Low Stock</div>
                  <div className="text-[9px] text-gray-300">Coming soon</div>
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-4 bg-gray-50/50 border-gray-200 border-dashed">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <PackageX size={18} className="text-gray-400" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-300">—</div>
                  <div className="text-xs font-medium text-gray-400">Damaged</div>
                  <div className="text-[9px] text-gray-300">Coming soon</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          📌 QUICK INSIGHTS
          ══════════════════════════════════════════════════════════════ */}
      {kpi.quickInsights.topCategories.length > 0 && (
        <div>
          <SectionHeader icon={TrendingUp} title="Quick Insights" emoji="📌" />
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Highest Stock Value by Category
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {kpi.quickInsights.topCategories.map((cat, idx) => {
                const maxValue = kpi.quickInsights.topCategories[0]?.value ?? 1;
                const barPercent = maxValue > 0 ? Math.round((cat.value / maxValue) * 100) : 0;

                return (
                  <div key={cat.name} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-xs font-bold text-gray-400 w-5 tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {cat.name}
                        </span>
                        <span className="text-sm font-bold text-gray-900 tabular-nums ml-2">
                          ৳ {cat.value.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                          style={{ width: `${barPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Missing Data Notice ── */}    </div>
  );
}
