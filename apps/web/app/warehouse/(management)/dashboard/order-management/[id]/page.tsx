"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Truck,
  User,
  XCircle,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { Badge } from "@/components/ui/badge";
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
    return {
      label: "Rejected",
      icon: XCircle,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  if (requiresBuyerAcceptance)
    return {
      label: "Accepted (Modified)",
      icon: AlertCircle,
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  if (status === "confirmed")
    return {
      label: "Accepted",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  if (status === "processing")
    return {
      label: "Processing",
      icon: Truck,
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  return {
    label: "Pending Approval",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
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
    mutationFn: (
      input: Parameters<typeof orpc.warehouse.reviewOrder.call>[0],
    ) => orpc.warehouse.reviewOrder.call(input),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "order-management"],
      });
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "order-management-detail", orderId],
      });
    },
    onError: (error) => toast.error(error.message || "Failed to review order"),
  });

  const prepareMutation = useMutation({
    mutationFn: () => orpc.warehouse.prepareOrderForDispatch.call({ orderId }),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "order-management-detail", orderId],
      });
    },
    onError: (error) =>
      toast.error(error.message || "Failed to prepare dispatch"),
  });

  const order = data?.order;
  const status = order
    ? getStatus(order.status, order.requiresBuyerAcceptance)
    : null;
  const isPending = order?.status === "pending";

  const finalApprovedTotal = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((sum, item: any) => {
      const qty = approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
      const price = Number(item.modifiedUnitPrice ?? item.unitPrice ?? 0);
      return sum + qty * price;
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
        <Link
          href="/warehouse/dashboard/order-management"
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Back to order overview
        </Link>
      </div>
    );
  }

  const StatusIcon = status?.icon ?? Clock;
  const subtotal = order.items.reduce(
    (s: number, i: any) => s + Number(i.totalPrice ?? 0),
    0,
  );

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/warehouse/dashboard/order-management"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-gray-950">
                {order.orderNumber}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status?.className}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status?.label}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Warehouse className="h-3.5 w-3.5" />
              <span>{data.warehouse?.label ?? "Warehouse"}</span>
              <span className="text-gray-300">·</span>
              <span>Order Review</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.canPrepareDispatch && (
            <button
              type="button"
              onClick={() => prepareMutation.mutate()}
              disabled={prepareMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
            >
              {prepareMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Prepare Dispatch
            </button>
          )}
          {data.invoice && (
            <Link
              href="/warehouse/dashboard/dispatch-orders"
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-5 text-sm font-medium transition-colors hover:bg-gray-50"
            >
              <Truck className="h-4 w-4" />
              Go to Dispatch
            </Link>
          )}
        </div>
      </div>

      {/* ─── Buyer acceptance banner ─── */}
      {order.requiresBuyerAcceptance && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Retailer acceptance is required before dispatch because approved
          quantities were modified.
        </div>
      )}

      {/* ─── Flow Stepper ─── */}
      <OrderFlowStepper steps={data.flow} />

      {/* ─── Order Info + Payment ─── */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Order Info */}
        <div className="rounded-xl border bg-white shadow-sm lg:col-span-2">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Order Information
            </h2>
          </div>
          <div className="grid gap-px bg-gray-100 md:grid-cols-2">
            <InfoCell icon={FileText} label="Order ID" value={order.orderNumber} />
            <InfoCell icon={Clock} label="Order Date" value={formatDate(order.createdAt)} />
            <InfoCell icon={User} label="Customer" value={order.customerName || "—"} />
            <InfoCell icon={Phone} label="Phone" value={order.customerPhone || "—"} />
            <InfoCell icon={MapPin} label="Area" value={order.shippingArea || order.shippingCity || "—"} />
            <div className="flex items-center gap-3 bg-white px-5 py-3.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-[11px] font-medium uppercase text-muted-foreground">
                  Order Source
                </div>
                <div className="mt-1">
                  <OrderSourceBadge source={order.orderSource ?? "direct"} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Payment Details
            </h2>
          </div>
          <div className="space-y-0 divide-y">
            <PaymentRow
              label="Payment Status"
              value={order.paymentStatus === "paid" ? "Paid" : "Due"}
              highlight={order.paymentStatus === "paid"}
            />
            <PaymentRow
              label="Payment Method"
              value={String(order.paymentMethod ?? "—").replace(/_/g, " ")}
            />
            <PaymentRow label="Priority" value="Normal" muted />
          </div>
        </div>
      </section>

      {/* ─── Order Item List ─── */}
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Order Item List
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Ordered Qty</th>
                <th className="px-5 py-3 text-right">Unit Price</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any) => (
                <tr
                  key={item.id}
                  className="border-b last:border-0 transition-colors hover:bg-gray-50/50"
                >
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {item.variant?.sku || `SKU-${item.id}`}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">
                      {item.productName}
                    </div>
                    {item.productSize && (
                      <div className="text-xs text-muted-foreground">
                        {item.productSize}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {item.quantity} {item.variant?.unitLabel || ""}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">
                    {formatMoney(item.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="border-t bg-gray-50/60 px-5 py-4">
          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />
            <SummaryRow label="Discount" value={formatMoney(0)} muted />
            <SummaryRow label="Est. Delivery Charge" value={formatMoney(0)} muted />
            <Separator className="my-2" />
            <div className="flex items-center justify-between text-base font-bold text-gray-950">
              <span>Estimated Total</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stock & Approval ─── */}
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b px-5 py-3.5 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Stock &amp; Approval Status
          </h2>
          <div className="inline-flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-1.5 text-sm font-semibold tabular-nums">
            Final Approved Total:
            <span className="text-emerald-700">
              {formatMoney(finalApprovedTotal)}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Ordered</th>
                <th className="px-5 py-3 text-right">Available Stock</th>
                <th className="px-5 py-3 text-right">Approved Qty</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any) => {
                const qty =
                  approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
                const price = Number(
                  item.modifiedUnitPrice ?? item.unitPrice ?? 0,
                );
                const available = Number(item.stock.availableQty);
                const isLow = available < item.quantity;

                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 transition-colors hover:bg-gray-50/50"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {item.variant?.sku || `SKU-${item.id}`}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {item.productName}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {item.quantity} {item.variant?.unitLabel || ""}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={isLow ? "font-semibold text-red-600" : ""}>
                        {available.toLocaleString("en-BD")}{" "}
                        {item.variant?.unitLabel || ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={qty}
                        disabled={!isPending || reviewMutation.isPending}
                        onChange={(e) =>
                          setApprovedQty((c) => ({
                            ...c,
                            [item.id]: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="h-9 w-24 rounded-lg border bg-white px-2 text-right text-sm tabular-nums transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-muted-foreground"
                      />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatMoney(price)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {formatMoney(qty * price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Approval note + actions */}
        <div className="border-t bg-gray-50/40 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Reason / Approval Note (Optional)
            </span>
            <textarea
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              disabled={!isPending || reviewMutation.isPending}
              placeholder="e.g. Stock shortage for Soybean Oil"
              className="min-h-20 w-full rounded-lg border bg-white p-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:text-muted-foreground"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {isPending ? (
              <>
                <button
                  type="button"
                  onClick={acceptOrder}
                  disabled={reviewMutation.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {reviewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Accept Order
                </button>
                <button
                  type="button"
                  onClick={rejectOrder}
                  disabled={reviewMutation.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Order
                </button>
              </>
            ) : (
              <span className="inline-flex h-10 items-center rounded-lg border bg-gray-100 px-4 text-sm text-muted-foreground">
                Approval actions are available only for pending orders.
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function InfoCell({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white px-5 py-3.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <div className="text-[11px] font-medium uppercase text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-gray-950">
          {value}
        </div>
      </div>
    </div>
  );
}

function PaymentRow({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          highlight
            ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
            : muted
              ? "text-sm text-muted-foreground"
              : "text-sm font-semibold text-gray-950"
        }
      >
        {value}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={muted ? "text-muted-foreground" : "font-semibold text-gray-950"}
      >
        {value}
      </span>
    </div>
  );
}
