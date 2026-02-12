/**
 * Client component for order details using Customer API
 */
"use client";

import { useOrderByNumber } from "@/hooks/use-customer-api";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";
import { useEffect } from "react";

interface OrderDetailClientProps {
  orderNumber: string;
}

export function OrderDetailClient({ orderNumber }: OrderDetailClientProps) {
  const { data, isLoading, isError } = useOrderByNumber(orderNumber);

  useEffect(() => {
    if (isError) {
      notFound();
    }
  }, [isError]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="bg-white rounded-lg border p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!data?.order) {
    return null;
  }

  const { order } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Order #{order.orderNumber}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Placed on {new Date(order.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Order Status */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Order Status</h2>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {order.status}
          </span>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Order Items</h2>
        <div className="space-y-4">
          {order.items?.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center gap-4 pb-4 border-b last:border-0"
            >
              <div className="flex-1">
                <h3 className="font-medium">{item.productName}</h3>
                <p className="text-sm text-gray-500">
                  Quantity: {item.quantity}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  ৳{Number(item.totalPrice).toLocaleString("en-BD")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping Address */}
      {order.shippingAddress && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
          <div className="text-sm text-gray-600">
            <p className="font-medium">{order.shippingAddress}</p>
          </div>
        </div>
      )}
    </div>
  );
}
