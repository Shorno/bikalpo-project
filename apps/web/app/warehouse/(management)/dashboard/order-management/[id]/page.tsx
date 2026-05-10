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
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

function formatMoney(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD")}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatus(status: string, requiresBuyerAcceptance?: boolean) {
  if (status === "cancelled") {
    return {
      label: "Rejected",
      icon: XCircle,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (requiresBuyerAcceptance) {
    return {
      label: "Accepted (Modify)",
      icon: AlertCircle,
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }
  if (status === "confirmed") {
    return {
      label: "Accepted",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "processing") {
    return {
      label: "Processing",
      icon: Truck,
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  return {
    label: "Pending Approval",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/warehouse/dashboard/order-management"
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg border bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-gray-950">
                {order.orderNumber}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status?.className}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status?.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Direct retailer order review
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.canPrepareDispatch && (
            <button
              type="button"
              onClick={() => prepareMutation.mutate()}
              disabled={prepareMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
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
              className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-medium hover:bg-gray-50"
            >
              <Truck className="h-4 w-4" />
              Go to Dispatch
            </Link>
          )}
        </div>
      </div>

      {order.requiresBuyerAcceptance && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Retailer acceptance is required before dispatch because approved
          quantities were modified.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Order Info
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <InfoRow
              icon={FileText}
              label="Order ID"
              value={order.orderNumber}
            />
            <InfoRow
              icon={Clock}
              label="Order Date"
              value={formatDate(order.createdAt)}
            />
            <InfoRow
              icon={User}
              label="Customer"
              value={order.customerName || "Not available"}
            />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={order.customerPhone || "Not available"}
            />
            <InfoRow
              icon={MapPin}
              label="Area"
              value={
                order.shippingArea || order.shippingCity || "Not available"
              }
            />
            <InfoRow
              icon={ShoppingSourceIcon}
              label="Order Source"
              value="Direct retailer order"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Payment / Pre-Order
          </h2>
          <div className="space-y-3 text-sm">
            <StaticLine
              label="Payment Status"
              value={order.paymentStatus === "paid" ? "Paid" : "Due"}
            />
            <StaticLine
              label="Payment Method"
              value={String(order.paymentMethod).replace(/_/g, " ")}
            />
            <StaticLine
              label="Advance Payment"
              value="Not available in Direct v1"
              muted
            />
            <StaticLine label="Priority" value="Static - Normal" muted />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Order Item List
          </h2>
          <span className="text-sm font-semibold">
            {formatMoney(order.total)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3 text-right">Ordered Qty</th>
                <th className="px-3 py-3 text-right">Unit Price</th>
                <th className="px-3 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {item.variant?.sku || `SKU-${item.id}`}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900">
                      {item.productName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.productSize}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-sm">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-3 text-right text-sm">
                    {formatMoney(item.unitPrice)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold">
                    {formatMoney(item.totalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stock & Approval Status
          </h2>
          <span className="rounded-full border bg-gray-50 px-3 py-1 text-sm font-semibold">
            Final Approved Total: {formatMoney(finalApprovedTotal)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3 text-right">Ordered</th>
                <th className="px-3 py-3 text-right">Available Stock</th>
                <th className="px-3 py-3 text-right">Approved Qty</th>
                <th className="px-3 py-3 text-right">Price</th>
                <th className="px-3 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item: any) => {
                const qty =
                  approvedQty[item.id] ?? item.approvedQty ?? item.quantity;
                const price = Number(
                  item.modifiedUnitPrice ?? item.unitPrice ?? 0,
                );
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {item.variant?.sku || `SKU-${item.id}`}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium">
                      {item.productName}
                    </td>
                    <td className="px-3 py-3 text-right text-sm">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-3 text-right text-sm">
                      {Number(item.stock.availableQty).toLocaleString("en-BD")}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={qty}
                        disabled={!isPending || reviewMutation.isPending}
                        onChange={(event) =>
                          setApprovedQty((current) => ({
                            ...current,
                            [item.id]: Math.max(0, Number(event.target.value)),
                          }))
                        }
                        className="h-9 w-24 rounded-lg border px-2 text-right text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-3 py-3 text-right text-sm">
                      {formatMoney(price)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold">
                      {formatMoney(qty * price)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Reason / Approval Note (Optional)
          </span>
          <textarea
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            disabled={!isPending || reviewMutation.isPending}
            placeholder="Stock shortage for an item, delivery note, or approval reason"
            className="min-h-24 w-full rounded-lg border p-3 text-sm outline-none disabled:bg-gray-50"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          {isPending ? (
            <>
              <button
                type="button"
                onClick={acceptOrder}
                disabled={reviewMutation.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
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
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Reject Order
              </button>
            </>
          ) : (
            <span className="inline-flex h-10 items-center rounded-lg border bg-gray-50 px-4 text-sm text-muted-foreground">
              Approval actions are available only for pending orders.
            </span>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Delivery Assignment Flow
        </h2>
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {data.flow.map((step: any, index: number) => (
            <div key={step.key} className="relative rounded-lg border p-3">
              <div
                className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${
                  step.completed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {step.label}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {step.completed ? formatDate(step.date) : "Not available yet"}
              </div>
              <div className="mt-2 text-[11px] font-medium uppercase text-muted-foreground">
                Step {index + 1}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          disabled
          className="rounded-lg border bg-gray-50 p-3 text-left text-sm font-medium text-muted-foreground"
        >
          View Customer - static until customer detail is wired
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border bg-gray-50 p-3 text-left text-sm font-medium text-muted-foreground"
        >
          View Salesman - not applicable to Direct order
        </button>
        <button
          type="button"
          onClick={() => router.push("/warehouse/dashboard/dispatch-orders")}
          className="rounded-lg border bg-white p-3 text-left text-sm font-medium hover:bg-gray-50"
        >
          Dispatch / Ready Orders
        </button>
      </section>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-gray-50/70 p-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-xs font-medium uppercase text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-sm font-semibold text-gray-950">{value}</div>
      </div>
    </div>
  );
}

function StaticLine({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          muted ? "text-muted-foreground" : "font-semibold text-gray-950"
        }
      >
        {value}
      </span>
    </div>
  );
}

function ShoppingSourceIcon({ className }: { className?: string }) {
  return <ShieldCheck className={className} />;
}
