"use client";

import { format } from "date-fns";
import { Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrderWithItems } from "@/db/schema/order";
import { formatPrice } from "@/utils/currency";

interface OrderCardProps {
  order: OrderWithItems;
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
  delivered: { color: "text-green-700", bg: "bg-green-50", label: "Delivered" },
  cancelled: { color: "text-red-700", bg: "bg-red-50", label: "Cancelled" },
};

export function OrderCard({ order }: OrderCardProps) {
  const itemCount = order.items.length;
  const config = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-300 transition-all">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        {/* Top row: Order number and status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 truncate">
            Order #{order.orderNumber.replace("ORD-", "")}
          </h3>
          <Badge
            className={`${config.bg} ${config.color} border-0 text-xs shrink-0`}
          >
            {config.label}
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
            {order.status === "delivered" && (
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
              className="shrink-0 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Link href={`/account/orders/${order.id}`}>Details</Link>
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
