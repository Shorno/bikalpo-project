"use client";

import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Eye, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  customerLabel,
  formatMoney,
  type DeliveryInvoiceRow,
  getDeliveryTypeLabel,
  getDisplayStatusLabel,
  getDisplayStatusTone,
} from "./delivery-utils";

export type DeliveryColumnActions = {
  onView: (invoice: DeliveryInvoiceRow) => void;
  rowSelection: RowSelectionState;
  onToggleRow: (invoice: DeliveryInvoiceRow, checked: boolean) => void;
  onToggleAll: (checked: boolean, rows: DeliveryInvoiceRow[]) => void;
};

export function getDeliveryColumns(
  actions: DeliveryColumnActions,
  rows: DeliveryInvoiceRow[],
): ColumnDef<DeliveryInvoiceRow>[] {
  const selectableRows = rows.filter((row) => row.isSelectable);
  const selectedSelectableCount = selectableRows.filter(
    (row) => actions.rowSelection[String(row.id)],
  ).length;
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectedSelectableCount === selectableRows.length;
  const someSelectableSelected =
    selectedSelectableCount > 0 && !allSelectableSelected;

  return [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={
            allSelectableSelected
              ? true
              : someSelectableSelected
                ? "indeterminate"
                : false
          }
          disabled={selectableRows.length === 0}
          onCheckedChange={(checked) =>
            actions.onToggleAll(checked === true, rows)
          }
          aria-label="Select all pending invoices"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={!!actions.rowSelection[String(row.original.id)]}
          disabled={!row.original.isSelectable}
          onCheckedChange={(checked) =>
            actions.onToggleRow(row.original, checked === true)
          }
          aria-label={`Select invoice ${row.original.invoiceNumber}`}
        />
      ),
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice ID",
      cell: ({ row }) => (
        <span className="font-mono text-[13px] font-semibold tracking-tight">
          {row.original.invoiceNumber}
        </span>
      ),
    },
    {
      id: "orderNumber",
      header: "Order ID",
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {row.original.order?.orderNumber ?? "—"}
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
              {customerLabel(row.original)}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.customer.phoneNumber ?? "—"}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "deliveryType",
      header: "Delivery Type",
      cell: ({ row }) => (
        <span className="text-sm">
          {getDeliveryTypeLabel(row.original.deliveryType)}
        </span>
      ),
    },
    {
      accessorKey: "grandTotal",
      header: "Amount",
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {formatMoney(row.original.grandTotal)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getDisplayStatusTone(row.original.displayStatus)}>
          {getDisplayStatusLabel(row.original.displayStatus)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => actions.onView(row.original)}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      ),
      enableSorting: false,
    },
  ];
}
