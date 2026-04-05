"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BoxIcon,
  CheckCircle2,
  Clock,
  InboxIcon,
  Loader2,
  MapPin,
  Package,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  Truck,
  User,
  Users,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

/* ------------------------------------------------------------------ */
/*  Dashboard Page                                                     */
/* ------------------------------------------------------------------ */

export default function WarehouseDashboardPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const user = session?.user as any;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["warehouse", "getDashboardStats"],
    queryFn: () => orpc.warehouse.getDashboardStats.call({}),
  });

  const [showAnnouncement, setShowAnnouncement] = useState(true);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Warehouse Dashboard
        </h1>
        <span className="text-sm text-gray-500">
          Showing statistics for: <span className="font-medium text-gray-700">Today</span>
        </span>
      </div>

      {/* Warehouse Info + Trial Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Warehouse Info */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <Warehouse className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              {sessionLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {user?.warehouseName || user?.name || "Rahim Distribution Center"}
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  </h2>
                  <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      {user?.name || "—"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {user?.warehouseAddress || "Not set"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trial / Subscription Banner */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-sm p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-200" />
              <span className="text-xs font-medium text-blue-200">Subscription</span>
            </div>
            <p className="text-sm font-medium">Trial ends in <span className="text-lg font-bold">10 days</span></p>
            <p className="text-xs text-blue-200 mt-0.5">Renewal date: 04 Feb 2026</p>
          </div>
          <Button
            size="sm"
            className="mt-3 bg-white text-blue-700 hover:bg-blue-50 font-medium text-xs h-8"
          >
            Buy a Plan
          </Button>
        </div>
      </div>

      {/* Announcement */}
      {showAnnouncement && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              New Warehouse Features Available
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Improved stock management and delivery tracking now live.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
              Explore Now
            </Button>
            <button onClick={() => setShowAnnouncement(false)} className="p-1 rounded hover:bg-amber-100 transition-colors">
              <X className="w-4 h-4 text-amber-600" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  SUPPLY & ORDER STATUS                                           */}
      {/* ================================================================ */}
      <SectionHeader icon={<Truck className="w-4 h-4" />} title="Supply & Order Status" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<InboxIcon className="w-5 h-5 text-blue-600" />} label="Orders Today" value={statsLoading ? null : String(stats?.totalOrders ?? 0)} bg="bg-blue-50" href="/warehouse/dashboard/supply-orders" />
        <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pending" value={statsLoading ? null : String(stats?.pendingOrders ?? 0)} bg="bg-amber-50" href="/warehouse/dashboard/supply-orders" />
        <StatCard icon={<Loader2 className="w-5 h-5 text-purple-600" />} label="Processing" value={statsLoading ? null : "0"} bg="bg-purple-50" />
        <StatCard icon={<ShoppingBag className="w-5 h-5 text-emerald-600" />} label="Delivered" value={statsLoading ? null : String(stats?.deliveredOrders ?? 0)} bg="bg-emerald-50" />
      </div>

      {/* ================================================================ */}
      {/*  PURCHASE SUMMARY                                                */}
      {/* ================================================================ */}
      <SectionHeader icon={<ShoppingBag className="w-4 h-4" />} title="Purchase Summary" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Net Purchase" value={statsLoading ? null : `৳${(stats?.totalRevenue ?? 0).toLocaleString()}`} icon={<TrendingUp className="w-4 h-4 text-gray-400" />} />
        <SummaryCard label="Total Purchase" value={statsLoading ? null : "৳0"} icon={<ShoppingBag className="w-4 h-4 text-gray-400" />} />
        <SummaryCard label="Purchase Return" value={statsLoading ? null : "0"} icon={<Package className="w-4 h-4 text-gray-400" />} />
      </div>

      {/* ================================================================ */}
      {/*  TEAM PERFORMANCE TABLES                                         */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Team */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Sales Team Performance
            </h3>
            <Link href="/warehouse/dashboard/sales-team" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Salesman</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Orders</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Sales</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Target</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { name: "Rahim Ahmed", orders: 0, sales: 0, target: 0 },
                  { name: "Karim Hossain", orders: 0, sales: 0, target: 0 },
                  { name: "Rony Islam", orders: 0, sales: 0, target: 0 },
                ].map((s) => (
                  <tr key={s.name} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{s.orders}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">৳{s.sales.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">৳{s.target.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{s.target ? Math.round((s.sales / s.target) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t bg-gray-50/50">
            <p className="text-xs text-gray-500">Top Salesman Today: <span className="font-medium text-gray-700">None</span></p>
          </div>
        </div>

        {/* Delivery Team */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-500" />
              Delivery Team Performance
            </h3>
            <Link href="/warehouse/dashboard/delivery-team" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Delivery Man</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Deliveries</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Completed</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Pending</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { name: "Hasan Ali", deliveries: 0, completed: 0, pending: 0 },
                  { name: "Jamil Hossain", deliveries: 0, completed: 0, pending: 0 },
                  { name: "Sohel Rana", deliveries: 0, completed: 0, pending: 0 },
                ].map((d) => (
                  <tr key={d.name} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{d.deliveries}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{d.completed}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{d.pending}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{d.deliveries ? Math.round((d.completed / d.deliveries) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t bg-gray-50/50">
            <p className="text-xs text-gray-500">Best Delivery Agent Today: <span className="font-medium text-gray-700">None</span></p>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  NETWORK OVERVIEW                                                */}
      {/* ================================================================ */}
      <SectionHeader icon={<Store className="w-4 h-4" />} title="Network Overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Store className="w-5 h-5 text-blue-600" />} label="Connected Stores" value="0" bg="bg-blue-50" href="/warehouse/dashboard/connected-stores" />
        <StatCard icon={<Users className="w-5 h-5 text-emerald-600" />} label="Active Suppliers" value="0" bg="bg-emerald-50" href="/warehouse/dashboard/suppliers" />
        <StatCard icon={<Package className="w-5 h-5 text-purple-600" />} label="Supply Products" value={statsLoading ? null : String(stats?.totalProducts ?? 0)} bg="bg-purple-50" href="/warehouse/dashboard/products" />
        <StatCard icon={<BoxIcon className="w-5 h-5 text-amber-600" />} label="Total SKU" value="0" bg="bg-amber-50" />
      </div>

      {/* ================================================================ */}
      {/*  ALERT PANELS                                                    */}
      {/* ================================================================ */}
      <SectionHeader icon={<AlertTriangle className="w-4 h-4" />} title="Alerts" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AlertPanel title="Low Stock Products" emptyText="No low stock products found" icon={<AlertTriangle className="w-4 h-4 text-red-500" />} />
        <AlertPanel title="Top Stores" emptyText="No store data available" icon={<Star className="w-4 h-4 text-amber-500" />} />
        <AlertPanel title="Top Categories" emptyText="No category data available" icon={<Package className="w-4 h-4 text-blue-500" />} />
      </div>

      {/* ================================================================ */}
      {/*  SYSTEM NOTIFICATIONS                                            */}
      {/* ================================================================ */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">System Notifications</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { text: "New Store Request", time: "Just now", type: "info" as const },
            { text: "Supply Order Pending", time: "5 min ago", type: "warning" as const },
            { text: "Inventory Alert", time: "1 hour ago", type: "alert" as const },
          ].map((n, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50">
              <div className={`w-2 h-2 rounded-full shrink-0 ${n.type === "alert" ? "bg-red-400" : n.type === "warning" ? "bg-amber-400" : "bg-blue-400"}`} />
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

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="text-gray-500">{icon}</div>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
    </div>
  );
}

function StatCard({
  icon, label, value, bg, href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  bg: string;
  href?: string;
}) {
  const content = (
    <div className={`bg-white rounded-lg border shadow-sm p-4 ${href ? "hover:border-gray-300 transition-colors cursor-pointer" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
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
  label, value, icon,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
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
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  );
}

function AlertPanel({
  title, emptyText, icon,
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
