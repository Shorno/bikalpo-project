import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  FileQuestion,
  Package,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { getAccountOverview } from "@/actions/account/get-account-overview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function AccountOverviewPage() {
  const result = await getAccountOverview();

  if (!result.success || !result.data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">Failed to load</h3>
        <p className="text-sm text-gray-500 mt-1">
          Unable to load account overview
        </p>
      </div>
    );
  }

  const {
    totalOrders,
    pendingOrders,
    completedOrders,
    totalSpent,
    itemRequestsCount,
    recentOrders,
    userName,
  } = result.data;

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
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {formatPrice(totalSpent.toString())}
          </p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <p className="text-sm text-gray-500">Your last 5 orders</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/account/orders">
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
            {recentOrders.map((order) => {
              const statusStyle = getStatusColor(order.status);
              return (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.orderNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}{" "}
                        •{" "}
                        {formatDistanceToNow(new Date(order.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatPrice(order.total)}
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/account/orders"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-200 hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">My Orders</p>
            <p className="text-sm text-gray-500">Track and manage orders</p>
          </div>
        </Link>

        <Link
          href="/account/requests"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <FileQuestion className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Item Requests</p>
            <p className="text-sm text-gray-500">
              Request unavailable products
            </p>
          </div>
          {itemRequestsCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
              {itemRequestsCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
