"use client";

import { format } from "date-fns";
import { Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getConsumerPhasePresentation } from "@/lib/consumer-order-presentation";
import { formatPrice } from "@/utils/currency";
import type { ConsumerOrder } from "./order-tabs";

interface OrderCardProps {
  order: ConsumerOrder;
}

export function OrderCard({ order }: OrderCardProps) {
  const itemCount = order.items.length;
  const presentation = getConsumerPhasePresentation(order.journey.phase);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-blue-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        {/* Top row: Order number and status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 truncate">
            Order #{order.orderNumber.replace("ORD-", "")}
          </h3>
          <Badge
            variant="outline"
            className={`${presentation.badgeClassName} shrink-0 text-xs`}
          >
            {presentation.label}
          </Badge>
        </div>

        {/* Bottom row: Date, Total, and Action */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <span>{format(new Date(order.createdAt), "MMM d, yyyy")}</span>
            <span>•</span>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span>•</span>
            <span className="font-semibold text-gray-900">
              {formatPrice(order.total)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {order.journey.phase === "delivered" && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              >
                <Link href={`/reorder/${order.id}`}>Reorder</Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            >
              <Link href={`/account/orders/${order.orderNumber}`}>Details</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Delivery Info */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-sm text-gray-600">
        <span className="text-gray-500">Deliver to: </span>
        <span className="font-medium text-gray-900">
          {order.shippingAddress}, {order.shippingCity}
          {order.shippingPostalCode && ` - ${order.shippingPostalCode}`}
        </span>
        {order.deliveredAt && (
          <>
            <span className="mx-2">•</span>
            <span className="text-green-600 font-medium">
              Delivered: {format(new Date(order.deliveredAt), "MMM d, yyyy")}
            </span>
          </>
        )}
      </div>

      {/* Items List - Horizontal Flex */}
      {itemCount > 0 && (
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100"
            >
              <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden shrink-0 flex items-center justify-center">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate max-w-[120px]">
                  {item.productName}
                </p>
                <p className="text-[10px] text-gray-500">×{item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
