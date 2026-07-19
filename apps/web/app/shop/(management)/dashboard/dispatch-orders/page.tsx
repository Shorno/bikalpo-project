"use client";

import { FileCheck2, FileText, PackageCheck, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  useCreateIncomingOrderInvoice,
  useRetailDispatchOrders,
} from "@/hooks/use-shop-owner-api";

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
  const query = useRetailDispatchOrders(view, search);
  const createInvoice = useCreateIncomingOrderInvoice();
  const orders = query.data?.orders ?? [];

  const invoiceOrder = (orderId: number) =>
    createInvoice.mutate(
      { orderId },
      {
        onSuccess: () => {
          toast.success("Full invoice created");
          query.refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <FulfillmentDesk
      adapter={RETAILER_FULFILLMENT_ADAPTER}
      activeHref="/dashboard/dispatch-orders"
      title="Dispatch Orders"
      description="Turn each approved consumer order into its one full, idempotent invoice. Retailer invoices always use internal delivery and do not expose partial or pickup options."
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
            label: "Internal delivery",
            value: "Required",
            icon: PackageCheck,
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
                    <FulfillmentStatus status={order.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {money.format(Number(order.total))}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === "ready_for_dispatch" ? (
                      <Button
                        size="sm"
                        onClick={() => invoiceOrder(order.id)}
                        disabled={createInvoice.isPending}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Create Invoice
                      </Button>
                    ) : (
                      <span className="text-sm font-medium text-emerald-700">
                        {order.invoice?.invoiceNumber ?? "Invoice created"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </FulfillmentPanel>
    </FulfillmentDesk>
  );
}
