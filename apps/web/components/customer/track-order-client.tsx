/**
 * Client component for track order page using Customer API
 */
"use client";

import {
  CheckCircle2,
  Clock,
  KeyRound,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveOrder } from "@/hooks/use-customer-api";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils/currency";

// Order status steps
const ORDER_STEPS = [
  { key: "pending", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Clock },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

function getStepIndex(status: string, deliveryStatus?: string): number {
  if (status === "delivered") return 4;
  if (deliveryStatus === "out_for_delivery" || status === "out_for_delivery") {
    return 3;
  }
  if (status === "processing") return 2;
  if (status === "confirmed") return 1;
  return 0;
}

export function TrackOrderClient() {
  const { data, isLoading } = useActiveOrder();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <Skeleton className="h-10 w-64 mx-auto mb-4" />
        <Skeleton className="h-6 w-96 mx-auto" />
      </div>
    );
  }

  // No active order
  if (!data?.order) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">No Active Order</h3>
        <p className="text-sm text-gray-500 mt-1">
          You don&apos;t have any pending orders to track.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/products">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Start Shopping
          </Link>
        </Button>
      </div>
    );
  }

  const order = data.order;
  const deliveryInfo = data.deliveryInfo;
  const currentStep = getStepIndex(order.status, deliveryInfo?.status);
  const showOtp =
    !!deliveryInfo?.otp && deliveryInfo.status === "out_for_delivery";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">Track Your Order</h2>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>
        <p className="text-sm text-gray-500">Order #{order.orderNumber}</p>
      </div>

      {/* OTP Card - Prominent when out for delivery */}
      {showOtp && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-6">
          <div className="flex items-center gap-2 text-emerald-700 mb-3">
            <KeyRound className="h-5 w-5" />
            <span className="font-semibold">Your Delivery OTP</span>
          </div>
          <p className="text-sm text-emerald-600/80 mb-4">
            Share this code with the delivery person to receive your order.
          </p>
          <div className="flex items-center justify-center bg-white rounded-lg py-5 border-2 border-dashed border-emerald-200">
            <span className="text-4xl font-bold tracking-[0.5em] font-mono text-emerald-600">
              {deliveryInfo.otp}
            </span>
          </div>
          <p className="text-xs text-emerald-600/70 mt-3 text-center font-medium">
            Only share this code when you physically receive your order
          </p>
        </div>
      )}

      {/* Order Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Order Status</h3>
        <div className="relative flex flex-col gap-6">
          {ORDER_STEPS.map((step, index) => {
            const isCompleted = index <= currentStep;
            const isCurrent = index === currentStep;
            const Icon = step.icon;

            return (
              <div
                key={step.key}
                className="flex items-center gap-4 relative z-10"
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-400",
                    isCurrent ? "ring-4 ring-emerald-50" : "",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p
                    className={cn(
                      "font-medium",
                      isCompleted ? "text-gray-900" : "text-gray-400",
                    )}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-emerald-600 font-medium">
                      Currently here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {/* Connector Line */}
          <div
            className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-100 -z-0"
            aria-hidden="true"
          >
            <div
              className="w-full bg-emerald-600 transition-all duration-500"
              style={{
                height: `${(currentStep / (ORDER_STEPS.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Order Items</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex items-center gap-4 p-4">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {item.productName}
                </p>
                <p className="text-sm text-gray-500">
                  {formatPrice(item.unitPrice)} × {item.quantity}
                </p>
              </div>
              <p className="font-semibold text-gray-900">
                {formatPrice(item.totalPrice)}
              </p>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-xl text-emerald-600">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <Button asChild className="w-full">
        <Link href={`/customer/account/orders/${order.id}`}>
          View Full Order Details
        </Link>
      </Button>
    </div>
  );
}
