"use client";

import { ArrowLeft, Check, MapPin, Package, Phone, X } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import {
  FulfillmentDesk,
  FulfillmentPanel,
  FulfillmentState,
  FulfillmentStatus,
} from "@/components/features/fulfillment/fulfillment-desk";
import { RETAILER_FULFILLMENT_ADAPTER } from "@/components/features/fulfillment/owner-adapters";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useApproveIncomingOrder,
  useCancelIncomingOrder,
  useIncomingOrderDetail,
} from "@/hooks/use-shop-owner-api";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
});

export default function IncomingOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = Number.parseInt(id, 10);
  const query = useIncomingOrderDetail(orderId);
  const approve = useApproveIncomingOrder();
  const cancel = useCancelIncomingOrder();
  const [cancelOpen, setCancelOpen] = useState(false);
  const order = query.data?.order;

  const approveOrder = () =>
    approve.mutate(
      { orderId },
      {
        onSuccess: () => {
          toast.success("Order approved and sent to Dispatch Orders");
          query.refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  const cancelOrder = () =>
    cancel.mutate(
      { orderId },
      {
        onSuccess: () => {
          toast.success("Order cancelled");
          setCancelOpen(false);
          query.refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <FulfillmentDesk
      adapter={RETAILER_FULFILLMENT_ADAPTER}
      activeHref="/dashboard/incoming-orders"
      eyebrow="Order review"
      title={order?.orderNumber ?? "Order detail"}
      description="Approve the consumer order after reviewing its recipient, address, stock reservation, and totals. Fulfillment continues at the Dispatch Orders desk."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/incoming-orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          {order?.status === "pending" ? (
            <>
              <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <X className="mr-2 h-4 w-4" />
                    Cancel Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Reserved retailer stock will be restored. This cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep order</AlertDialogCancel>
                    <AlertDialogAction onClick={cancelOrder}>
                      Cancel order
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={approveOrder} disabled={approve.isPending}>
                <Check className="mr-2 h-4 w-4" />
                Approve Order
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <FulfillmentState
        loading={query.isLoading}
        error={query.isError || !Number.isFinite(orderId)}
        empty={!query.isLoading && !order}
        emptyTitle="Order not found"
      />
      {order ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <Card className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Delivery Recipient</CardTitle>
                <FulfillmentStatus status={order.status} />
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-medium">{order.shippingName}</p>
                  <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {order.shippingPhone}
                  </p>
                </div>
                <div>
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {[
                      order.shippingAddress,
                      order.shippingArea,
                      order.shippingCity,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Order summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{money.format(Number(order.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>{money.format(Number(order.shippingCost))}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total</span>
                  <span>{money.format(Number(order.total))}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <FulfillmentPanel title="Order items">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100">
                          <Package className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.productSize || "Retail item"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.quantity} {item.quantityUnit}
                    </TableCell>
                    <TableCell>
                      {money.format(Number(item.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {money.format(Number(item.totalPrice))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FulfillmentPanel>
        </>
      ) : null}
    </FulfillmentDesk>
  );
}
