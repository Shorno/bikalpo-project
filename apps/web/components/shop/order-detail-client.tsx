/**
 * Client component for order detail view (from orders list)
 */
"use client";

import { format } from "date-fns";
import { ArrowLeft, MapPin, Package, Phone, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderByNumber } from "@/hooks/use-customer-api";

interface OrderDetailClientProps {
  orderNumber: string;
}

const statusConfig: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  pending: { color: "text-yellow-700", bg: "bg-yellow-50", label: "Pending" },
  confirmed: { color: "text-blue-700", bg: "bg-blue-50", label: "Confirmed" },
  processing: {
    color: "text-purple-700",
    bg: "bg-purple-50",
    label: "Processing",
  },
  out_for_delivery: {
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    label: "Out for Delivery",
  },
  delivered: { color: "text-green-700", bg: "bg-green-50", label: "Delivered" },
  cancelled: { color: "text-red-700", bg: "bg-red-50", label: "Cancelled" },
};

const paymentMethodLabels: Record<string, string> = {
  cash_on_delivery: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank Transfer",
};

const formatPrice = (price: string | number) => {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
};

function OrderDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

export function OrderDetailClient({ orderNumber }: OrderDetailClientProps) {
  const { data, isLoading, isError } = useOrderByNumber(orderNumber);
  type OrderItem = NonNullable<
    NonNullable<typeof data>["order"]
  >["items"][number];

  useEffect(() => {
    if (isError) {
      notFound();
    }
  }, [isError]);

  if (isLoading) return <OrderDetailSkeleton />;
  if (!data?.order) return null;

  const { order } = data;
  const config = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/account/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Order #{order.orderNumber}
            </h1>
            <p className="text-sm text-gray-500">
              Placed on {format(new Date(order.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <Badge
          className={`${config.bg} ${config.color} border-0 text-sm shrink-0`}
        >
          {config.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Items — Left */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Order Items ({order.items?.length || 0})
            </h2>
          </div>

          <div className="divide-y divide-gray-50">
            {order.items?.map((item: OrderItem) => (
              <div key={item.id} className="flex items-center gap-4 p-4">
                <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                  <Image
                    src={item.productImage || "/placeholder.png"}
                    alt={item.productName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {item.productName}
                  </p>
                  {item.productSize && (
                    <p className="text-xs text-gray-500">
                      Pack: {item.productSize}
                    </p>
                  )}
                  <p className="text-sm text-gray-500">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold text-gray-900 shrink-0">
                  {formatPrice(item.totalPrice)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">
                  {formatPrice(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className="text-gray-900">
                  {Number(order.shippingCost) === 0
                    ? "Free"
                    : formatPrice(order.shippingCost)}
                </span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-600">
                    -{formatPrice(order.discount)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between pt-1">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-lg text-emerald-600">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column — Shipping & Payment */}
        <div className="space-y-4">
          {/* Payment Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Payment
            </h3>
            <p className="text-sm text-gray-700 font-medium">
              {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
            </p>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Shipping Address
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-700 font-medium">
                  {order.shippingName}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div className="text-gray-600">
                  <p>{order.shippingAddress}</p>
                  <p>
                    {[
                      order.shippingArea,
                      order.shippingCity,
                      order.shippingPostalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-600">{order.shippingPhone}</span>
              </div>
            </div>
          </div>

          {/* Customer Note */}
          {order.customerNote && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                Your Note
              </p>
              <p className="text-sm text-amber-700">{order.customerNote}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              asChild
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Link href="/account/track">
                <Package className="h-4 w-4" />
                Track Order
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
