"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
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
import {
  OrderTimeline,
  ShipmentFlowStepper,
} from "../_components/purchase-flow-steppers";
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
  ready_for_dispatch: {
    label: "Ready for Dispatch",
    icon: <Package className="h-3.5 w-3.5" />,
    className: "text-violet-700 bg-violet-50 border-violet-200",
  },
  partially_invoiced: {
    label: "Partially Invoiced",
    icon: <Package className="h-3.5 w-3.5" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  invoiced: {
    label: "Invoiced",
    icon: <PackageCheck className="h-3.5 w-3.5" />,
    className: "text-sky-700 bg-sky-50 border-sky-200",
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
  received: {
    label: "Received",
    icon: <PackageCheck className="h-3.5 w-3.5" />,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  awaiting_receive: {
    label: "Awaiting Receive",
    icon: <PackageCheck className="h-3.5 w-3.5" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  in_delivery: {
    label: "In Delivery",
    icon: <Truck className="h-3.5 w-3.5" />,
    className: "text-sky-700 bg-sky-50 border-sky-200",
  },
  partially_delivered: {
    label: "Partially Delivered",
    icon: <Truck className="h-3.5 w-3.5" />,
    className: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  awaiting_dispatch: {
    label: "Awaiting Dispatch",
    icon: <Package className="h-3.5 w-3.5" />,
    className: "text-violet-700 bg-violet-50 border-violet-200",
  },
};

function formatMoney(value: unknown) {
  return `৳${Number(value || 0).toLocaleString("en-BD")}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("OTP copied"),
    () => toast.error("Failed to copy"),
  );
}

export default function WarehouseSupplierOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = Number(params.id);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Record<number, number>>({});
  const [shipmentReceiveId, setShipmentReceiveId] = useState<number | null>(null);
  const [shipmentReceivedItems, setShipmentReceivedItems] = useState<
    Record<number, number>
  >({});

  const detailQuery = useQuery({
    queryKey: ["warehouse", "getMyOrderDetail", orderId],
    queryFn: () => orpc.warehouse.getMyOrderDetail.call({ orderId }),
    enabled: Number.isFinite(orderId) && orderId > 0,
    refetchInterval: 30_000,
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

  const receiveShipmentMutation = useMutation({
    mutationFn: (invoiceId: number) =>
      orpc.warehouse.receiveWarehouseSupplierShipment.call({
        invoiceId,
        receivedItems: Object.entries(shipmentReceivedItems).map(
          ([invoiceItemId, receivedQty]) => ({
            invoiceItemId: Number(invoiceItemId),
            receivedQty,
          }),
        ),
      }),
    onSuccess: (result) => {
      toast.success(result.message || "Shipment received");
      setShipmentReceiveId(null);
      setShipmentReceivedItems({});
      invalidate();
    },
    onError: (error: any) =>
      toast.error(error.message || "Failed to receive shipment"),
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

  const {
    order,
    orderTimeline,
    displayStatus,
    hasModifications,
    delivery,
    invoiceProgress,
    shipments,
  } = detailQuery.data;
  const config =
    statusConfig[displayStatus?.key ?? order.status] || statusConfig.pending;
  const statusLabel = displayStatus?.label ?? config.label;
  const isCancellable = [
    "pending",
    "approved",
    "confirmed",
    "ready_for_dispatch",
  ].includes(order.status);
  const hasPendingShipmentReceive = (shipments ?? []).some((s) => s.canReceive);
  const isReceivable =
    order.status === "delivered" && !order.receivedAt && !hasPendingShipmentReceive;
  const hasWarehouseReview =
    !!order.confirmedAt ||
    [
      "confirmed",
      "ready_for_dispatch",
      "partially_invoiced",
      "invoiced",
      "processing",
      "delivered",
    ].includes(order.status);
  const hasFulfillmentColumns = (shipments ?? []).length > 0;

  const initReceiveItems = () => {
    const nextItems: Record<number, number> = {};
    for (const item of order.items || []) {
      nextItems[item.id] = item.modifiedQty ?? item.quantity;
    }
    setReceivedItems(nextItems);
    setShowReceiveDialog(true);
  };

  const initShipmentReceive = (shipment: (typeof shipments)[number]) => {
    const nextItems: Record<number, number> = {};
    for (const item of shipment.items) {
      nextItems[item.id] = item.quantity;
    }
    setShipmentReceivedItems(nextItems);
    setShipmentReceiveId(shipment.invoiceId);
  };

  const invoicedPercent =
    invoiceProgress && invoiceProgress.approvedQty > 0
      ? Math.round((invoiceProgress.invoicedQty / invoiceProgress.approvedQty) * 100)
      : 0;
  const shipmentTotal = (shipments ?? []).length;
  const shipmentsReceived = (shipments ?? []).filter((s) => s.receivedAt).length;
  const activeShipmentDelivery = (shipments ?? []).find(
    (s) =>
      s.delivery?.riderName &&
      (s.delivery.groupStatus === "out_for_delivery" || s.canReceive),
  )?.delivery ?? (shipments ?? []).findLast((s) => s.delivery?.riderName)?.delivery;
  const summaryRiderName = delivery?.riderName ?? activeShipmentDelivery?.riderName ?? null;
  const summaryRiderPhone = delivery?.riderPhone ?? activeShipmentDelivery?.riderPhone ?? null;
  const summaryTrackingId = delivery?.trackingId ?? null;

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-5 pb-10">
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
                {statusLabel}
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(17.5rem,20rem)] xl:items-start">
        <div className="space-y-5 min-w-0">
          {invoiceProgress ? (
            <div className="rounded-lg border border-border bg-card px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fulfillment
                </p>
                {shipmentTotal > 0 ? (
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    {shipmentsReceived}/{shipmentTotal} shipments received
                  </p>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {invoiceProgress.invoicedQty}
                  </span>
                  <span className="text-muted-foreground">
                    /{invoiceProgress.approvedQty} invoiced
                  </span>
                </span>
                <span className="text-muted-foreground hidden sm:inline">·</span>
                <span>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {invoiceProgress.deliveredQty ?? 0}
                  </span>
                  <span className="text-muted-foreground"> delivered</span>
                </span>
                <span className="text-muted-foreground hidden sm:inline">·</span>
                <span>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    {invoiceProgress.remainingQty}
                  </span>
                  <span className="text-muted-foreground"> remaining</span>
                </span>
              </div>
              <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${invoicedPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {(shipments ?? []).length > 0 ? (
            <Card className="border-border">
              <CardHeader className="border-b border-border px-4 py-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Shipments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border">
                {(shipments ?? []).map((shipment) => {
                  const isSplit = shipment.invoiceType === "split";
                  const isSelfPickup = shipment.fulfillmentMode === "self_pickup";
                  const currentStep = shipment.flow?.find((s) => s.state === "current");
                  return (
                    <div key={shipment.invoiceId} className="px-4 py-3.5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-semibold tabular-nums">
                              {shipment.invoiceNumber}
                            </p>
                            {isSplit && shipment.splitSequence ? (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
                                Part {shipment.splitSequence}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {shipment.items.length} item
                            {shipment.items.length !== 1 ? "s" : ""} ·{" "}
                            {formatMoney(shipment.grandTotal)}
                            {currentStep ? (
                              <span className="text-foreground"> · {currentStep.label}</span>
                            ) : null}
                          </p>
                        </div>
                        {shipment.canReceive ? (
                          <Button
                            size="sm"
                            className="h-8 shrink-0"
                            onClick={() => initShipmentReceive(shipment)}
                          >
                            <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
                            Receive
                          </Button>
                        ) : null}
                      </div>

                      {shipment.flow?.length ? (
                        <div className="rounded-md border border-border/80 bg-muted/15 px-2 py-2.5">
                          <ShipmentFlowStepper steps={shipment.flow} />
                        </div>
                      ) : null}

                      {shipment.otp ? (
                        <div
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                            isSelfPickup
                              ? "border-amber-200 bg-amber-50/80"
                              : "border-emerald-200 bg-emerald-50/80"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <KeyRound
                              className={`h-4 w-4 shrink-0 ${
                                isSelfPickup ? "text-amber-600" : "text-emerald-600"
                              }`}
                            />
                            <p
                              className={`text-xs ${
                                isSelfPickup ? "text-amber-800" : "text-emerald-800"
                              }`}
                            >
                              {isSelfPickup ? "Pickup OTP" : "Delivery OTP"} — share with
                              rider when goods arrive
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-xl font-bold tracking-widest font-mono ${
                                isSelfPickup ? "text-amber-700" : "text-emerald-700"
                              }`}
                            >
                              {shipment.otp}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => copyToClipboard(shipment.otp!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border">
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Line Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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
                    {hasFulfillmentColumns ? (
                      <>
                        <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Invoiced
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Delivered
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Remaining
                        </TableHead>
                      </>
                    ) : null}
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
                            <div className="min-w-0">
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
                        {hasFulfillmentColumns ? (
                          <>
                            <TableCell className="px-4 py-3 text-right text-sm font-mono tabular-nums text-foreground">
                              {item.invoicedQty ?? 0}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-sm font-mono tabular-nums text-foreground">
                              {item.deliveredQty ?? 0}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right text-sm font-mono tabular-nums text-muted-foreground">
                              {item.remainingQty ?? 0}
                            </TableCell>
                          </>
                        ) : null}
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
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6">
          <Card className="border-border">
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 py-4 text-sm">
              <Info label="Supplier" value={order.supplierWarehouseName} />
              <Info
                label="Payment"
                value={String(order.paymentMethod).replaceAll("_", " ")}
              />
              <Info label="Status" value={statusLabel} />
              {summaryRiderName ? <Info label="Rider" value={summaryRiderName} /> : null}
              {summaryRiderPhone ? (
                <Info label="Rider phone" value={summaryRiderPhone} mono />
              ) : null}
              {summaryTrackingId ? (
                <Info label="Tracking ID" value={summaryTrackingId} mono />
              ) : null}
              <div className="border-t border-border pt-3">
                <Info label="Total" value={formatMoney(order.total)} strong mono />
              </div>
              {hasModifications ? (
                <p className="text-xs text-amber-800 border border-amber-200 bg-amber-50 rounded-md px-2.5 py-2">
                  Supplier adjusted some line quantities.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Order Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pt-4 pb-2">
              <OrderTimeline steps={orderTimeline ?? []} />
            </CardContent>
          </Card>
        </aside>
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

      <Dialog
        open={shipmentReceiveId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShipmentReceiveId(null);
            setShipmentReceivedItems({});
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Shipment</DialogTitle>
            <DialogDescription>
              Confirm quantities for this shipment. Stock will be added to your
              warehouse inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(shipments ?? [])
              .find((s) => s.invoiceId === shipmentReceiveId)
              ?.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_110px] items-center gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Shipped{" "}
                      <span className="font-mono tabular-nums">
                        {item.quantity}
                      </span>
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    className="font-mono tabular-nums"
                    value={shipmentReceivedItems[item.id] ?? item.quantity}
                    onChange={(event) =>
                      setShipmentReceivedItems((current) => ({
                        ...current,
                        [item.id]: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShipmentReceiveId(null);
                setShipmentReceivedItems({});
              }}
              disabled={receiveShipmentMutation.isPending}
            >
              Close
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500/90 text-white"
              onClick={() => {
                if (shipmentReceiveId) receiveShipmentMutation.mutate(shipmentReceiveId);
              }}
              disabled={receiveShipmentMutation.isPending || !shipmentReceiveId}
            >
              {receiveShipmentMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="mr-2 h-4 w-4" />
              )}
              Confirm Shipment Receipt
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
