"use client";

import { FileCheck2, FileText, Search, Store } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  FulfillmentDesk,
  FulfillmentKpis,
  FulfillmentPanel,
  FulfillmentState,
  FulfillmentStatus,
} from "@/components/features/fulfillment/fulfillment-desk";
import { RETAILER_FULFILLMENT_ADAPTER } from "@/components/features/fulfillment/owner-adapters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRetailDispatchOrders } from "@/hooks/use-shop-owner-api";
import { RetailerDispatchModal } from "./_components/retailer-dispatch-modal";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

export default function RetailDispatchOrdersPage() {
  const [view, setView] = useState<"ready_for_dispatch" | "invoiced">(
    "ready_for_dispatch",
  );
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const query = useRetailDispatchOrders(view, search);
  const orders = query.data?.orders ?? [];
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null;
  const presentationStatus = (order: (typeof orders)[number]) => {
    if (
      order.invoice?.fulfillmentMode === "self_pickup" &&
      order.invoice.deliveryStatus === "pending"
    ) {
      return "ready_for_pickup";
    }
    if (
      order.invoice?.fulfillmentMode === "self_pickup" &&
      order.invoice.deliveryStatus === "delivered"
    ) {
      return "picked_up";
    }
    return order.status;
  };

  return (
    <FulfillmentDesk
      adapter={RETAILER_FULFILLMENT_ADAPTER}
      activeHref="/dashboard/dispatch-orders"
      title="Dispatch Orders"
      description="Turn each approved consumer order into one full invoice. Choose delivery or self pickup here; pickup is completed with a consumer OTP at the shop."
    >
      <FulfillmentKpis
        items={[
          {
            label:
              view === "ready_for_dispatch"
                ? "Awaiting invoice"
                : "Invoiced orders",
            value: orders.length,
            icon: FileText,
            tone: view === "ready_for_dispatch" ? "amber" : "emerald",
          },
          {
            label: "Full invoice only",
            value: "100%",
            icon: FileCheck2,
            tone: "blue",
          },
          {
            label: "Fulfillment options",
            value: query.data?.pickupAvailable ? "2" : "1",
            icon: Store,
            tone: "emerald",
          },
        ]}
      />
      <FulfillmentPanel
        title="Dispatch queue"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-64 pl-9"
                placeholder="Order or recipient"
              />
            </div>
            <Tabs
              value={view}
              onValueChange={(value) => setView(value as typeof view)}
            >
              <TabsList>
                <TabsTrigger value="ready_for_dispatch">Ready</TabsTrigger>
                <TabsTrigger value="invoiced">Invoiced</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      >
        <FulfillmentState
          loading={query.isLoading}
          error={query.isError}
          empty={!query.isLoading && orders.length === 0}
          emptyTitle="Dispatch queue is clear"
        />
        {orders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Delivery Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:underline"
                      href={`/dashboard/incoming-orders/${order.id}`}
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} item lines
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{order.shippingName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.shippingPhone}
                    </p>
                  </TableCell>
                  <TableCell>
                    <FulfillmentStatus status={presentationStatus(order)} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {money.format(Number(order.total))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={
                        order.status === "ready_for_dispatch"
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {order.status === "ready_for_dispatch"
                        ? "Dispatch"
                        : order.invoice?.fulfillmentMode === "self_pickup" &&
                            order.invoice.deliveryStatus !== "delivered"
                          ? "Complete Pickup"
                          : "Review"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </FulfillmentPanel>
      <RetailerDispatchModal
        order={selectedOrder}
        open={!!selectedOrder}
        pickupAvailable={query.data?.pickupAvailable ?? false}
        pickupLocation={query.data?.pickupLocation ?? null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null);
        }}
        onSuccess={() => {
          void query.refetch();
        }}
      />
    </FulfillmentDesk>
  );
}
