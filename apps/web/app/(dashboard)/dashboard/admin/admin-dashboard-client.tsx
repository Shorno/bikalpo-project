"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Bike,
  ClipboardList,
  DollarSign,
  FileText,
  Package,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { orpc } from "@/utils/orpc";

const ADMIN_BASE = "/dashboard/admin";

const quickActions = [
  {
    title: "Orders",
    description: "Manage customer orders",
    href: `${ADMIN_BASE}/orders`,
    icon: ShoppingCart,
    color: "bg-blue-500",
  },
  {
    title: "Invoices",
    description: "View and manage invoices",
    href: `${ADMIN_BASE}/invoices`,
    icon: FileText,
    color: "bg-green-500",
  },
  {
    title: "Delivery",
    description: "Track delivery groups",
    href: `${ADMIN_BASE}/delivery`,
    icon: Truck,
    color: "bg-orange-500",
  },
  {
    title: "Customers",
    description: "Manage customer accounts",
    href: `${ADMIN_BASE}/customers`,
    icon: Users,
    color: "bg-purple-500",
  },
  {
    title: "Products",
    description: "Manage product catalog",
    href: `${ADMIN_BASE}/products`,
    icon: Package,
    color: "bg-pink-500",
  },
  {
    title: "Estimates",
    description: "Review estimates",
    href: `${ADMIN_BASE}/estimates`,
    icon: ClipboardList,
    color: "bg-cyan-500",
  },
  {
    title: "Returns",
    description: "Process returns",
    href: `${ADMIN_BASE}/returns`,
    icon: RotateCcw,
    color: "bg-red-500",
  },
  {
    title: "Stock",
    description: "Inventory management",
    href: `${ADMIN_BASE}/stock`,
    icon: Warehouse,
    color: "bg-amber-500",
  },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export function AdminDashboardClient() {
  // Use ORPC for dashboard stats
  const { data, isLoading } = useQuery({
    ...orpc.dashboard.getStats.queryOptions(),
    refetchInterval: 60000, // Refresh every minute
  });

  const stats = data?.stats;

  // Format date for header
  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${ADMIN_BASE}/employee-performance`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            Performance
          </Link>
        </div>
      </div>

      {/* Key Metrics - Simple compact design */}
      <div className="grid gap-2 sm:gap-3 grid-cols-3 sm:grid-cols-6">
        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-l-4 border-l-blue-500 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Orders
            </p>
            <p className="text-base sm:text-xl font-bold">
              {isLoading ? "..." : stats?.ordersToday || 0}
            </p>
          </div>
          <ShoppingCart className="h-4 w-4 text-blue-500 shrink-0 hidden sm:block" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-l-4 border-l-amber-500 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Pending
            </p>
            <p className="text-base sm:text-xl font-bold text-amber-600">
              {isLoading ? "..." : stats?.pendingOrders || 0}
            </p>
          </div>
          <Package className="h-4 w-4 text-amber-500 shrink-0 hidden sm:block" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-l-4 border-l-purple-500 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Unassigned
            </p>
            <p className="text-base sm:text-xl font-bold text-purple-600">
              {isLoading ? "..." : stats?.pendingInvoices || 0}
            </p>
          </div>
          <FileText className="h-4 w-4 text-purple-500 shrink-0 hidden sm:block" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-l-4 border-l-orange-500 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Active
            </p>
            <p className="text-base sm:text-xl font-bold text-orange-600">
              {isLoading ? "..." : stats?.activeDeliveries || 0}
            </p>
          </div>
          <Bike className="h-4 w-4 text-orange-500 shrink-0 hidden sm:block" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-l-4 border-l-green-500 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Delivered
            </p>
            <p className="text-base sm:text-xl font-bold text-green-600">
              {isLoading ? "..." : stats?.deliveriesToday || 0}
            </p>
          </div>
          <Truck className="h-4 w-4 text-green-500 shrink-0 hidden sm:block" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-l-4 border-l-emerald-500 bg-muted/30">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Revenue
            </p>
            <p className="text-base sm:text-xl font-bold text-emerald-600">
              {isLoading
                ? "..."
                : `৳${((stats?.totalRevenue || 0) / 1000).toFixed(0)}k`}
            </p>
          </div>
          <DollarSign className="h-4 w-4 text-emerald-500 shrink-0 hidden sm:block" />
        </div>
      </div>
      {/* Quick Actions Grid - No card wrapper */}
      <div className="space-y-2 sm:space-y-3">
        <h2 className="text-sm sm:text-base font-semibold">Quick Actions</h2>
        <div className="grid gap-2 sm:gap-3 grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-muted/30 hover:bg-accent transition-all"
            >
              <div
                className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-md sm:rounded-lg ${action.color} text-white`}
              >
                <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 text-center sm:text-left">
                <p className="font-medium text-[10px] sm:text-sm truncate">
                  {action.title}
                </p>
                <p className="text-xs text-muted-foreground truncate hidden lg:block">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0 hidden sm:block" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Orders - No card wrapper */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-semibold">Recent Orders</h2>
          <Link
            href={`${ADMIN_BASE}/orders`}
            className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : !stats?.recentOrders?.length ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No orders yet
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`${ADMIN_BASE}/orders/${order.id}`}
                className="flex items-center justify-between p-2 sm:p-3 rounded-lg border bg-muted/30 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                    #{order.orderNumber.slice(-4)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">
                      {order.customerName}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] sm:text-xs ${statusColors[order.status] || ""}`}
                  >
                    {order.status}
                  </Badge>
                  <span className="font-semibold text-xs sm:text-sm">
                    ৳{order.total.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Additional Navigation Links - No card wrapper */}
      <div className="grid gap-2 sm:gap-3 grid-cols-3">
        <Link
          href={`${ADMIN_BASE}/deliverymen`}
          className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-muted/30 hover:bg-accent transition-all"
        >
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-orange-100">
            <Bike className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
          </div>
          <div className="text-center sm:text-left">
            <p className="font-medium text-[10px] sm:text-sm">Deliverymen</p>
          </div>
        </Link>

        <Link
          href={`${ADMIN_BASE}/salesmen`}
          className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-muted/30 hover:bg-accent transition-all"
        >
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-100">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <div className="text-center sm:text-left">
            <p className="font-medium text-[10px] sm:text-sm">Salesmen</p>
          </div>
        </Link>

        <Link
          href={`${ADMIN_BASE}/sales-reports`}
          className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-muted/30 hover:bg-accent transition-all"
        >
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-emerald-100">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
          </div>
          <div className="text-center sm:text-left">
            <p className="font-medium text-[10px] sm:text-sm">Reports</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
