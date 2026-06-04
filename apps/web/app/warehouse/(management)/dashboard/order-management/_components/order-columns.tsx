"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  PackageCheck,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ── Types ───────────────────────────────────────────────── */

export type OrderRow = {
  id: number;
  orderNumber: string;
  customerName: string;
  shippingPhone: string;
  createdAt: string | Date;
  total: string | number;
  status: string;
  itemCount: number;
  firstItemName: string | null;
  requiresBuyerAcceptance?: boolean;
  invoicePrepared?: boolean;
  invoiceDeliveryStatus?: string | null;
  invoiceFulfillmentMode?: string | null;
  deliveryGroupStatus?: string | null;
  deliverymanId?: string | null;
  readyAt?: string | Date | null;
  packingStartedAt?: string | Date | null;
  shippingArea?: string | null;
  shippingCity?: string | null;
  orderSource?: string | null;
  // future fields for other sources
  salesmanName?: string | null;
  estimateId?: string | null;
  advancePaid?: number | null;
  balanceDue?: number | null;
  expectedDeliveryDate?: string | Date | null;
};

/* ── Helpers ──────────────────────────────────────────────── */

function formatMoney(value: unknown) {
  return `৳ ${Number(value || 0).toLocaleString("en-BD")}`;
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(order: OrderRow) {
  if (order.status === "cancelled")
    return { label: "Rejected", className: "border-red-200 bg-red-50 text-red-700", icon: XCircle };
  if (order.requiresBuyerAcceptance)
    return { label: "Buyer review", className: "border-orange-200 bg-orange-50 text-orange-700", icon: AlertCircle };
  if (order.status === "delivered" || order.invoiceDeliveryStatus === "delivered" || order.deliveryGroupStatus === "completed")
    return { label: "Delivered", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
  if (order.invoiceFulfillmentMode === "self_pickup" && order.invoiceDeliveryStatus !== "delivered")
    return { label: "Self pickup pending", className: "border-amber-200 bg-amber-50 text-amber-700", icon: PackageCheck };
  if (order.invoiceFulfillmentMode === "internal_delivery" && order.invoiceDeliveryStatus === "not_assigned")
    return { label: "Awaiting rider", className: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck };
  if (order.deliveryGroupStatus === "partial")
    return { label: "Partial delivery", className: "border-amber-200 bg-amber-50 text-amber-700", icon: AlertCircle };
  if (order.deliveryGroupStatus === "out_for_delivery")
    return { label: "Out for delivery", className: "border-blue-200 bg-blue-50 text-blue-700", icon: Truck };
  if (order.deliveryGroupStatus === "assigned" || order.deliverymanId)
    return { label: "Delivery assigned", className: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck };
  if (order.invoicePrepared || order.readyAt || order.packingStartedAt)
    return { label: "Ready for dispatch", className: "border-violet-200 bg-violet-50 text-violet-700", icon: PackageCheck };
  if (order.status === "processing")
    return { label: "Processing", className: "border-blue-200 bg-blue-50 text-blue-700", icon: Truck };
  if (order.status === "confirmed")
    return { label: "Accepted", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
  return { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock };
}

/* ── Shared cells ────────────────────────────────────────── */

const orderCell: ColumnDef<OrderRow> = {
  accessorKey: "orderNumber",
  header: "Order ID",
  cell: ({ row }) => (
    <span className="font-mono text-[13px] font-semibold tracking-tight text-foreground">
      {row.original.orderNumber}
    </span>
  ),
  enableHiding: false,
};

const customerCell: ColumnDef<OrderRow> = {
  accessorKey: "customerName",
  header: "Customer",
  cell: ({ row }) => (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{row.original.customerName}</div>
        <div className="text-xs text-muted-foreground">{row.original.shippingPhone}</div>
      </div>
    </div>
  ),
};

const dateCell: ColumnDef<OrderRow> = {
  accessorKey: "createdAt",
  header: "Date",
  cell: ({ row }) => (
    <span className="text-sm text-muted-foreground tabular-nums">
      {formatDate(row.original.createdAt)}
    </span>
  ),
};

const amountCell: ColumnDef<OrderRow> = {
  accessorKey: "total",
  header: () => <div className="text-right">Amount</div>,
  cell: ({ row }) => (
    <div className="text-right text-sm font-semibold tabular-nums">
      {formatMoney(row.original.total)}
    </div>
  ),
};

const statusCell: ColumnDef<OrderRow> = {
  id: "status",
  header: "Status",
  cell: ({ row }) => {
    const badge = statusBadge(row.original);
    const Icon = badge.icon;
    return (
      <Badge variant="outline" className={cn("gap-1 font-semibold", badge.className)}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </Badge>
    );
  },
};

const actionCell: ColumnDef<OrderRow> = {
  id: "actions",
  header: () => <div className="text-right">Action</div>,
  cell: ({ row }) => (
    <div className="text-right">
      <Link
        href={`/warehouse/dashboard/order-management/${row.original.id}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"
      >
        View Details
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  ),
};

/* ── Source-specific column sets ──────────────────────────── */

/** 🔴 Direct — Customer directly placed order, no salesman */
export const directColumns: ColumnDef<OrderRow>[] = [
  orderCell,
  customerCell,
  dateCell,
  amountCell,
  statusCell,
  actionCell,
];

/** 🔵 Salesman — Order created manually by salesman */
export const salesmanColumns: ColumnDef<OrderRow>[] = [
  orderCell,
  customerCell,
  {
    id: "salesmanName",
    header: "Salesman",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.salesmanName ?? "—"}</span>
    ),
  },
  dateCell,
  amountCell,
  statusCell,
  actionCell,
];

/** 🟣 Estimate — Estimate approved & converted into order */
export const estimateColumns: ColumnDef<OrderRow>[] = [
  orderCell,
  {
    id: "estimateId",
    header: "Estimate ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.estimateId ?? "—"}
      </span>
    ),
  },
  customerCell,
  amountCell,
  statusCell,
  actionCell,
];

/** 🟡 Pre-Order — Advance payment before processing */
export const preOrderColumns: ColumnDef<OrderRow>[] = [
  orderCell,
  customerCell,
  {
    id: "advancePaid",
    header: "Advance Paid",
    cell: ({ row }) => (
      <span className="text-sm font-medium tabular-nums">
        {row.original.advancePaid ? formatMoney(row.original.advancePaid) : "—"}
      </span>
    ),
  },
  {
    id: "balanceDue",
    header: "Balance",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">
        {row.original.balanceDue ? formatMoney(row.original.balanceDue) : "—"}
      </span>
    ),
  },
  {
    id: "deliveryDate",
    header: "Delivery Date",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.expectedDeliveryDate
          ? formatDate(row.original.expectedDeliveryDate)
          : "—"}
      </span>
    ),
  },
  statusCell,
  actionCell,
];

/** Get columns for a given source type */
export function getColumnsForSource(source: string): ColumnDef<OrderRow>[] {
  switch (source) {
    case "salesman":
      return salesmanColumns;
    case "estimate":
      return estimateColumns;
    case "pre_order":
      return preOrderColumns;
    default:
      return directColumns;
  }
}
