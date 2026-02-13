/**
 * Client component for customer orders using Customer API
 */
"use client";

import { OrderTabs } from "@/components/account/order-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyOrders } from "@/hooks/use-customer-api";

export function OrdersClient() {
  const { data, isLoading, isError } = useMyOrders();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load orders</p>
      </div>
    );
  }

  const orders = data?.orders || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track and manage your orders
        </p>
      </div>

      <OrderTabs orders={orders} />
    </div>
  );
}
