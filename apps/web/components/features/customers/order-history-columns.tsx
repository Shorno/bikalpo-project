"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowUpDown, Eye } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/utils/currency";

export type CustomerOrder = {
  id: number;
  orderNumber: string;
  total: string;
  status: string;
  paymentStatus: string;
  createdAt: Date;
};

const orderStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-700", label: "Pending" },
  confirmed: { color: "bg-blue-100 text-blue-700", label: "Confirmed" },
  processing: { color: "bg-indigo-100 text-indigo-700", label: "Processing" },
  shipped: { color: "bg-purple-100 text-purple-700", label: "Shipped" },
  delivered: { color: "bg-green-100 text-green-700", label: "Delivered" },
  cancelled: { color: "bg-red-100 text-red-700", label: "Cancelled" },
};

const paymentStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-orange-100 text-orange-700", label: "Pending" },
  paid: { color: "bg-green-100 text-green-700", label: "Paid" },
  failed: { color: "bg-red-100 text-red-700", label: "Failed" },
  refunded: { color: "bg-gray-100 text-gray-700", label: "Refunded" },
};

export const orderColumns: ColumnDef<CustomerOrder>[] = [
  {
    accessorKey: "orderNumber",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Order #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("orderNumber")}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) =>
      format(new Date(row.getValue("createdAt")), "MMM d, yyyy"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const config = orderStatusConfig[status] || orderStatusConfig.pending;
      return (
        <Badge variant="secondary" className={config.color}>
          {config.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment",
    cell: ({ row }) => {
      const status = row.getValue("paymentStatus") as string;
      const config = paymentStatusConfig[status] || paymentStatusConfig.pending;
      return (
        <Badge variant="secondary" className={config.color}>
          {config.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "total",
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => (
      <div className="text-right font-medium">
        {formatPrice(row.getValue("total"))}
      </div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const order = row.original;
      return (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/sales/orders/${order.id}`}>
            <Eye className="mr-1 h-4 w-4" />
            View
          </Link>
        </Button>
      );
    },
  },
];
