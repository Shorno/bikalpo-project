"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Loader,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatRetailerOrderItemQuantity,
  getRetailerOrderFulfillmentSummary,
  getRetailerOrderItemEffectiveQty,
  getRetailerOrderItemOrderedQty,
} from "@/components/features/orders/retailer-order-fulfillment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelPurchaseOrder,
  useMarkPurchaseReceived,
  usePurchaseOrderDetail,
} from "@/hooks/use-shop-owner-api";

// ─── Status Config ───────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-4 h-4" />,
    className:
      "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-800",
  },
  confirmed: {
    label: "Accepted",
    icon: <CheckCircle2 className="w-4 h-4" />,
    className:
      "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
  },
  processing: {
    label: "In Delivery",
    icon: <Truck className="w-4 h-4" />,
    className:
      "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-800",
  },
  delivered: {
    label: "Received",
    icon: <PackageCheck className="w-4 h-4" />,
    className:
      "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800",
  },
  returned: {
    label: "Returned",
    icon: <RotateCcw className="w-4 h-4" />,
    className:
      "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-800",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="w-4 h-4" />,
    className:
      "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-800",
  },
};

// ─── Main Component ─────────────────────────────────────────

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);

  const { data, isLoading, isError } = usePurchaseOrderDetail(orderId || null);

  // Dialog states — must be before any early returns (Rules of Hooks)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Record<number, number>>(
    {},
  );

  const receiveMutation = useMarkPurchaseReceived();
  const cancelMutation = useCancelPurchaseOrder();

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Order not found</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            This purchase order doesn't exist or you don't have access
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">← Back to Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { order: po, timeline, hasModifications, delivery } = data;
  const config = statusConfig[po.status] || statusConfig.pending;
  const isCancellable = ["pending", "confirmed"].includes(po.status);
  const isReceivable =
    ["processing", "delivered"].includes(po.status) && !po.receivedAt;
  const requestedSummary = getRetailerOrderFulfillmentSummary(
    po.items,
    getRetailerOrderItemOrderedQty,
  );
  const approvedSummary = getRetailerOrderFulfillmentSummary(
    po.items,
    getRetailerOrderItemEffectiveQty,
  );

  const initReceiveItems = () => {
    const items: Record<number, number> = {};
    for (const item of po.items || []) {
      items[item.id] = item.modifiedQty ?? item.quantity;
    }
    setReceivedItems(items);
    setShowReceiveDialog(true);
  };

  const handleReceive = () => {
    const itemsArr = Object.entries(receivedItems).map(([id, qty]) => ({
      itemId: Number(id),
      receivedQty: qty,
    }));
    receiveMutation.mutate(
      { orderId: po.id, receivedItems: itemsArr },
      {
        onSuccess: () => {
          setShowReceiveDialog(false);
          router.refresh();
        },
      },
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(
      { orderId: po.id },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
          router.push("/dashboard/orders");
        },
      },
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
          >
            <Link href="/dashboard/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-bold tracking-tight font-mono">
                📄 {po.orderNumber}
              </h1>
              <Badge
                variant="outline"
                className={`gap-1 px-2 py-0.5 text-[10px] font-medium ${config.className}`}
              >
                {config.icon}
                {config.label}
              </Badge>
              {hasModifications && (
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30"
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Modified
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {po.warehouseName}
              </span>
              {" · "}
              {new Date(po.createdAt).toLocaleDateString("en-BD", {
                day: "numeric",
                month: "short",
              })}
              {" · "}
              {po.items?.length || 0} item
              {(po.items?.length || 0) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {po.warehousePhone && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              asChild
            >
              <a href={`tel:${po.warehousePhone}`}>
                <Phone className="mr-1 h-3 w-3" /> Contact
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Status Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">⚙ Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline steps={timeline} currentStatus={po.status} />
          </CardContent>
        </Card>

        {/* 📊 Item Breakdown (Table) 🔥 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                📊 Item Breakdown ({po.items?.length || 0})
              </CardTitle>
              {hasModifications && (
                <Badge
                  variant="outline"
                  className="text-[9px] text-orange-600 border-orange-200 bg-orange-50"
                >
                  ⚠ Supplier modified quantities
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 text-[10px] font-bold text-muted-foreground">
                    <th className="text-left p-2 pl-4">Product</th>
                    <th className="text-center p-2">Mode</th>
                    <th className="text-center p-2">Requested Qty</th>
                    <th className="text-center p-2">Approved Qty</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items?.map((item: any) => {
                    const wasModified =
                      item.modifiedQty !== null ||
                      item.modifiedUnitPrice !== null;
                    const approvedQty = item.modifiedQty ?? item.quantity;
                    const approvedPrice =
                      item.modifiedUnitPrice ?? item.unitPrice;
                    const lineTotal = Number(approvedPrice) * approvedQty;

                    return (
                      <tr
                        key={item.id}
                        className={`border-t ${
                          wasModified
                            ? "bg-orange-50/50 dark:bg-orange-950/10"
                            : ""
                        }`}
                      >
                        <td className="p-2 pl-4">
                          <div className="flex items-center gap-2">
                            {item.productImage ? (
                              <Image
                                src={item.productImage}
                                alt={item.productName}
                                width={28}
                                height={28}
                                className="w-7 h-7 rounded border object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded border bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-xs truncate max-w-[180px]">
                                {item.productName}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {item.productSize}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-center p-2">
                          <Badge variant="outline" className="text-[10px]">
                            {item.supplyModeLabel}
                          </Badge>
                        </td>
                        <td className="text-center p-2 tabular-nums">
                          {formatRetailerOrderItemQuantity(item.quantity, item)}
                        </td>
                        <td className="text-center p-2 tabular-nums">
                          {wasModified ? (
                            <span className="text-orange-600 font-semibold">
                              {formatRetailerOrderItemQuantity(
                                approvedQty,
                                item,
                              )}{" "}
                              ↓
                            </span>
                          ) : (
                            <span>
                              {formatRetailerOrderItemQuantity(
                                approvedQty,
                                item,
                              )}
                            </span>
                          )}
                        </td>
                        <td className="text-right p-2 tabular-nums">
                          ৳{Number(approvedPrice).toFixed(0)}
                        </td>
                        <td className="text-right p-2 pr-4 tabular-nums font-semibold">
                          ৳ {lineTotal.toLocaleString("en-BD")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Modification reason */}
            {hasModifications && (
              <div className="px-4 py-2 border-t bg-orange-50/30 dark:bg-orange-950/10">
                <p className="text-[10px] text-orange-600 dark:text-orange-400">
                  ✔ Reason: Stock shortage — partial order accepted
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 📊 Final Summary + Change Highlight */}
        <div className="grid grid-cols-2 gap-3">
          {/* Final Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">📊 Final Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const approvedReduced =
                  approvedSummary.breakdown.length ===
                    requestedSummary.breakdown.length &&
                  approvedSummary.primary !== requestedSummary.primary;
                return (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Total Requested Qty
                      </span>
                      <div className="text-right">
                        <p className="font-medium tabular-nums">
                          {requestedSummary.primary}
                        </p>
                        {requestedSummary.secondary && (
                          <p className="text-[10px] text-muted-foreground">
                            {requestedSummary.secondary}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Total Approved Qty
                      </span>
                      <div className="text-right">
                        <p
                          className={`font-medium tabular-nums ${
                            approvedReduced ? "text-orange-600" : ""
                          }`}
                        >
                          {approvedSummary.primary}
                        </p>
                        {approvedSummary.secondary && (
                          <p className="text-[10px] text-muted-foreground">
                            {approvedSummary.secondary}
                          </p>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">Final Order Value</span>
                      <span className="font-bold tabular-nums">
                        → ৳ {Number(po.total).toLocaleString("en-BD")}
                      </span>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Change Highlight (only if modified) */}
          {hasModifications ? (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📊 Change Highlight</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {po.items
                  ?.filter(
                    (i: any) =>
                      i.modifiedQty !== null && i.modifiedQty !== i.quantity,
                  )
                  .map((item: any) => (
                    <p
                      key={item.id}
                      className="text-[10px] flex items-start gap-1.5"
                    >
                      <span className="text-orange-500 shrink-0">⚠</span>
                      <span className="text-muted-foreground">
                        Quantity updated ({item.productName}:{" "}
                        <span className="font-semibold text-orange-600">
                          {formatRetailerOrderItemQuantity(item.quantity, item)}
                          {" → "}
                          {formatRetailerOrderItemQuantity(
                            item.modifiedQty,
                            item,
                          )}
                        </span>
                        )
                      </span>
                    </p>
                  ))}
                <p className="text-[10px] flex items-start gap-1.5">
                  <span className="text-emerald-500 shrink-0">✔</span>
                  <span className="text-muted-foreground">
                    Partial order accepted
                  </span>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📊 Change Highlight</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <span className="text-emerald-500">✔</span> No modifications —
                  full order accepted
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 💳 Payment Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💳 Payment Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg border bg-muted/20">
                <p className="text-[10px] text-muted-foreground mb-1">
                  Payment Status
                </p>
                <p className="text-xs font-medium">
                  {po.status === "delivered" || po.receivedAt ? (
                    <span className="text-emerald-600">→ ✅ Paid</span>
                  ) : (
                    <span className="text-amber-600">→ ⏳ Pending</span>
                  )}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/20">
                <p className="text-[10px] text-muted-foreground mb-1">
                  Payment Method
                </p>
                <p className="text-xs font-medium capitalize">
                  → {po.paymentMethod?.replace(/_/g, " ") || "Cash"}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/20">
                <p className="text-[10px] text-muted-foreground mb-1">
                  Transaction ID
                </p>
                <p className="text-xs font-mono font-medium">
                  → {po.orderNumber}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Info (compact) */}
        {(delivery.trackingId || delivery.riderName) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Truck className="h-3 w-3 text-muted-foreground" /> Delivery
                Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {delivery.trackingId && (
                  <div className="p-2 rounded-lg border bg-muted/20">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Tracking ID
                    </p>
                    <p className="text-xs font-mono font-medium">
                      {delivery.trackingId}
                    </p>
                  </div>
                )}
                {delivery.riderName && (
                  <div className="p-2 rounded-lg border bg-muted/20">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Rider
                    </p>
                    <p className="text-xs font-medium">{delivery.riderName}</p>
                  </div>
                )}
                {delivery.riderPhone && (
                  <div className="p-2 rounded-lg border bg-muted/20">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Rider Phone
                    </p>
                    <a
                      href={`tel:${delivery.riderPhone}`}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Phone className="w-2.5 h-2.5" /> {delivery.riderPhone}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Price Summary (inline) ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💰 Price Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    ৳ {Number(po.subtotal).toLocaleString("en-BD")}
                  </span>
                </div>
                {Number(po.shippingCost) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="tabular-nums">
                      ৳ {Number(po.shippingCost).toLocaleString("en-BD")}
                    </span>
                  </div>
                )}
                {Number(po.discount) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-emerald-600 tabular-nums">
                      −৳ {Number(po.discount).toLocaleString("en-BD")}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-lg tabular-nums">
                    ৳ {Number(po.total).toLocaleString("en-BD")}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Delivery Address + Wholesaler (side by side) ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground" /> Delivery
                Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-xs font-medium">{po.shippingName}</p>
              <p className="text-[10px] text-muted-foreground">
                {po.shippingAddress}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {po.shippingArea && `${po.shippingArea}, `}
                {po.shippingCity}
              </p>
              <a
                href={`tel:${po.shippingPhone}`}
                className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
              >
                <Phone className="w-2.5 h-2.5" /> {po.shippingPhone}
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🏢 Wholesaler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-xs font-medium">{po.warehouseName}</p>
              {po.warehousePhone && (
                <a
                  href={`tel:${po.warehousePhone}`}
                  className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Phone className="w-2.5 h-2.5" /> {po.warehousePhone}
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Notes ── */}
        {po.customerNote && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                💬 Message from Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <blockquote className="border-l-2 border-amber-300 pl-3 py-1 text-xs text-muted-foreground italic bg-amber-50/50 dark:bg-amber-950/10 rounded-r">
                "{po.customerNote}"
              </blockquote>
            </CardContent>
          </Card>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-2">
          {isReceivable && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={initReceiveItems}
            >
              <PackageCheck className="mr-1.5 h-3.5 w-3.5" />✅ Mark as Received
            </Button>
          )}
          {isCancellable && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowCancelDialog(true)}
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />❌ Cancel Order
            </Button>
          )}
          {po.warehousePhone && (
            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <a href={`tel:${po.warehousePhone}`}>
                <Phone className="mr-1 h-3 w-3" /> 📞 Contact
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* ── Quick Receive Dialog ────────────────────────────── */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              Confirm Receipt
            </DialogTitle>
            <DialogDescription>
              Verify received quantities for each item. Adjust if any items are
              short.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {po.items?.map((item: any) => {
              const expectedQty = item.modifiedQty ?? item.quantity;
              const currentQty = receivedItems[item.id] ?? expectedQty;
              const isMatch = currentQty === expectedQty;

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isMatch
                      ? "border-border bg-muted/20"
                      : "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20"
                  }`}
                >
                  {item.productImage ? (
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-md object-cover border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ordered:{" "}
                      {formatRetailerOrderItemQuantity(expectedQty, item)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-20 h-8 text-center text-sm"
                      value={currentQty}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setReceivedItems((prev) => ({
                          ...prev,
                          [item.id]: Number(val) || 0,
                        }));
                      }}
                    />
                    {isMatch && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReceiveDialog(false)}
              disabled={receiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReceive}
              disabled={receiveMutation.isPending}
            >
              {receiveMutation.isPending ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" /> Receiving...
                </>
              ) : (
                <>
                  <PackageCheck className="mr-2 h-4 w-4" /> Confirm Receive
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation Dialog ─────────────────────── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              Cancel Order
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel order{" "}
              <strong>{po.orderNumber}</strong>? This will restore the warehouse
              inventory and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelMutation.isPending}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" /> Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" /> Yes, Cancel Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Status Timeline ────────────────────────────────────────

function StatusTimeline({
  steps,
  currentStatus,
}: {
  steps: {
    step: string;
    date: string | Date | null;
    completed: boolean;
    isModification?: boolean;
  }[];
  currentStatus: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          const isCurrent = s.completed && (isLast || !steps[i + 1]?.completed);

          return (
            <div key={i} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {i > 0 && (
                <div
                  className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-10 ${
                    s.completed
                      ? s.isModification
                        ? "bg-orange-300 dark:bg-orange-700"
                        : "bg-primary"
                      : "bg-muted"
                  }`}
                />
              )}

              {/* Circle */}
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold z-10
                  transition-all duration-300
                  ${
                    s.completed
                      ? s.isModification
                        ? "bg-orange-500 text-white ring-2 ring-orange-200 dark:ring-orange-800"
                        : isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                          : "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border-2 border-muted-foreground/20"
                  }
                `}
              >
                {s.completed ? (
                  s.isModification ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )
                ) : (
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>

              {/* Label */}
              <p
                className={`text-[11px] mt-2 font-medium text-center ${
                  s.completed
                    ? s.isModification
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {s.step}
              </p>

              {/* Date */}
              {s.date && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(s.date).toLocaleDateString("en-BD", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
