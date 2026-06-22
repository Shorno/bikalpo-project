"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  FileText,
  Loader2,
  MapPin,
  Package,
  Plus,
  User,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type DispatchStatus =
  | "ready_for_dispatch"
  | "partially_invoiced"
  | "invoiced";

export type DispatchOrderRow = {
  id: number;
  orderNumber: string;
  status: DispatchStatus;
  createdAt: string | Date;
  readyAt: string | Date | null;
  customer: {
    id: string;
    name: string;
    phoneNumber: string | null;
    shopName: string | null;
    warehouseName: string | null;
  };
  shipping: {
    name: string;
    phone: string;
    address: string;
    city: string;
    area: string | null;
  };
  progress: {
    approvedQty: number;
    invoicedQty: number;
    remainingQty: number;
    approvedTotal: string;
    invoicedTotal: string;
    remainingTotal: string;
  };
  items: Array<{
    orderItemId: number;
    productId: number;
    productName: string;
    productSku: string;
    approvedQty: number;
    invoicedQty: number;
    remainingQty: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    invoiceType: "main" | "split";
    splitSequence: number | null;
    grandTotal: string;
    deliveryStatus: string;
    createdAt: string;
  }>;
};

export type DispatchColumnActions = {
  actionLoading: string | null;
  onCreateFullInvoice: (order: DispatchOrderRow) => void;
  onOpenPartialInvoice: (order: DispatchOrderRow) => void;
};

function customerName(order: DispatchOrderRow) {
  return (
    order.customer.warehouseName ||
    order.customer.shopName ||
    order.customer.name ||
    order.shipping.name
  );
}

export function getDispatchColumns(
  actions: DispatchColumnActions,
): ColumnDef<DispatchOrderRow>[] {
  return [
    {
      accessorKey: "orderNumber",
      header: "Order ID",
      cell: ({ row }) => (
        <span className="font-mono text-[13px] font-semibold tracking-tight text-foreground">
          {row.original.orderNumber}
        </span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {customerName(row.original)}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.customer.phoneNumber || row.original.shipping.phone}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "area",
      header: "Area",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-sm">
              {row.original.shipping.area || "—"}
            </div>
            {row.original.shipping.city ? (
              <div className="truncate text-xs text-muted-foreground">
                {row.original.shipping.city}
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "items",
      header: "Items",
      cell: ({ row }) => {
        const itemCount = row.original.items.length;
        const firstItemName = row.original.items[0]?.productName;

        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium tabular-nums">
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
            </div>
            {firstItemName ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {firstItemName}
                {itemCount > 1 ? ` +${itemCount - 1} more` : ""}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Action</div>,
      cell: ({ row }) => {
        const order = row.original;
        const canInvoice =
          order.status !== "invoiced" && order.progress.remainingQty > 0;
        const fullLoading = actions.actionLoading === `full-${order.id}`;
        const partialLoading = actions.actionLoading === `partial-${order.id}`;

        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {canInvoice ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-8 gap-1 bg-emerald-600 px-2.5 text-xs hover:bg-emerald-700"
                  disabled={!!actions.actionLoading}
                  onClick={() => actions.onCreateFullInvoice(order)}
                >
                  {fullLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {order.status === "partially_invoiced"
                    ? "Invoice Remaining"
                    : "Full Invoice"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 px-2.5 text-xs"
                  disabled={!!actions.actionLoading}
                  onClick={() => actions.onOpenPartialInvoice(order)}
                >
                  {partialLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Partial
                </Button>
              </>
            ) : null}
            <Link
              href={`/warehouse/dashboard/order-management/${order.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              View
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        );
      },
    },
  ];
}
