/**
 * ORPC-powered My Orders page – lists customer orders via ORPC.
 */
"use client";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Package,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCancelOrder, useMyOrders } from "@/hooks/use-customer-api";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    color: "text-blue-700",
    bg: "bg-blue-50",
    icon: Package,
  },
  shipped: {
    label: "Shipped",
    color: "text-purple-700",
    bg: "bg-purple-50",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    color: "text-green-700",
    bg: "bg-green-50",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-700",
    bg: "bg-red-50",
    icon: XCircle,
  },
};

export function OrpcMyOrders() {
  const { data, isLoading, isError } = useMyOrders();
  type CustomerOrder = NonNullable<typeof data>["orders"][number];
  const cancelOrder = useCancelOrder();
  const [activeTab, setActiveTab] = useState("all");

  if (isLoading) return <OrdersListSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Unable to load orders
        </h3>
        <p className="text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const orders = data?.orders ?? [];

  const filteredOrders =
    activeTab === "all" ? orders : orders.filter((o) => o.status === activeTab);

  const formatPrice = (price: number | string) =>
    `৳${Number(price).toLocaleString("en-BD")}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track and manage your orders
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
          {[
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
          ].map((status) => {
            const count = orders.filter((o) => o.status === status).length;
            if (count === 0) return null;
            return (
              <TabsTrigger key={status} value={status}>
                {STATUS_CONFIG[status]?.label || status} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                No orders found
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {activeTab === "all"
                  ? "You haven't placed any orders yet."
                  : `No ${activeTab} orders.`}
              </p>
              <Button asChild variant="outline">
                <Link href="/products">Browse Products</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order: CustomerOrder) => {
                const cfg =
                  STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const StatusIcon = cfg.icon;
                return (
                  <Link
                    key={order.id}
                    href={`/order-confirmation/${order.orderNumber}`}
                    className="block bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
                        <span className="font-semibold text-gray-900">
                          #{order.orderNumber}
                        </span>
                      </div>
                      <Badge
                        className={`${cfg.bg} ${cfg.color} border-0 text-xs capitalize`}
                      >
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-500">
                        <span>
                          {order.items.length || "–"} item
                          {(order.items.length || 0) !== 1 ? "s" : ""}
                        </span>
                        <span className="mx-1.5">·</span>
                        <span>
                          {order.createdAt
                            ? formatDistanceToNow(new Date(order.createdAt), {
                                addSuffix: true,
                              })
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {formatPrice(order.total || 0)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    {/* Cancel button for pending orders */}
                    {order.status === "pending" && (
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm("Cancel this order?")) {
                              cancelOrder.mutate({ orderId: order.id });
                            }
                          }}
                          disabled={cancelOrder.isPending}
                        >
                          {cancelOrder.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          Cancel Order
                        </Button>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrdersListSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-32 mb-1" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
