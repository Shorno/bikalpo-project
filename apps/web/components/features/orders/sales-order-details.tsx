"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  Phone,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getOrderById } from "@/actions/order/admin-order-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SALES_BASE } from "@/lib/routes";
import { formatPrice } from "@/utils/currency";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-32" />
    </div>
  );
}

const orderStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-700", label: "Pending" },
  confirmed: { color: "bg-blue-100 text-blue-700", label: "Confirmed" },
  processing: { color: "bg-indigo-100 text-indigo-700", label: "Processing" },
  shipped: { color: "bg-purple-100 text-purple-700", label: "Shipped" },
  delivered: { color: "bg-green-100 text-green-700", label: "Delivered" },
  cancelled: { color: "bg-red-100 text-red-700", label: "Cancelled" },
};

const paymentStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-orange-100 text-orange-700", label: "Pending" },
  paid: { color: "bg-green-100 text-green-700", label: "Paid" },
  failed: { color: "bg-red-100 text-red-700", label: "Failed" },
  refunded: { color: "bg-gray-100 text-gray-700", label: "Refunded" },
};

export function SalesOrderDetails({ orderId }: { orderId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const result = await getOrderById(orderId);
      if (!result.success) throw new Error(result.error);
      return result.order;
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
        <Package className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-base font-semibold">Order not found</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This order may have been removed or doesn't exist.
        </p>
        <Button asChild className="mt-4" size="sm">
          <Link href={`${SALES_BASE}/customers`}>Back to Customers</Link>
        </Button>
      </div>
    );
  }

  const order = data;
  const statusConfig =
    orderStatusConfig[order.status] || orderStatusConfig.pending;
  const paymentConfig =
    paymentStatusConfig[order.paymentStatus] || paymentStatusConfig.pending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href={`${SALES_BASE}/customers`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold">
            Order {order.orderNumber}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant="secondary"
              className={`text-xs ${statusConfig.color}`}
            >
              {statusConfig.label}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-xs ${paymentConfig.color}`}
            >
              {paymentConfig.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold">
              {formatPrice(order.total)}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold">
              {order.items?.length || 0}
            </p>
            <p className="text-xs text-muted-foreground">Items</p>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 text-center">
            <p className="text-sm font-medium truncate">
              {order.user?.shopName || order.user?.name || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Customer</p>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 text-center">
            <p className="text-sm font-medium">
              {format(new Date(order.createdAt), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">Order Date</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer & Shipping - Compact Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Customer Info */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Customer</span>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.user?.shopName || "—"}</p>
            <p className="text-muted-foreground">{order.user?.name || "—"}</p>
            {order.user?.phoneNumber && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{order.user.phoneNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Shipping Info */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Shipping</span>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.shippingName}</p>
            <p className="text-muted-foreground">{order.shippingAddress}</p>
            <p className="text-muted-foreground">
              {order.shippingCity}
              {order.shippingArea && `, ${order.shippingArea}`}
            </p>
            {order.shippingPhone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{order.shippingPhone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="border rounded-lg">
        <div className="flex items-center gap-2 p-3 border-b">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Order Items</span>
        </div>
        <div className="divide-y">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.productName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatPrice(item.unitPrice)}
                  {item.productSize && ` • ${item.productSize}`}
                </p>
              </div>
              <p className="text-sm font-semibold">
                {formatPrice(item.totalPrice)}
              </p>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="border-t p-3 space-y-1.5 bg-muted/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span>{formatPrice(order.shippingCost)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Order Timeline - Compact */}
      <div className="border rounded-lg">
        <div className="flex items-center gap-2 p-3 border-b">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Timeline</span>
        </div>
        <div className="p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Placed</span>
            <span>
              {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}
            </span>
          </div>
          {order.confirmedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confirmed</span>
              <span>
                {format(new Date(order.confirmedAt), "MMM d, yyyy h:mm a")}
              </span>
            </div>
          )}
          {order.shippedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipped</span>
              <span>
                {format(new Date(order.shippedAt), "MMM d, yyyy h:mm a")}
              </span>
            </div>
          )}
          {order.deliveredAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivered</span>
              <span>
                {format(new Date(order.deliveredAt), "MMM d, yyyy h:mm a")}
              </span>
            </div>
          )}
          {order.cancelledAt && (
            <div className="flex justify-between text-red-600">
              <span>Cancelled</span>
              <span>
                {format(new Date(order.cancelledAt), "MMM d, yyyy h:mm a")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notes - Compact */}
      {(order.customerNote || order.adminNote) && (
        <div className="border rounded-lg p-3 space-y-3">
          <span className="text-sm font-semibold">Notes</span>
          {order.customerNote && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Customer Note
              </p>
              <p className="text-sm mt-0.5">{order.customerNote}</p>
            </div>
          )}
          {order.adminNote && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Admin Note
              </p>
              <p className="text-sm mt-0.5">{order.adminNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
