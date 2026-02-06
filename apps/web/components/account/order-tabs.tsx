"use client";

import { CheckCircle, Clock, List, Package, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OrderWithItems } from "@/db/schema/order";
import { OrderCard } from "./order-card";

interface OrderTabsProps {
  orders: OrderWithItems[];
}

function filterOrders(orders: OrderWithItems[], status: string) {
  switch (status) {
    case "pending":
      return orders.filter((order) => order.status === "pending");
    case "active":
      // Active orders: confirmed or processing (in progress, not yet delivered)
      return orders.filter((order) =>
        ["confirmed", "processing"].includes(order.status),
      );
    case "delivered":
      return orders.filter((order) => order.status === "delivered");
    case "cancelled":
      return orders.filter((order) => order.status === "cancelled");
    case "all":
    default:
      return orders;
  }
}

function OrdersList({ orders }: { orders: OrderWithItems[] }) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No orders found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

export function OrderTabs({ orders }: OrderTabsProps) {
  const counts = {
    all: orders.length,
    pending: filterOrders(orders, "pending").length,
    active: filterOrders(orders, "active").length,
    delivered: filterOrders(orders, "delivered").length,
    cancelled: filterOrders(orders, "cancelled").length,
  };

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="w-full grid grid-cols-5 h-auto p-1 bg-muted/50 mb-6">
        <TabsTrigger
          value="all"
          className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm"
        >
          <List className="size-4" />
          <span className="hidden sm:inline">All</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
            {counts.all}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="pending"
          className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm text-yellow-600 dark:text-yellow-400"
        >
          <Clock className="size-4" />
          <span className="hidden sm:inline">Pending</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
            {counts.pending}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="active"
          className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm text-emerald-600 dark:text-emerald-400"
        >
          <Package className="size-4" />
          <span className="hidden sm:inline">Active</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
            {counts.active}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="delivered"
          className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm text-green-600 dark:text-green-400"
        >
          <CheckCircle className="size-4" />
          <span className="hidden sm:inline">Delivered</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
            {counts.delivered}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="cancelled"
          className="flex items-center gap-1.5 py-2.5 data-[state=active]:shadow-sm text-red-600 dark:text-red-400"
        >
          <XCircle className="size-4" />
          <span className="hidden sm:inline">Cancelled</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted-foreground/20">
            {counts.cancelled}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all">
        <OrdersList orders={filterOrders(orders, "all")} />
      </TabsContent>

      <TabsContent value="pending">
        <OrdersList orders={filterOrders(orders, "pending")} />
      </TabsContent>

      <TabsContent value="active">
        <OrdersList orders={filterOrders(orders, "active")} />
      </TabsContent>

      <TabsContent value="delivered">
        <OrdersList orders={filterOrders(orders, "delivered")} />
      </TabsContent>

      <TabsContent value="cancelled">
        <OrdersList orders={filterOrders(orders, "cancelled")} />
      </TabsContent>
    </Tabs>
  );
}
