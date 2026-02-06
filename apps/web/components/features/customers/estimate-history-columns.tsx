"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SALES_BASE } from "@/lib/routes";
import { formatPrice } from "@/utils/currency";

export type CustomerEstimate = {
  id: number;
  estimateNumber: string;
  total: string;
  status: string;
  createdAt: Date;
};

const estimateStatusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  pending: { color: "bg-yellow-100 text-yellow-700", label: "Pending" },
  sent: { color: "bg-blue-100 text-blue-700", label: "Sent" },
  approved: { color: "bg-green-100 text-green-700", label: "Approved" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected" },
  converted: { color: "bg-purple-100 text-purple-700", label: "Converted" },
};

export const estimateColumns: ColumnDef<CustomerEstimate>[] = [
  {
    accessorKey: "estimateNumber",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Estimate #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("estimateNumber")}</span>
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
      const config = estimateStatusConfig[status] || estimateStatusConfig.draft;
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
    cell: ({ row }) => {
      const estimate = row.original;
      return (
        <div className="text-right">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${SALES_BASE}/estimates/${estimate.id}`}>View</Link>
          </Button>
        </div>
      );
    },
  },
];
