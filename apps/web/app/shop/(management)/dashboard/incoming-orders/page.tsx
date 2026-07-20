"use client";

import { CheckCircle2, Clock3, PackageCheck, ShoppingBag } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIncomingOrders } from "@/hooks/use-shop-owner-api";

type OrderFilter =
  | "all"
  | "pending"
  | "ready_for_dispatch"
  | "invoiced"
  | "processing"
  | "delivered"
  | "cancelled";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

export default function IncomingOrdersPage() {
  const [status, setStatus] = useState<OrderFilter>("all");
  const [page, setPage] = useState(1);
  const query = useIncomingOrders({ status, page, limit: 20 });
  const orders = query.data?.orders ?? [];
  const pagination = query.data?.pagination;
  const presentationStatus = (order: (typeof orders)[number]) => {
    if (
      order.fulfillment?.fulfillmentMode === "self_pickup" &&
      order.fulfillment.deliveryStatus === "pending"
    ) {
      return "ready_for_pickup";
    }
    if (
      order.fulfillment?.fulfillmentMode === "self_pickup" &&
      order.fulfillment.deliveryStatus === "delivered"
    ) {
      return "picked_up";
    }
    return order.status;
  };

  return (
    <FulfillmentDesk
      adapter={RETAILER_FULFILLMENT_ADAPTER}
      activeHref="/dashboard/incoming-orders"
      title="Order Management"
      description="Review consumer orders here. Approval and cancellation stay on the order detail; invoicing, grouping, and rider assignment each have their own operational desk."
    >
      <FulfillmentKpis
        items={[
          {
            label: "Visible orders",
            value: pagination?.totalCount ?? 0,
            icon: ShoppingBag,
          },
          {
            label: "Pending approval",
            value: orders.filter((order) => order.status === "pending").length,
            icon: Clock3,
            tone: "amber",
          },
          {
            label: "Ready for dispatch",
            value: orders.filter(
              (order) => order.status === "ready_for_dispatch",
            ).length,
            icon: PackageCheck,
            tone: "blue",
          },
          {
            label: "Completed",
            value: orders.filter((order) => order.status === "delivered")
              .length,
            icon: CheckCircle2,
            tone: "emerald",
          },
        ]}
      />

      <FulfillmentPanel
        title="Consumer orders"
        actions={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as OrderFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-52 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending Approval</SelectItem>
              <SelectItem value="ready_for_dispatch">
                Ready for Dispatch
              </SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
              <SelectItem value="processing">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <FulfillmentState
          loading={query.isLoading}
          error={query.isError}
          empty={!query.isLoading && orders.length === 0}
        />
        {orders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Delivery Recipient</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <p className="font-medium">{order.orderNumber}</p>
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
                  <TableCell className="text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <FulfillmentStatus status={presentationStatus(order)} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money.format(Number(order.total))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/incoming-orders/${order.id}`}>
                        Review
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </FulfillmentPanel>
    </FulfillmentDesk>
  );
}
