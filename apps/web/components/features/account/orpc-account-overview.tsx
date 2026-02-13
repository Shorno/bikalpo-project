/**
 * ORPC-powered Account Overview – dashboard stats and recent orders
 * via ORPC hooks. Client component replacement for the server-action version.
 */
"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Package,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyOrders, useProfile } from "@/hooks/use-customer-api";

function getStatusColor(status: string) {
  switch (status) {
    case "pending":
      return { color: "text-yellow-700", bg: "bg-yellow-50" };
    case "delivered":
      return { color: "text-green-700", bg: "bg-green-50" };
    case "cancelled":
      return { color: "text-red-700", bg: "bg-red-50" };
    case "processing":
    case "confirmed":
      return { color: "text-blue-700", bg: "bg-blue-50" };
    case "shipped":
      return { color: "text-purple-700", bg: "bg-purple-50" };
    default:
      return { color: "text-gray-700", bg: "bg-gray-50" };
  }
}

export function OrpcAccountOverview() {
  const { data: ordersData, isLoading: ordersLoading } = useMyOrders();
  const { data: profileData, isLoading: profileLoading } = useProfile();

  const isLoading = ordersLoading || profileLoading;

  if (isLoading) return <AccountOverviewSkeleton />;

  const orders = ordersData?.orders ?? [];
  const profile = profileData?.profile;

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o: any) =>
      o.status === "pending" ||
      o.status === "confirmed" ||
      o.status === "processing",
  ).length;
  const completedOrders = orders.filter(
    (o: any) => o.status === "delivered",
  ).length;
  const totalSpent = orders.reduce(
    (sum: number, o: any) => sum + Number(o.totalAmount || o.total || 0),
    0,
  );

  const recentOrders = orders.slice(0, 5);
  const userName = profile?.ownerName || profile?.name || "there";

  const formatPrice = (price: number) => `৳${price.toLocaleString("en-BD")}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {userName}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Here&apos;s an overview of your account activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Orders"
          value={totalOrders}
          icon={ShoppingBag}
          iconColor="text-gray-400"
        />
        <StatCard
          label="Pending"
          value={pendingOrders}
          icon={Clock}
          iconColor="text-yellow-500"
          valueColor="text-yellow-600"
        />
        <StatCard
          label="Completed"
          value={completedOrders}
          icon={CheckCircle}
          iconColor="text-green-500"
          valueColor="text-green-600"
        />
        <StatCard
          label="Total Spent"
          value={formatPrice(totalSpent)}
          icon={TrendingUp}
          iconColor="text-emerald-500"
          valueColor="text-emerald-600"
        />
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <p className="text-sm text-gray-500">Your last 5 orders</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/customer/account/orders">
              View All
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900">No orders yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Start shopping to see your orders here
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/products">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order: any) => {
              const statusStyle = getStatusColor(order.status);
              return (
                <Link
                  key={order.id}
                  href={`/order-confirmation/${order.orderNumber}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        #{order.orderNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        {order.itemCount || "–"} item
                        {(order.itemCount || 0) !== 1 ? "s" : ""} ·{" "}
                        {order.createdAt
                          ? formatDistanceToNow(new Date(order.createdAt), {
                              addSuffix: true,
                            })
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatPrice(
                        Number(order.totalAmount || order.total || 0),
                      )}
                    </p>
                    <Badge
                      className={`${statusStyle.bg} ${statusStyle.color} border-0 text-xs capitalize`}
                    >
                      {order.status}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  valueColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className={`text-2xl font-bold ${valueColor || "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function AccountOverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-56 mb-1" />
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border rounded-lg p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
