"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowUpDown, Clock, Eye } from "lucide-react";
import Link from "next/link";
import type { CustomerListItem } from "@/actions/employee/get-assigned-customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SALES_BASE } from "@/lib/routes";
import { formatPrice } from "@/utils/currency";

export function getCustomerColumns(
  onQuickView?: (customerId: string) => void,
): ColumnDef<CustomerListItem>[] {
  return [
    {
      accessorKey: "shopName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Shop Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("shopName") || "—"}</div>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Owner Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div>{row.getValue("name")}</div>,
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone",
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.getValue("phoneNumber") || "—"}
        </div>
      ),
    },
    {
      accessorKey: "totalEstimates",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="w-full justify-center"
        >
          Estimates
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="secondary">{row.getValue("totalEstimates")}</Badge>
        </div>
      ),
    },
    {
      accessorKey: "totalOrders",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="w-full justify-center"
        >
          Orders
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="outline">{row.getValue("totalOrders")}</Badge>
        </div>
      ),
    },
    {
      accessorKey: "totalSpent",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="w-full justify-end"
        >
          Total Spent
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {formatPrice(row.getValue("totalSpent"))}
        </div>
      ),
    },
    {
      accessorKey: "lastActivityAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Activity
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.getValue("lastActivityAt") as Date | null;
        return (
          <div className="text-muted-foreground">
            {date ? format(new Date(date), "MMM d, yyyy") : "No activity"}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const customer = row.original;

        return (
          <div className="flex items-center gap-1">
            {onQuickView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onQuickView(customer.id)}
              >
                <Clock className="mr-1 h-4 w-4" />
                Quick
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${SALES_BASE}/customers/${customer.id}`}>
                <Eye className="mr-1 h-4 w-4" />
                View
              </Link>
            </Button>
          </div>
        );
      },
    },
  ];
}

// Keep the static columns for backward compatibility
export const customerColumns: ColumnDef<CustomerListItem>[] =
  getCustomerColumns();
