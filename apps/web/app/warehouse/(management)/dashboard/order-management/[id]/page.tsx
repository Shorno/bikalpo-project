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
  Package,
  Phone,
  ShoppingBag,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ElementType, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { OrderFlowStepper } from "@/components/features/orders/order-flow-stepper";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { OrderSourceBadge } from "./_components/order-source-badge";

/* ── Helpers ─────────────────────────────────────────────── */

function formatMoney(value: unknown) {
  return `৳ ${Number(value || 0).toLocaleString("en-BD")}`;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPercent(value: unknown) {
  const percent = toNumber(value);
  return percent.toLocaleString("en-BD", {
    maximumFractionDigits: percent % 1 === 0 ? 0 : 2,
  });
}

function getLivePricingSummary(
  order: any,
  approvedQty: Record<number, number>,
) {
  const approvedSubtotal = roundMoney(
    order.items.reduce((sum: number, item: any) => {
      const qty = approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
      const price = toNumber(item.modifiedUnitPrice ?? item.unitPrice);
      return sum + qty * price;
    }, 0),
  );

  const serverSummary = order.pricingSummary;
  const storedSubtotal = toNumber(order.subtotal);
  const storedDiscount = toNumber(order.discount);
  const derivedDiscountPercent =
    storedSubtotal > 0 ? (storedDiscount / storedSubtotal) * 100 : 0;
  const discountPercent = toNumber(
    serverSummary?.discountPercent ?? derivedDiscountPercent,
  );
  const discountAmount = Math.min(
    approvedSubtotal,
    roundMoney(approvedSubtotal * (discountPercent / 100)),
  );
  const shippingCost = roundMoney(
    toNumber(serverSummary?.shippingCost ?? order.shippingCost),
  );
  const finalTotal = Math.max(
    0,
    roundMoney(approvedSubtotal - discountAmount + shippingCost),
  );

  return {
    approvedSubtotal,
    discountAmount,
    discountPercent,
    shippingCost,
    finalTotal,
    hasDiscount: discountAmount > 0,
  };
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
  if (status === "invoiced")
    return {
      label: "Invoiced",
      icon: FileText,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  if (status === "partially_invoiced")
    return {
      label: "Partially Invoiced",
      icon: FileText,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  if (status === "ready_for_dispatch")
    return {
      label: "Ready for Dispatch",
      icon: Truck,
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  if (status === "approved")
    return {
      label: "Approved",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  if (status === "confirmed")
    return {
      label: "Approved",
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

  const order = data?.order;
  const status = order
    ? getStatus(order.status, order.requiresBuyerAcceptance)
    : null;
  const isPending = order?.status === "pending";

  const pricingSummary = useMemo(() => {
    if (!order?.items) {
      return {
        approvedSubtotal: 0,
        discountAmount: 0,
        discountPercent: 0,
        shippingCost: 0,
        finalTotal: 0,
        hasDiscount: false,
      };
    }
    return getLivePricingSummary(order, approvedQty);
  }, [approvedQty, order]);

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
  const hasQtyChange = order.items.some((item: any) => {
    const approved = approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
    return approved !== item.quantity;
  });

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-12">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <Link
          href="/warehouse/dashboard/order-management"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-xl font-bold tracking-tight text-foreground">
              {order.orderNumber}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                status?.className,
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {status?.label}
            </span>
            <OrderSourceBadge source={order.orderSource ?? "direct"} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.warehouse?.label ?? "Warehouse"} · Approval and invoice
            readiness
          </p>
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

      {/* ─── 1. Order Tracker ─── */}
      <Section icon={Truck} title="Order Tracker">
        <OrderFlowStepper steps={data.flow} variant="inline" />
      </Section>

      {/* ─── 2. Order + Customer ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Section
          icon={FileText}
          title="Order Information"
          bodyClassName="divide-y divide-border"
        >
          <InfoRow label="Order ID" value={order.orderNumber} mono />
          {data.sourceEstimate && (
            <InfoRow
              label="Estimate"
              value={data.sourceEstimate.estimateNumber}
              mono
            />
          )}
          <InfoRow label="Order Date" value={formatDate(order.createdAt)} />
          <InfoRow
            label="Status"
            value={status?.label ?? "—"}
            badge={status?.className}
          />
          <InfoRow
            label="Payment Method"
            value={String(order.paymentMethod ?? "—").replace(/_/g, " ")}
            capitalize
          />
          <InfoRow
            label="Payment Status"
            value={order.paymentStatus === "paid" ? "Paid" : "Due"}
            highlight={order.paymentStatus === "paid"}
          />
        </Section>

        <Section
          icon={User}
          title="Customer Information"
          bodyClassName="divide-y divide-border"
        >
          <InfoRow label="Customer" value={order.customerName || "—"} />
          <InfoRow label="Phone" value={order.customerPhone || "—"} mono />
          <InfoRow
            label="Area"
            value={order.shippingArea || order.shippingCity || "—"}
          />
          <InfoRow
            label="Source"
            value={order.orderSource ?? "direct"}
            capitalize
          />
        </Section>
      </div>

      {/* ─── 3. Item Breakdown ─── */}
      <Section
        icon={Package}
        title="Item Breakdown"
        description={`${order.items.length} line item${order.items.length === 1 ? "" : "s"}`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">SKU</th>
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 text-right font-semibold">
                  Requested
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  Available
                </th>
                <th className="px-5 py-3 text-right font-semibold">Approved</th>
                <th className="px-5 py-3 text-right font-semibold">Price</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any) => {
                const qty =
                  approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
                const price = Number(
                  item.modifiedUnitPrice ?? item.unitPrice ?? 0,
                );
                const available = Number(item.stock?.availableQty ?? 0);
                const isLow = available < item.quantity;
                const isReduced = qty < item.quantity;

                return (
                  <tr
                    key={item.id}
                    className="border-b transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {item.variant?.sku || `SKU-${item.id}`}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">
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
                      <span
                        className={
                          isLow
                            ? "font-semibold text-red-600"
                            : "text-muted-foreground"
                        }
                      >
                        {available.toLocaleString("en-BD")}{" "}
                        {item.variant?.unitLabel || ""}
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
                          className="h-8 w-20 rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      ) : (
                        <span
                          className={cn(
                            "tabular-nums",
                            isReduced && "font-semibold text-orange-600",
                          )}
                        >
                          {qty} {item.variant?.unitLabel || ""}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
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

        {/* Qty change warnings */}
        {hasQtyChange && (
          <div className="space-y-1 border-t bg-amber-50/50 px-5 py-3">
            {order.items.map((item: any) => {
              const approved =
                approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
              const diff = approved - item.quantity;
              if (diff === 0) return null;
              return (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="text-amber-800">
                    Quantity {diff < 0 ? "reduced" : "changed"} (
                    {item.productName}: {diff > 0 ? "+" : ""}
                    {diff} {item.variant?.unitLabel || ""})
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="font-medium text-amber-800">
                Partial order — quantities adjusted
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* ─── 4. Final Summary ─── */}
      <Section icon={CreditCard} title="Final Summary" bodyClassName="p-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-border border-b sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Requested" value={totalRequestedQty} unit="units" />
          <Stat
            label="Approved"
            value={totalApprovedQty}
            unit="units"
            tone={
              totalApprovedQty < totalRequestedQty
                ? "text-orange-600"
                : undefined
            }
          />
          <Stat
            label="Invoiced"
            value={order.invoiceProgress?.invoicedQty ?? 0}
            unit="units"
          />
          <Stat
            label="Remaining"
            value={order.invoiceProgress?.remainingQty ?? totalApprovedQty}
            unit="units"
          />
        </div>
        <div className="flex justify-end p-5">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatMoney(pricingSummary.approvedSubtotal)}
              </span>
            </div>
            {pricingSummary.hasDiscount && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {order.orderSource === "estimate"
                    ? "Estimate Discount"
                    : "Discount"}{" "}
                  ({formatPercent(pricingSummary.discountPercent)}%)
                </span>
                <span className="font-medium tabular-nums text-red-600">
                  -{formatMoney(pricingSummary.discountAmount)}
                </span>
              </div>
            )}
            {pricingSummary.shippingCost > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(pricingSummary.shippingCost)}
                </span>
              </div>
            )}
            <Separator className="my-2.5" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Final Order Value
              </span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {formatMoney(pricingSummary.finalTotal)}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 5. Review & Decision ─── */}
      <Section
        icon={ShoppingBag}
        title="Review & Decision"
        bodyClassName="space-y-4 p-5"
      >
        {isPending && (
          <div className="space-y-1.5">
            <label htmlFor="approvalNote" className="text-sm font-medium">
              Approval Note
            </label>
            <textarea
              id="approvalNote"
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              disabled={reviewMutation.isPending}
              placeholder="e.g. Stock shortage for Soybean Oil — quantity adjusted accordingly."
              className="min-h-20 w-full rounded-lg border bg-background p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            />
          </div>
        )}

        {data.invoice?.fulfillmentMode && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Fulfillment mode</span>
            <span className="font-medium capitalize text-foreground">
              {data.invoice.fulfillmentMode === "delivery"
                ? "delivery management"
                : data.invoice.fulfillmentMode.replace(/_/g, " ")}
            </span>
          </div>
        )}

        <div
          className={cn(
            "flex flex-wrap items-center gap-2.5",
            (isPending || data.invoice?.fulfillmentMode) && "border-t pt-4",
          )}
        >
          {order.canOpenDispatch && (
            <Link
              href="/warehouse/dashboard/dispatch-orders"
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Truck className="h-4 w-4" />
              Open Dispatch
            </Link>
          )}
          <Link
            href={`tel:${order.customerPhone}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Phone className="h-4 w-4" />
            Contact Customer
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {isPending ? (
              <>
                <button
                  type="button"
                  onClick={rejectOrder}
                  disabled={reviewMutation.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-background px-5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Order
                </button>
                <button
                  type="button"
                  onClick={acceptOrder}
                  disabled={reviewMutation.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {reviewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve Order
                </button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Approval actions are available only for pending orders.
              </span>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  description,
  children,
  bodyClassName,
}: {
  icon: ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center gap-2.5 px-5 py-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-none text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </header>
      <div className={cn("border-t", bodyClassName ?? "p-5")}>{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number | string;
  unit?: string;
  tone?: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "text-lg font-semibold tabular-nums text-foreground",
            tone,
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

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
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            badge,
          )}
        >
          {value}
        </span>
      ) : (
        <span
          className={cn(
            "text-sm font-semibold text-foreground",
            mono && "font-mono tracking-tight",
            highlight && "text-emerald-700",
            cap && "capitalize",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}
