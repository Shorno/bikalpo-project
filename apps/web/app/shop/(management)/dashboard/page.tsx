"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  MapPin,
  Package,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShopOwnerDashboardPage() {
  const stats = {
    totalOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
  };
  const user = {
    shopName: "My Shop",
    name: "",
    ownerName: "",
    sellerStatus: "",
    businessType: "",
    shopAddress: "Not set",
  };
  const sessionLoading = false;
  const loading = false;

  const [showPromo, setShowPromo] = useState(true);
  const [showFeature, setShowFeature] = useState(true);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Main Dashboard</h1>
        <span className="text-sm text-gray-500">
          Showing statistics for:{" "}
          <span className="font-medium text-gray-700">Today</span>
        </span>
      </div>

      {/* Shop Info + Trial Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shop Info Card */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              {sessionLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {user?.shopName || user?.name || "My Shop"}
                    {user?.sellerStatus === "approved" && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      {user?.ownerName || user?.name || "—"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                      <span className="capitalize">
                        {user?.businessType || "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {user?.shopAddress || "Not set"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trial / Subscription Banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-lg shadow-sm p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-emerald-200" />
              <span className="text-xs font-medium text-emerald-200">
                Subscription
              </span>
            </div>
            <p className="text-sm font-medium">
              Trial ends in <span className="text-lg font-bold">10 days</span>
            </p>
            <p className="text-xs text-emerald-200 mt-0.5">
              Renewal date: 04 Feb 2026
            </p>
          </div>
          <Button
            size="sm"
            className="mt-3 bg-white text-emerald-700 hover:bg-emerald-50 font-medium text-xs h-8"
          >
            Buy a Plan
          </Button>
        </div>
      </div>

      {/* Announcements */}
      <div className="space-y-3">
        {showPromo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900">
                Get Started with Bikalpo
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Set up your store, add products, and start selling today.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-blue-300 text-blue-800 hover:bg-blue-100"
              >
                Get Started
              </Button>
              <button
                onClick={() => setShowPromo(false)}
                className="p-1 rounded hover:bg-blue-100 transition-colors"
              >
                <X className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </div>
        )}
        {showFeature && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                New Features Available
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                EMI management, SMS marketing and more are now live.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                Explore Now
              </Button>
              <button
                onClick={() => setShowFeature(false)}
                className="p-1 rounded hover:bg-amber-100 transition-colors"
              >
                <X className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  ROW 1 — ORDER STATUS                                            */}
      {/* ================================================================ */}
      <SectionHeader
        icon={<ShoppingCart className="w-4 h-4" />}
        title="Order Status"
        note="ম্যানুয়াল সেলস এন্ট্রি করলে অর্ডার হিসেবে কাউন্ট হবে না, সেলস হিসেবে কাউন্ট হবে।"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
          label="Total Orders Today"
          value={loading ? null : String(stats?.totalOrders || 0)}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<ShoppingCart className="w-5 h-5 text-emerald-600" />}
          label="Direct Orders"
          value={loading ? null : "0"}
          bg="bg-emerald-50"
        />
        <StatCard
          icon={<Package className="w-5 h-5 text-purple-600" />}
          label="Open Orders"
          value={loading ? null : "0"}
          bg="bg-purple-50"
          href="/dashboard/open-orders"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Pending"
          value={loading ? null : String(stats?.pendingOrders || 0)}
          bg="bg-amber-50"
          href="/dashboard/incoming-orders"
        />
      </div>

      {/* ================================================================ */}
      {/*  ROW 2 — SALES                                                   */}
      {/* ================================================================ */}
      <SectionHeader icon={<TrendingUp className="w-4 h-4" />} title="Sales" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          label="Last Sale Status"
          value={loading ? null : "None"}
          icon={<FileText className="w-4 h-4 text-gray-400" />}
          sub=""
        />
        <SummaryCard
          label="Net Sales"
          value={loading ? null : "৳0"}
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          sub="+0.00%"
          subColor="text-emerald-600"
        />
        <SummaryCard
          label="Sales Return"
          value={loading ? null : "৳0"}
          icon={<Package className="w-4 h-4 text-gray-400" />}
        />
      </div>

      {/* ================================================================ */}
      {/*  ROW 3 — PURCHASE                                                */}
      {/* ================================================================ */}
      <SectionHeader
        icon={<ShoppingBag className="w-4 h-4" />}
        title="Purchase"
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          label="Last Purchase Status"
          value={loading ? null : "None"}
          icon={<FileText className="w-4 h-4 text-gray-400" />}
        />
        <SummaryCard
          label="Net Purchase"
          value={
            loading
              ? null
              : `৳${(stats?.totalSpent || 0).toLocaleString("en-BD")}`
          }
          icon={<ShoppingBag className="w-4 h-4 text-gray-400" />}
        />
        <SummaryCard
          label="Purchase Return"
          value={loading ? null : "৳0"}
          icon={<Package className="w-4 h-4 text-gray-400" />}
        />
      </div>

      {/* ================================================================ */}
      {/*  ROW 4 — DUE TRACKING                                            */}
      {/* ================================================================ */}
      <SectionHeader
        icon={<DollarSign className="w-4 h-4" />}
        title="Due Tracking"
      />
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        <SummaryCard
          label="Receivable"
          value={loading ? null : "৳0"}
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
        />
        <SummaryCard
          label="Payable"
          value={loading ? null : "৳0"}
          icon={<CreditCard className="w-4 h-4 text-red-500" />}
        />
      </div>

      {/* ================================================================ */}
      {/*  RECENT ACTIVITY                                                 */}
      {/* ================================================================ */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Recent Activity
          </h3>
          <Link
            href="/dashboard/incoming-orders"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { label: "Recent Orders", value: "No orders yet", icon: "order" },
            { label: "Last Order Status", value: "—", icon: "status" },
            {
              label: "Recent Payments",
              value: "No payments yet",
              icon: "payment",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/50"
            >
              <span className="text-sm font-medium text-gray-700">
                {item.label}
              </span>
              <span className="text-sm text-gray-400">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/*  CUSTOMER OVERVIEW                                               */}
      {/* ================================================================ */}
      <div className="bg-white rounded-lg border shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-purple-500" />
          Customer Overview
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500 mt-1">New Customers</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500 mt-1">Returning Customers</p>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  SALES STATISTICS                                                */}
      {/* ================================================================ */}
      <div className="bg-white rounded-lg border shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          Sales Statistics
        </h3>
        <div className="space-y-3">
          {[
            { label: "Net Sales", value: "৳0" },
            { label: "Product Cost", value: "৳0" },
            { label: "Gross Profit", value: "৳0" },
            { label: "Profit Margin", value: "0.00%" },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <span className="text-sm text-gray-600">{row.label}</span>
              <span className="text-sm font-semibold text-gray-900">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/*  ALERT PANELS                                                    */}
      {/* ================================================================ */}
      <SectionHeader
        icon={<AlertTriangle className="w-4 h-4" />}
        title="Alerts"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AlertPanel
          title="Low Stock Products"
          emptyText="No low stock products found"
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
        />
        <AlertPanel
          title="Top Customers"
          emptyText="No top customers found"
          icon={<Star className="w-4 h-4 text-amber-500" />}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AlertPanel
          title="Top Categories"
          emptyText="No category data available"
          icon={<Package className="w-4 h-4 text-blue-500" />}
        />
      </div>

      {/* ================================================================ */}
      {/*  SYSTEM NOTIFICATIONS                                            */}
      {/* ================================================================ */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            System Notifications
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            {
              text: "Trial Period Reminder",
              time: "Active",
              type: "warning" as const,
            },
            {
              text: "Subscription Renewal Notice",
              time: "Upcoming",
              type: "info" as const,
            },
            {
              text: "New Feature Announcements",
              time: "Just now",
              type: "info" as const,
            },
          ].map((n, i) => (
            <div
              key={i}
              className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50"
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${n.type === "warning" ? "bg-amber-400" : "bg-blue-400"}`}
              />
              <p className="text-sm text-gray-700 flex-1">{n.text}</p>
              <span className="text-xs text-gray-400">{n.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note?: string;
}) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2">
        <div className="text-gray-500">{icon}</div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      {note && <p className="text-xs text-gray-400 mt-0.5 ml-6">{note}</p>}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  bg: string;
  href?: string;
}) {
  const content = (
    <div
      className={`bg-white rounded-lg border shadow-sm p-4 ${href ? "hover:border-gray-300 transition-colors cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          {value === null ? (
            <Skeleton className="h-6 w-12 mt-0.5" />
          ) : (
            <p className="text-xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function SummaryCard({
  label,
  value,
  icon,
  sub,
  subColor,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      {value === null ? (
        <Skeleton className="h-8 w-32 mt-1" />
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && (
            <span
              className={`text-xs font-medium ${subColor || "text-gray-400"}`}
            >
              {sub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AlertPanel({
  title,
  emptyText,
  icon,
}: {
  title: string;
  emptyText: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-gray-400">{emptyText}</p>
      </div>
    </div>
  );
}
