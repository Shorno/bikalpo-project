/**
 * Client component for customer account overview using Customer API
 */
"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Package,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyOrders, useProfile } from "@/hooks/use-customer-api";
import { formatPrice } from "@/utils/currency";

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

export function AccountOverviewClient() {
  const { data: ordersData, isLoading: ordersLoading } = useMyOrders();
  const { data: profileData, isLoading: profileLoading } = useProfile();
  type CustomerOrder = NonNullable<typeof ordersData>["orders"][number];

  const isLoading = ordersLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const orders = ordersData?.orders || [];
  const userName =
    profileData?.profile?.businessName ||
    profileData?.profile?.ownerName ||
    "User";

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const completedOrders = orders.filter((o) => o.status === "delivered").length;
  const totalSpent = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {userName}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Here's an overview of your account activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Pending</span>
            <Clock className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{pendingOrders}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Completed</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{completedOrders}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Spent</span>
            <Package className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {formatPrice(totalSpent)}
          </p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/shop/account/orders">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
        <div className="divide-y divide-gray-200">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            recentOrders.map((order: CustomerOrder) => {
              const statusStyle = getStatusColor(order.status);
              return (
                <Link
                  key={order.id}
                  href={`/shop/account/orders/${order.orderNumber}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          #{order.orderNumber}
                        </span>
                        <Badge
                          className={`${statusStyle.bg} ${statusStyle.color} border-0 text-xs`}
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(order.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatPrice(Number(order.total))}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
