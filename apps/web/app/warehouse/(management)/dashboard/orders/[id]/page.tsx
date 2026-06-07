"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  PackageCheck,
  Phone,
  Truck,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-4 w-4" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "text-blue-700 bg-blue-50 border-blue-200",
  },
  processing: {
    label: "Processing",
    icon: <Truck className="h-4 w-4" />,
    className: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  delivered: {
    label: "Delivered",
    icon: <PackageCheck className="h-4 w-4" />,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="h-4 w-4" />,
    className: "text-red-700 bg-red-50 border-red-200",
  },
};

export default function WarehouseSupplierOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = Number(params.id);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Record<number, number>>({});

  const detailQuery = useQuery({
    queryKey: ["warehouse", "getMyOrderDetail", orderId],
    queryFn: () => orpc.warehouse.getMyOrderDetail.call({ orderId }),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyOrderDetail", orderId] });
    queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyOrders"] });
  };

  const cancelMutation = useMutation({
    mutationFn: () => orpc.warehouse.cancelWarehouseSupplierOrder.call({ orderId }),
    onSuccess: (result) => {
      toast.success(result.message || "Order cancelled");
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyOrders"] });
      router.push("/warehouse/dashboard/orders");
    },
    onError: (error: any) => toast.error(error.message || "Failed to cancel order"),
  });

  const acceptMutation = useMutation({
    mutationFn: () => orpc.warehouse.acceptWarehouseSupplierModification.call({ orderId }),
    onSuccess: (result) => {
      toast.success(result.message || "Modifications accepted");
      invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Failed to accept modifications"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => orpc.warehouse.rejectWarehouseSupplierModification.call({ orderId }),
    onSuccess: (result) => {
      toast.success(result.message || "Modifications rejected");
      invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Failed to reject modifications"),
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      orpc.warehouse.receiveWarehouseSupplierOrder.call({
        orderId,
        receivedItems: Object.entries(receivedItems).map(([itemId, receivedQty]) => ({
          itemId: Number(itemId),
          receivedQty,
        })),
      }),
    onSuccess: (result) => {
      toast.success(result.message || "Order received");
      setShowReceiveDialog(false);
      invalidate();
    },
    onError: (error: any) => toast.error(error.message || "Failed to receive order"),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-14 w-14 text-muted-foreground/25" />
          <h2 className="text-lg font-semibold">Order not found</h2>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/warehouse/dashboard/orders">Back to Supplier Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { order, timeline, hasModifications, delivery } = detailQuery.data;
  const config = statusConfig[order.status] || statusConfig.pending;
  const isCancellable = ["pending", "confirmed"].includes(order.status);
  const isReceivable =
    ["processing", "delivered"].includes(order.status) && !order.receivedAt;

  const initReceiveItems = () => {
    const nextItems: Record<number, number> = {};
    for (const item of order.items || []) {
      nextItems[item.id] = item.modifiedQty ?? item.quantity;
    }
    setReceivedItems(nextItems);
    setShowReceiveDialog(true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/warehouse/dashboard/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-bold">{order.orderNumber}</h1>
              <Badge variant="outline" className={`gap-1 ${config.className}`}>
                {config.icon}
                {config.label}
              </Badge>
              {order.requiresBuyerAcceptance ? (
                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                  Approval needed
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Supplier: {order.supplierWarehouseName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.supplierWarehousePhone ? (
            <Button asChild variant="outline">
              <Link href={`tel:${order.supplierWarehousePhone}`}>
                <Phone className="mr-2 h-4 w-4" />
                Call Supplier
              </Link>
            </Button>
          ) : null}
          {isReceivable ? (
            <Button onClick={initReceiveItems}>
              <PackageCheck className="mr-2 h-4 w-4" />
              Mark Received
            </Button>
          ) : null}
          {isCancellable ? (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (confirm("Cancel this supplier order?")) cancelMutation.mutate();
              }}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" />
              )}
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {order.requiresBuyerAcceptance ? (
        <Card className="border-orange-200 bg-orange-50/60">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900">Supplier changed quantities</p>
                <p className="text-sm text-orange-700">
                  Accept to continue dispatch, or reject to cancel and release reserved stock.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:text-red-700"
                disabled={rejectMutation.isPending || acceptMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                Reject
              </Button>
              <Button
                disabled={rejectMutation.isPending || acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Accept
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-y bg-gray-50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Product</th>
                      <th className="px-4 py-3 text-right font-medium">Requested</th>
                      <th className="px-4 py-3 text-right font-medium">Approved</th>
                      <th className="px-4 py-3 text-right font-medium">Unit Price</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.map((item: any) => {
                      const approvedQty = item.modifiedQty ?? item.quantity;
                      const unitPrice = Number(item.modifiedUnitPrice ?? item.unitPrice);
                      const changed = item.modifiedQty !== null && item.modifiedQty !== item.quantity;
                      return (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
                                {item.product?.image ? (
                                  <Image
                                    src={item.product.image}
                                    alt={item.productName}
                                    width={40}
                                    height={40}
                                    unoptimized
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Package className="h-5 w-5 text-muted-foreground/50" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{item.productName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.productSize || item.variant?.unitLabel || "Unit"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-sm">
                            <span className={changed ? "font-semibold text-orange-600" : ""}>
                              {approvedQty}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            BDT {unitPrice.toLocaleString("en-BD")}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold">
                            BDT {(approvedQty * unitPrice).toLocaleString("en-BD")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {delivery?.trackingId || delivery?.riderName || delivery?.riderPhone ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Delivery</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                <Info label="Tracking ID" value={delivery.trackingId || "-"} />
                <Info label="Rider" value={delivery.riderName || "-"} />
                <Info label="Rider Phone" value={delivery.riderPhone || "-"} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Supplier" value={order.supplierWarehouseName} />
              <Info label="Payment" value={String(order.paymentMethod).replaceAll("_", " ")} />
              <Info label="Status" value={config.label} />
              <Info
                label="Total"
                value={`BDT ${Number(order.total).toLocaleString("en-BD")}`}
                strong
              />
              {hasModifications ? (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-orange-700">
                  Some quantities were changed by the supplier.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {timeline.map((step: any) => (
                <div key={step.step} className="flex gap-3">
                  <div
                    className={`mt-0.5 h-3 w-3 rounded-full border ${
                      step.completed
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-gray-300 bg-white"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">{step.step}</p>
                    <p className="text-xs text-muted-foreground">
                      {step.date
                        ? new Date(step.date).toLocaleDateString("en-BD", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Pending"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Received Quantities</DialogTitle>
            <DialogDescription>
              These quantities will be added flat to your warehouse inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {order.items?.map((item: any) => {
              const expectedQty = item.modifiedQty ?? item.quantity;
              return (
                <div key={item.id} className="grid grid-cols-[1fr_110px] items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      Expected {expectedQty}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={receivedItems[item.id] ?? expectedQty}
                    onChange={(event) =>
                      setReceivedItems((current) => ({
                        ...current,
                        [item.id]: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReceiveDialog(false)}
              disabled={receiveMutation.isPending}
            >
              Close
            </Button>
            <Button
              onClick={() => receiveMutation.mutate()}
              disabled={receiveMutation.isPending}
            >
              {receiveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="mr-2 h-4 w-4" />
              )}
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right capitalize ${strong ? "font-bold" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
