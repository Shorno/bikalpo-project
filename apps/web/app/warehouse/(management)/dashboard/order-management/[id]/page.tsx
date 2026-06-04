"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { Separator } from "@/components/ui/separator";
import { OrderFlowStepper } from "./_components/order-flow-stepper";
import { OrderSourceBadge } from "./_components/order-source-badge";

/* ── Helpers ─────────────────────────────────────────────── */

function formatMoney(value: unknown) {
  return `৳ ${Number(value || 0).toLocaleString("en-BD")}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatus(status: string, requiresBuyerAcceptance?: boolean) {
  if (status === "cancelled")
    return { label: "Rejected", icon: XCircle, className: "border-red-200 bg-red-50 text-red-700" };
  if (requiresBuyerAcceptance)
    return { label: "Accepted (Modified)", icon: AlertCircle, className: "border-orange-200 bg-orange-50 text-orange-700" };
  if (status === "confirmed")
    return { label: "Accepted", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (status === "processing")
    return { label: "Processing", icon: Truck, className: "border-blue-200 bg-blue-50 text-blue-700" };
  return { label: "Pending Approval", icon: Clock, className: "border-amber-200 bg-amber-50 text-amber-700" };
}

/* ── Page ────────────────────────────────────────────────── */

export default function OrderManagementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = Number(params.id);

  const [approvedQty, setApprovedQty] = useState<Record<number, number>>({});
  const [approvalNote, setApprovalNote] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse", "order-management-detail", orderId],
    queryFn: () => orpc.warehouse.getOrderDetail.call({ orderId }),
    enabled: Number.isFinite(orderId),
  });

  useEffect(() => {
    if (!data?.order.items) return;
    const next: Record<number, number> = {};
    for (const item of data.order.items) {
      next[item.id] = item.approvedQty ?? item.quantity;
    }
    setApprovedQty(next);
  }, [data?.order.items]);

  const reviewMutation = useMutation({
    mutationFn: (input: Parameters<typeof orpc.warehouse.reviewOrder.call>[0]) =>
      orpc.warehouse.reviewOrder.call(input),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["warehouse", "order-management"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "order-management-detail", orderId] });
    },
    onError: (error) => toast.error(error.message || "Failed to review order"),
  });

  const prepareMutation = useMutation({
    mutationFn: () => orpc.warehouse.prepareOrderForDispatch.call({ orderId }),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["warehouse", "order-management-detail", orderId] });
    },
    onError: (error) => toast.error(error.message || "Failed to prepare dispatch"),
  });

  const order = data?.order;
  const status = order ? getStatus(order.status, order.requiresBuyerAcceptance) : null;
  const isPending = order?.status === "pending";

  const finalApprovedTotal = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((sum, item: any) => {
      const qty = approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
      const price = Number(item.modifiedUnitPrice ?? item.unitPrice ?? 0);
      return sum + qty * price;
    }, 0);
  }, [approvedQty, order?.items]);

  const totalRequestedQty = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((sum, item: any) => sum + item.quantity, 0);
  }, [order?.items]);

  const totalApprovedQty = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((sum, item: any) => {
      return sum + (approvedQty[item.id] ?? item.approvedQty ?? item.quantity);
    }, 0);
  }, [approvedQty, order?.items]);

  const acceptOrder = () => {
    if (!order) return;
    reviewMutation.mutate({
      orderId: order.id,
      decision: "accept",
      approvalNote: approvalNote.trim() || undefined,
      items: order.items.map((item: any) => ({
        itemId: item.id,
        approvedQty: Math.max(0, Number(approvedQty[item.id] ?? item.quantity)),
      })),
    });
  };

  const rejectOrder = () => {
    if (!order) return;
    reviewMutation.mutate({
      orderId: order.id,
      decision: "reject",
      approvalNote: approvalNote.trim() || undefined,
    });
  };

  /* ── Loading / Error ──────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading order details...
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Package className="mb-3 h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-lg font-semibold">No order details found</h1>
        <Link href="/warehouse/dashboard/order-management" className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium">
          Back to order overview
        </Link>
      </div>
    );
  }

  const StatusIcon = status?.icon ?? Clock;
  const subtotal = order.items.reduce((s: number, i: any) => s + Number(i.totalPrice ?? 0), 0);
  const hasQtyChange = order.items.some((item: any) => {
    const approved = approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
    return approved !== item.quantity;
  });

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/warehouse/dashboard/order-management"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-xl font-bold tracking-tight text-gray-950">
                {order.orderNumber}
              </h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status?.className}`}>
                <StatusIcon className="h-3 w-3" />
                {status?.label}
              </span>
              <OrderSourceBadge source={order.orderSource ?? "direct"} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.warehouse?.label ?? "Warehouse"} · Order Review
            </p>
          </div>
        </div>
      </div>

      {/* ─── Buyer acceptance banner ─── */}
      {order.requiresBuyerAcceptance && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Retailer acceptance is required before dispatch because approved quantities were modified.
        </div>
      )}

      {/* ─── 1. Order Tracker ─── */}
      <OrderFlowStepper steps={data.flow} />

      {/* ─── 2. Purchase Summary (two columns) ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Order Info */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Order Information
            </h2>
          </div>
          <div className="divide-y">
            <InfoRow label="Order ID" value={order.orderNumber} mono />
            <InfoRow label="Order Date" value={formatDate(order.createdAt)} />
            <InfoRow label="Status" value={status?.label ?? "—"} badge={status?.className} />
            <InfoRow label="Payment Method" value={String(order.paymentMethod ?? "—").replace(/_/g, " ")} capitalize />
            <InfoRow
              label="Payment Status"
              value={order.paymentStatus === "paid" ? "✅ Paid" : "⏳ Due"}
              highlight={order.paymentStatus === "paid"}
            />
          </div>
        </div>

        {/* Customer Info */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Customer Information
            </h2>
          </div>
          <div className="divide-y">
            <InfoRow label="Customer" value={order.customerName || "—"} />
            <InfoRow label="Phone" value={order.customerPhone || "—"} />
            <InfoRow label="Area" value={order.shippingArea || order.shippingCity || "—"} />
            <InfoRow label="Source" value={order.orderSource ?? "direct"} capitalize />
          </div>
        </div>
      </div>

      {/* ─── 3. Item Breakdown ─── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Item Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Requested Qty</th>
                <th className="px-5 py-3 text-right">Available</th>
                <th className="px-5 py-3 text-right">Approved Qty</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any) => {
                const qty = approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
                const price = Number(item.modifiedUnitPrice ?? item.unitPrice ?? 0);
                const available = Number(item.stock?.availableQty ?? 0);
                const isLow = available < item.quantity;
                const isReduced = qty < item.quantity;

                return (
                  <tr key={item.id} className="border-b last:border-0 transition-colors hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {item.variant?.sku || `SKU-${item.id}`}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      {item.productSize && (
                        <div className="text-xs text-muted-foreground">{item.productSize}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {item.quantity} {item.variant?.unitLabel || ""}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={isLow ? "font-semibold text-red-600" : ""}>
                        {available.toLocaleString("en-BD")} {item.variant?.unitLabel || ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isPending ? (
                        <input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={qty}
                          disabled={reviewMutation.isPending}
                          onChange={(e) =>
                            setApprovedQty((c) => ({
                              ...c,
                              [item.id]: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="h-8 w-20 rounded-md border bg-white px-2 text-right text-sm tabular-nums transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      ) : (
                        <span className={`tabular-nums ${isReduced ? "font-semibold text-orange-600" : ""}`}>
                          {qty} {item.variant?.unitLabel || ""}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(price)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(qty * price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Qty change warnings */}
        {hasQtyChange && (
          <div className="border-t bg-amber-50/60 px-5 py-3 space-y-1">
            {order.items.map((item: any) => {
              const approved = approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
              const diff = approved - item.quantity;
              if (diff === 0) return null;
              return (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-amber-800">
                    Quantity {diff < 0 ? "reduced" : "changed"} ({item.productName}: {diff > 0 ? "+" : ""}{diff} {item.variant?.unitLabel || ""})
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-amber-800 font-medium">Partial order — quantities adjusted</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. Final Summary ─── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Final Summary
          </h2>
        </div>
        <div className="px-5 py-4">
          <div className="mx-auto max-w-sm space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Requested Qty</span>
              <span className="font-semibold tabular-nums">{totalRequestedQty} Units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Approved Qty</span>
              <span className={`font-semibold tabular-nums ${totalApprovedQty < totalRequestedQty ? "text-orange-600" : ""}`}>
                {totalApprovedQty} Units
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between text-base font-bold text-gray-950">
              <span>Final Order Value</span>
              <span className="text-emerald-700">{formatMoney(finalApprovedTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. Approval Note ─── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Approval Note
          </h2>
        </div>
        <div className="px-5 py-4">
          <textarea
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
            disabled={!isPending || reviewMutation.isPending}
            placeholder="e.g. Stock shortage for Soybean Oil — quantity adjusted accordingly."
            className="min-h-20 w-full rounded-lg border bg-gray-50 p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-muted-foreground"
          />
        </div>
      </div>

      {/* ─── 6. Actions ─── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-gray-50/60 px-5 py-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Actions
          </h2>
        </div>
        <div className="px-5 py-4">
          {data.invoice?.fulfillmentMode && (
            <div className="mb-4 inline-flex items-center rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
              Fulfillment mode:{" "}
              <span className="ml-1 font-semibold capitalize">
                {data.invoice.fulfillmentMode.replace(/_/g, " ")}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            {/* Top row actions */}
            {data.invoice && (
              <Link
                href="/warehouse/dashboard/dispatch-orders"
                className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                <Truck className="h-4 w-4" />
                Go to Dispatch
              </Link>
            )}
            {order.canPrepareDispatch && (
              <button
                type="button"
                onClick={() => prepareMutation.mutate()}
                disabled={prepareMutation.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                {prepareMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Prepare Dispatch
              </button>
            )}
            <Link
              href={`tel:${order.customerPhone}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium transition-colors hover:bg-gray-50"
            >
              <Phone className="h-4 w-4" />
              Contact Customer
            </Link>
          </div>

          {/* Primary actions */}
          {isPending && (
            <>
              <Separator className="my-4" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={rejectOrder}
                  disabled={reviewMutation.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Order
                </button>
                <button
                  type="button"
                  onClick={acceptOrder}
                  disabled={reviewMutation.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {reviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Accept Order
                </button>
              </div>
            </>
          )}

          {!isPending && (
            <>
              <Separator className="my-4" />
              <span className="inline-flex items-center rounded-lg bg-gray-100 px-4 py-2 text-sm text-muted-foreground">
                Approval actions are available only for pending orders.
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function InfoRow({
  label,
  value,
  mono,
  badge,
  highlight,
  capitalize: cap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
  highlight?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge ? (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
          {value}
        </span>
      ) : (
        <span
          className={`text-sm font-semibold text-gray-950 ${mono ? "font-mono tracking-tight" : ""} ${highlight ? "text-emerald-700" : ""} ${cap ? "capitalize" : ""}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}
