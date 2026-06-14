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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";
import { PurchaseDetailPageSkeleton } from "../_components/purchases-skeletons";

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "text-blue-700 bg-blue-50 border-blue-200",
  },
  processing: {
    label: "Processing",
    icon: <Truck className="h-3.5 w-3.5" />,
    className: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  delivered: {
    label: "Delivered",
    icon: <PackageCheck className="h-3.5 w-3.5" />,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "text-rose-700 bg-rose-50 border-rose-200",
  },
};

function formatMoney(value: unknown) {
  return `৳${Number(value || 0).toLocaleString("en-BD")}`;
}

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
      router.push("/warehouse/dashboard/purchases");
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
    return <PurchaseDetailPageSkeleton />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-14 w-14 text-muted-foreground/25" />
          <h2 className="text-lg font-semibold text-foreground">Order not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This purchase order may have been removed or you lack access.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/warehouse/dashboard/purchases">Back to Supplier Purchases</Link>
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
  const hasWarehouseReview =
    !!order.confirmedAt ||
    ["confirmed", "processing", "delivered"].includes(order.status);

  const initReceiveItems = () => {
    const nextItems: Record<number, number> = {};
    for (const item of order.items || []) {
      nextItems[item.id] = item.modifiedQty ?? item.quantity;
    }
    setReceivedItems(nextItems);
    setShowReceiveDialog(true);
  };

  const currentTimelineIdx = timeline.findIndex((step: any) => !step.completed);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/warehouse/dashboard" className="hover:text-foreground transition-colors">
          Warehouse
        </Link>
        <span>/</span>
        <Link href="/warehouse/dashboard/purchases" className="hover:text-foreground transition-colors">
          Supplier Purchases
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium font-mono">{order.orderNumber}</span>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0 mt-0.5">
            <Link href="/warehouse/dashboard/purchases">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {order.orderNumber}
              </h1>
              <Badge variant="outline" className={`gap-1 text-xs ${config.className}`}>
                {config.icon}
                {config.label}
              </Badge>
              {order.requiresBuyerAcceptance ? (
                <Badge
                  variant="outline"
                  className="text-xs text-amber-700 bg-amber-50 border-amber-200"
                >
                  Approval needed
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Supplier:{" "}
              <span className="font-medium text-foreground">{order.supplierWarehouseName}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {order.supplierWarehousePhone ? (
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href={`tel:${order.supplierWarehousePhone}`}>
                <Phone className="mr-2 h-4 w-4" />
                Call Supplier
              </Link>
            </Button>
          ) : null}
          {isReceivable ? (
            <Button
              size="sm"
              className="h-9 bg-amber-600 hover:bg-amber-500/90 text-white"
              onClick={initReceiveItems}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              Mark Received
            </Button>
          ) : null}
          {isCancellable ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
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
        <Card className="border-amber-200 bg-amber-50/50 ring-amber-100">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-foreground">Supplier changed quantities</p>
                <p className="text-sm text-muted-foreground">
                  Accept to continue dispatch, or reject to cancel and release reserved stock.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={rejectMutation.isPending || acceptMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                Reject
              </Button>
              <Button
                size="sm"
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

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="ring-border/60">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Line Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                      <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Product
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Requested
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {hasWarehouseReview ? "Approved" : "Approval"}
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Unit Price
                      </TableHead>
                      <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items?.map((item: any) => {
                      const approvedQty = item.modifiedQty ?? item.quantity;
                      const unitPrice = Number(item.modifiedUnitPrice ?? item.unitPrice);
                      const changed =
                        item.modifiedQty !== null && item.modifiedQty !== item.quantity;
                      const displayQty = hasWarehouseReview ? approvedQty : item.quantity;
                      return (
                        <TableRow key={item.id} className="border-b border-border hover:bg-muted/30">
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
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
                                <p className="text-sm font-medium text-foreground">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.productSize || item.variant?.unitLabel || "Unit"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-sm font-mono tabular-nums text-foreground">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-sm font-mono tabular-nums">
                            {hasWarehouseReview ? (
                              <span className={changed ? "font-semibold text-amber-700" : "text-foreground"}>
                                {approvedQty}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-sm font-mono tabular-nums text-foreground">
                            {formatMoney(unitPrice)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-sm font-semibold font-mono tabular-nums text-foreground">
                            {formatMoney(displayQty * unitPrice)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {delivery?.trackingId || delivery?.riderName || delivery?.riderPhone ? (
            <Card className="ring-border/60">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4 text-sm sm:grid-cols-3">
                <Info label="Tracking ID" value={delivery.trackingId || "—"} mono />
                <Info label="Rider" value={delivery.riderName || "—"} />
                <Info label="Rider Phone" value={delivery.riderPhone || "—"} mono />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="ring-border/60">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-sm">
              <Info label="Supplier" value={order.supplierWarehouseName} />
              <Info
                label="Payment"
                value={String(order.paymentMethod).replaceAll("_", " ")}
              />
              <Info label="Status" value={config.label} />
              <div className="border-t border-border pt-3">
                <Info label="Total" value={formatMoney(order.total)} strong mono />
              </div>
              {hasModifications ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Some quantities were changed by the supplier.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="ring-border/60">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {timeline.map((step: any, idx: number) => {
                const isDone = step.completed;
                const isCurrent = !isDone && idx === currentTimelineIdx;
                return (
                  <div key={step.step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-3 w-3 shrink-0 rounded-full border-2 ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500"
                            : isCurrent
                              ? "border-amber-500 bg-amber-500"
                              : "border-border bg-card"
                        }`}
                      />
                      {idx < timeline.length - 1 ? (
                        <div
                          className={`mt-1 w-px flex-1 min-h-4 ${
                            isDone ? "bg-emerald-300" : "bg-border"
                          }`}
                        />
                      ) : null}
                    </div>
                    <div className="pb-1">
                      <p
                        className={`text-sm font-medium ${
                          isDone
                            ? "text-foreground"
                            : isCurrent
                              ? "text-amber-700"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.step}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
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
                );
              })}
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
                    <p className="text-sm font-medium text-foreground">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      Expected{" "}
                      <span className="font-mono tabular-nums">{expectedQty}</span>
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    className="font-mono tabular-nums"
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
              className="bg-amber-600 hover:bg-amber-500/90 text-white"
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
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-right capitalize ${
          strong ? "text-base font-bold text-foreground" : "font-medium text-foreground"
        } ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
