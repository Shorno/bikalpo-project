"use client";

import { ArrowRight, Package, Truck } from "lucide-react";
import Link from "next/link";
import { useActiveOrder } from "@/hooks/use-customer-api";
import { getConsumerPhasePresentation } from "@/lib/consumer-order-presentation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils/currency";

export function OrderStatusButton() {
  const { data, isLoading } = useActiveOrder();
  if (isLoading || !data?.order || !data.journey) return null;

  const { order, journey } = data;
  const presentation = getConsumerPhasePresentation(journey.phase);
  const Icon = journey.phase === "out_for_delivery" ? Truck : Package;

  return (
    <Link
      href={`/account/orders/${order.orderNumber}`}
      className={cn(
        "hidden min-h-10 items-center gap-2 rounded-full border px-3 text-sm outline-none transition-colors hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:flex",
        presentation.badgeClassName,
      )}
      aria-label={`${presentation.label} for order ${order.orderNumber}. View order details.`}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{presentation.label}</span>
      {Number(order.total) > 0 && (
        <>
          <span aria-hidden="true" className="h-4 w-px bg-current opacity-20" />
          <span className="font-semibold tabular-nums">
            {formatPrice(Number(order.total))}
          </span>
        </>
      )}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function MobileOrderStatus() {
  const { data, isLoading } = useActiveOrder();
  if (isLoading || !data?.order || !data.journey) return null;

  const { order, journey } = data;
  const presentation = getConsumerPhasePresentation(journey.phase);
  const Icon = journey.phase === "out_for_delivery" ? Truck : Package;

  return (
    <Link
      href={`/account/orders/${order.orderNumber}`}
      className={cn(
        "flex min-h-9 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:hidden",
        presentation.badgeClassName,
      )}
      aria-label={`${presentation.label}. View order ${order.orderNumber}.`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{presentation.label}</span>
    </Link>
  );
}
