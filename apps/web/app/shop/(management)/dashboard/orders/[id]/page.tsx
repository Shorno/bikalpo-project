"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePurchaseOrderDetail } from "@/hooks/use-shop-owner-api";

// ─── Status Config ───────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-4 h-4" />,
    className: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-800",
  },
  confirmed: {
    label: "Accepted",
    icon: <CheckCircle2 className="w-4 h-4" />,
    className: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
  },
  processing: {
    label: "In Delivery",
    icon: <Truck className="w-4 h-4" />,
    className: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-800",
  },
  delivered: {
    label: "Received",
    icon: <PackageCheck className="w-4 h-4" />,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800",
  },
  returned: {
    label: "Returned",
    icon: <RotateCcw className="w-4 h-4" />,
    className: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-800",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="w-4 h-4" />,
    className: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-800",
  },
};

// ─── Main Component ─────────────────────────────────────────

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);

  const { data, isLoading, isError } = usePurchaseOrderDetail(orderId || null);

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
  const isReceivable = ["processing", "delivered"].includes(po.status) && !po.receivedAt;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
          >
            <Link href="/dashboard/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {po.orderNumber}
              </h1>
              <Badge
                variant="outline"
                className={`gap-1.5 px-2.5 py-1 text-xs font-medium ${config.className}`}
              >
                {config.icon}
                {config.label}
              </Badge>
              {hasModifications && (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Modified by Supplier
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              From <span className="font-medium text-foreground">{po.warehouseName}</span>
              {" · "}
              {new Date(po.createdAt).toLocaleDateString("en-BD", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {po.warehousePhone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${po.warehousePhone}`}>
                <Phone className="mr-1.5 h-3.5 w-3.5" />
                Contact
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Content ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline steps={timeline} currentStatus={po.status} />
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Ordered Items ({po.items?.length || 0})
                </CardTitle>
                {hasModifications && (
                  <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-200">
                    Supplier modified some quantities
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {po.items?.map((item: any) => {
                const wasModified = item.modifiedQty !== null || item.modifiedUnitPrice !== null;
                const displayQty = item.modifiedQty ?? item.quantity;
                const displayPrice = item.modifiedUnitPrice ?? item.unitPrice;

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                      wasModified
                        ? "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    {/* Product Image */}
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt={item.productName}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-lg object-cover border shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center border shrink-0">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.productSize}
                        {item.variant?.sku && (
                          <span className="ml-2 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            {item.variant.sku}
                          </span>
                        )}
                      </p>

                      {/* Modification diff */}
                      {wasModified && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground line-through">
                            Ordered: {item.quantity} × ৳{Number(item.unitPrice).toFixed(0)}
                          </span>
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            → Updated: {displayQty} × ৳{Number(displayPrice).toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Qty & Price */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        ৳ {(Number(displayPrice) * displayQty).toLocaleString("en-BD")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {displayQty} × ৳{Number(displayPrice).toFixed(0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Delivery Info */}
          {(delivery.trackingId || delivery.riderName) && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {delivery.trackingId && (
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <p className="text-xs text-muted-foreground mb-1">Tracking ID</p>
                      <p className="text-sm font-mono font-medium">{delivery.trackingId}</p>
                    </div>
                  )}
                  {delivery.riderName && (
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <p className="text-xs text-muted-foreground mb-1">Rider</p>
                      <p className="text-sm font-medium">{delivery.riderName}</p>
                    </div>
                  )}
                  {delivery.riderPhone && (
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <p className="text-xs text-muted-foreground mb-1">Rider Phone</p>
                      <a
                        href={`tel:${delivery.riderPhone}`}
                        className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        {delivery.riderPhone}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Pricing Summary */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Price Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">৳ {Number(po.subtotal).toLocaleString("en-BD")}</span>
              </div>
              {Number(po.shippingCost) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="tabular-nums">৳ {Number(po.shippingCost).toLocaleString("en-BD")}</span>
                </div>
              )}
              {Number(po.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-emerald-600 tabular-nums">−৳ {Number(po.discount).toLocaleString("en-BD")}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary tabular-nums">
                  ৳ {Number(po.total).toLocaleString("en-BD")}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payment</span>
                <span className="capitalize">{po.paymentMethod?.replace(/_/g, " ")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{po.shippingName}</p>
              <p className="text-sm text-muted-foreground">{po.shippingAddress}</p>
              <p className="text-sm text-muted-foreground">
                {po.shippingArea && `${po.shippingArea}, `}{po.shippingCity}
              </p>
              <a
                href={`tel:${po.shippingPhone}`}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <Phone className="w-3 h-3" />
                {po.shippingPhone}
              </a>
            </CardContent>
          </Card>

          {/* Wholesaler Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Wholesaler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{po.warehouseName}</p>
              {po.warehousePhone && (
                <a
                  href={`tel:${po.warehousePhone}`}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  {po.warehousePhone}
                </a>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {po.customerNote && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Order Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{po.customerNote}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {isReceivable && (
              <Button className="w-full" size="lg">
                <PackageCheck className="mr-2 h-4 w-4" />
                Mark as Received
              </Button>
            )}
            {isCancellable && (
              <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20">
                <Ban className="mr-2 h-4 w-4" />
                Cancel Order
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status Timeline ────────────────────────────────────────

function StatusTimeline({
  steps,
  currentStatus,
}: {
  steps: { step: string; date: string | Date | null; completed: boolean; isModification?: boolean }[];
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
                  ${s.completed
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
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
