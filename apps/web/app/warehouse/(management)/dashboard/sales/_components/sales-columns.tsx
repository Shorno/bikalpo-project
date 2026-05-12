"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ── Types ───────────────────────────────────────────────── */

export type SaleType = "all" | "pos" | "order" | "salesman" | "pre_order";
export type SaleStatus = "all" | "completed" | "due" | "cancelled";

export type SaleRow = {
  key: string;
  kind: "pos" | "invoice";
  id: number;
  invoiceNumber: string;
  date: string | Date;
  customerName: string;
  customerPhone: string | null;
  type: Exclude<SaleType, "all">;
  typeLabel: string;
  typeDetail: string | null;
  total: number;
  paid: number;
  due: number;
  paymentMethodLabel: string;
  status: Exclude<SaleStatus, "all">;
  statusLabel: string;
  orderNumber: string | null;
  estimateRef: string | null;
  salesmanName: string | null;
  itemCount: number;
  firstItemName: string | null;
};

/* ── Helpers ──────────────────────────────────────────────── */

function money(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return `৳${(Number.isFinite(parsed) ? parsed : 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dateLabel = date.toLocaleDateString("en-BD", { day: "numeric", month: "short" });
  const timeLabel = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} ${timeLabel}`;
}

function statusClassName(status: SaleRow["status"]) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function typeClassName(type: SaleRow["type"]) {
  const map: Record<string, string> = {
    pos: "border-emerald-200 bg-emerald-50 text-emerald-700",
    order: "border-rose-200 bg-rose-50 text-rose-700",
    salesman: "border-sky-200 bg-sky-50 text-sky-700",
    pre_order: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return map[type] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

/* ── Column definitions ──────────────────────────────────── */

export const salesColumns: ColumnDef<SaleRow>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Invoice",
    cell: ({ row }) => (
      <span className="font-mono text-[13px] font-semibold tracking-tight text-foreground">
        {row.original.invoiceNumber}
      </span>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "date",
    header: "Date & Time",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground tabular-nums">
        {formatDateTime(row.original.date)}
      </span>
    ),
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.original.customerName}</div>
          <div className="text-xs text-muted-foreground">{row.original.customerPhone || "No phone"}</div>
        </div>
      </div>
    ),
  },
  {
    id: "type",
    header: "Type",
    cell: ({ row }) => (
      <div>
        <Badge variant="outline" className={cn("font-semibold", typeClassName(row.original.type))}>
          {row.original.typeLabel}
        </Badge>
        {row.original.salesmanName && (
          <div className="mt-1 text-xs text-muted-foreground">{row.original.salesmanName}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "total",
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => (
      <div className="text-right text-sm font-semibold tabular-nums">
        {money(row.original.total)}
      </div>
    ),
  },
  {
    accessorKey: "paid",
    header: () => <div className="text-right">Paid</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        <span className="text-sm">{money(row.original.paid)}</span>
        <div className="text-xs text-muted-foreground">{row.original.paymentMethodLabel}</div>
      </div>
    ),
  },
  {
    accessorKey: "due",
    header: () => <div className="text-right">Due</div>,
    cell: ({ row }) => (
      <div className="text-right text-sm font-semibold tabular-nums">
        <span className={row.original.due > 0 ? "text-amber-700" : "text-muted-foreground"}>
          {money(row.original.due)}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original;
      return (
        <Badge variant="outline" className={cn("gap-1 font-semibold", statusClassName(s.status))}>
          {s.status === "completed" ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          {s.statusLabel}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Action</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button
          type="button"
          data-kind={row.original.kind}
          data-id={row.original.id}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          View
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    ),
  },
];
