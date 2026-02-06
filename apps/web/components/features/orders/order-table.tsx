"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowRight, ClipboardCheck, Eye, Package } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderWithItems } from "@/db/schema/order";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "All Payment" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

// Helper functions
function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    processing: "bg-purple-100 text-purple-800 border-purple-200",
    shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
}

function getPaymentStatusColor(status: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

function formatPrice(price: string | number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
  }).format(new Date(date));
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Mobile Order Card Component
function MobileOrderCard({ order }: { order: OrderWithItems }) {
  const isPending = order.status === "pending";

  return (
    <Card className="overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-0">
        {/* Header Row */}
        <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{order.orderNumber}</span>
            <Badge className={cn("text-xs", getStatusColor(order.status))}>
              {capitalize(order.status)}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDate(order.createdAt)}
          </span>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Customer Info */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {order.user?.shopName || order.shippingName}
              </p>
              <p className="text-xs text-muted-foreground">
                {order.shippingPhone}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold">{formatPrice(order.total)}</p>
              <p className="text-xs text-muted-foreground">
                {order.items.length} items
              </p>
            </div>
          </div>

          {/* Footer with Payment Status and Action */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Badge
              className={cn(
                "text-xs",
                getPaymentStatusColor(order.paymentStatus),
              )}
            >
              {capitalize(order.paymentStatus)}
            </Badge>

            {isPending ? (
              <Button size="sm" className="h-8" asChild>
                <Link href={`${ADMIN_BASE}/orders/${order.id}`}>
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
                  Review
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8" asChild>
                <Link href={`${ADMIN_BASE}/orders/${order.id}`}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  View
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export default function OrderTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [paymentFilter, setPaymentFilter] = React.useState("all");
  const [searchValue, setSearchValue] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Get paginated data for mobile view (uses table's pagination state)
  const paginatedMobileData = React.useMemo(() => {
    return table
      .getRowModel()
      .rows.map((row) => row.original as OrderWithItems);
  }, [table.getRowModel]);

  return (
    <div className="w-full">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 py-4">
        <Input
          placeholder="Filter by order number..."
          value={searchValue}
          onChange={(event) => {
            setSearchValue(event.target.value);
            table.getColumn("orderNumber")?.setFilterValue(event.target.value);
          }}
          className="sm:max-w-[200px]"
        />
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              table
                .getColumn("status")
                ?.setFilterValue(value === "all" ? "" : value);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={paymentFilter}
            onValueChange={(value) => {
              setPaymentFilter(value);
              table
                .getColumn("paymentStatus")
                ?.setFilterValue(value === "all" ? "" : value);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <span>No orders found</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {paginatedMobileData.length > 0 ? (
          paginatedMobileData.map((order) => (
            <MobileOrderCard key={order.id} order={order} />
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2" />
              <span>No orders found</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()} ({data.length} orders)
        </div>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
