"use client";

import { ArrowRight, Package, Truck } from "lucide-react";
import Link from "next/link";
import { useActiveOrder } from "@/hooks/use-customer-api";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils/currency";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    textColor: string;
    bgColor: string;
    badgeBg: string;
    borderColor: string;
    icon?: React.ElementType;
  }
> = {
  pending: {
    label: "Pending",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
    badgeBg: "bg-amber-600",
    borderColor: "border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    textColor: "text-blue-700",
    bgColor: "bg-blue-50",
    badgeBg: "bg-blue-600",
    borderColor: "border-blue-200",
  },
  processing: {
    label: "Processing",
    textColor: "text-purple-700",
    bgColor: "bg-purple-50",
    badgeBg: "bg-purple-600",
    borderColor: "border-purple-200",
  },
  out_for_delivery: {
    label: "On the Way",
    textColor: "text-emerald-700",
    bgColor: "bg-emerald-50",
    badgeBg: "bg-emerald-600",
    borderColor: "border-emerald-200",
    icon: Truck,
  },
};

// Desktop: Pill-shaped status + amount + OTP badge in navbar
export function OrderStatusButton() {
  const { data, isLoading } = useActiveOrder();

  if (isLoading) return null;
  if (!data?.order) return null;

  const order = data.order;
  const deliveryInfo = data.deliveryInfo;

  const displayStatus =
    deliveryInfo?.status === "out_for_delivery"
      ? "out_for_delivery"
      : order.status;

  const config = STATUS_CONFIG[displayStatus] || {
    label: order.status,
    textColor: "text-gray-700",
    bgColor: "bg-gray-50",
    badgeBg: "bg-gray-600",
    borderColor: "border-gray-200",
  };

  const Icon = config.icon || Package;
  const orderTotal = order.total ? Number(order.total) : 0;

  // Standard status display
  return (
    <Link
      href="/customer/account/track"
      className={cn(
        "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all hover:shadow-sm",
        config.bgColor,
        config.borderColor,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4", config.textColor)} />
        <span className={cn("text-sm font-medium", config.textColor)}>
          {config.label}
        </span>
      </div>

      {orderTotal > 0 && (
        <>
          <div className="w-px h-4 bg-gray-300/60" />
          <span className={cn("text-sm font-semibold", config.textColor)}>
            {formatPrice(orderTotal)}
          </span>
        </>
      )}
      <ArrowRight className={cn("h-3.5 w-3.5 ml-0.5", config.textColor)} />
    </Link>
  );
}

// Mobile: Compact status badge for inside the navbar
export function MobileOrderStatus() {
  const { data, isLoading } = useActiveOrder();

  // Don't show anything while loading or if no active order
  if (isLoading || !data?.order) return null;

  const order = data.order;
  const deliveryInfo = data.deliveryInfo;

  const displayStatus =
    deliveryInfo?.status === "out_for_delivery"
      ? "out_for_delivery"
      : order.status;

  const config = STATUS_CONFIG[displayStatus] || {
    label: order.status,
    textColor: "text-gray-700",
    bgColor: "bg-gray-50",
    badgeBg: "bg-gray-600",
    borderColor: "border-gray-200",
  };

  const Icon = config.icon || Package;

  // Standard status - compact icon + label
  return (
    <Link
      href="/customer/account/track"
      className={cn(
        "sm:hidden flex items-center gap-1.5 px-2 py-1 rounded-lg border",
        config.bgColor,
        config.borderColor,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center h-5 w-5 rounded-full",
          config.badgeBg,
        )}
      >
        <Icon className="h-2.5 w-2.5 text-white" />
      </div>
      <span className={cn("text-xs font-medium", config.textColor)}>
        {config.label}
      </span>
    </Link>
  );
}
