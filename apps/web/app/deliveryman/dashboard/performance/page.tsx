"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3Icon,
  TrendingUpIcon,
  PackageIcon,
  WalletIcon,
  Loader2Icon,
  TruckIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";

interface Stats {
  todayDelivered: number;
  todayFailed: number;
  pending: number;
  activeGroups: number;
  delivered: number;
  failed: number;
  totalReturns: number;
  returnAmountProcessed: number;
  successRate: number;
  totalGroups: number;
  completedGroups: number;
  totalDeliveries: number;
}

export default function PerformancePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const apiBase = process.env.NEXT_PUBLIC_AUTH_URL || "";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/api/stats`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiBase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2Icon className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 text-center text-gray-500">Failed to load stats.</div>
    );
  }

  const kpiCards = [
    {
      label: "Success Rate",
      value: `${stats.successRate}%`,
      icon: TrendingUpIcon,
      color: "bg-emerald-50 text-emerald-700",
      iconColor: "text-emerald-500",
    },
    {
      label: "Total Deliveries",
      value: stats.totalDeliveries,
      icon: TruckIcon,
      color: "bg-blue-50 text-blue-700",
      iconColor: "text-blue-500",
    },
    {
      label: "Today Delivered",
      value: stats.todayDelivered,
      icon: CheckCircle2Icon,
      color: "bg-emerald-50 text-emerald-700",
      iconColor: "text-emerald-500",
    },
    {
      label: "Today Failed",
      value: stats.todayFailed,
      icon: XCircleIcon,
      color: "bg-red-50 text-red-700",
      iconColor: "text-red-500",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: PackageIcon,
      color: "bg-amber-50 text-amber-700",
      iconColor: "text-amber-500",
    },
    {
      label: "Active Groups",
      value: stats.activeGroups,
      icon: BarChart3Icon,
      color: "bg-purple-50 text-purple-700",
      iconColor: "text-purple-500",
    },
  ];

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-lg font-bold text-gray-900 px-1">My Performance</h1>

      {/* Hero stat */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white text-center">
        <p className="text-sm opacity-80 mb-1">Success Rate</p>
        <p className="text-4xl font-bold">{stats.successRate}%</p>
        <p className="text-xs opacity-70 mt-2">
          {stats.delivered} delivered / {stats.delivered + stats.failed} total attempts
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpiCards.slice(1).map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              <span className="text-[10px] font-medium opacity-80">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Lifetime stats */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Lifetime Stats</h3>
        <div className="space-y-2">
          {[
            { label: "Total Groups", value: stats.totalGroups },
            { label: "Completed Groups", value: stats.completedGroups },
            { label: "Total Delivered", value: stats.delivered },
            { label: "Total Failed", value: stats.failed },
            { label: "Total Returns", value: stats.totalReturns },
            { label: "Return Value Processed", value: `৳${stats.returnAmountProcessed.toLocaleString()}` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-gray-500">{row.label}</span>
              <span className="font-medium text-gray-800">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
