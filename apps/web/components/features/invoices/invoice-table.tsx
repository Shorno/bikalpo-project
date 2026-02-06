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
import { FileText } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
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

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "delivered", label: "Delivered" },
  { value: "closed", label: "Closed" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "All Payment" },
  { value: "unpaid", label: "Unpaid" },
  { value: "collected", label: "Collected" },
  { value: "settled", label: "Settled" },
];

const DELIVERY_OPTIONS = [
  { value: "all", label: "All Delivery" },
  { value: "pending", label: "Pending" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

const INVOICE_TYPE_OPTIONS = [
  { value: "all", label: "All Invoices" },
  { value: "main", label: "Main Invoices" },
  { value: "split", label: "Partial Invoices" },
];

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export default function InvoiceTable<TData, TValue>({
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

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2 py-4">
        <Input
          placeholder="Filter by invoice number..."
          value={
            (table.getColumn("invoiceNumber")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("invoiceNumber")?.setFilterValue(event.target.value)
          }
          className="max-w-[200px]"
        />
        <Select
          value={
            (table.getColumn("status")?.getFilterValue() as string) ?? "all"
          }
          onValueChange={(value) =>
            table
              .getColumn("status")
              ?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={
            (table.getColumn("paymentStatus")?.getFilterValue() as string) ??
            "all"
          }
          onValueChange={(value) =>
            table
              .getColumn("paymentStatus")
              ?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={
            (table.getColumn("deliveryStatus")?.getFilterValue() as string) ??
            "all"
          }
          onValueChange={(value) =>
            table
              .getColumn("deliveryStatus")
              ?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Delivery" />
          </SelectTrigger>
          <SelectContent>
            {DELIVERY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={
            (table.getColumn("invoiceType")?.getFilterValue() as string) ??
            "all"
          }
          onValueChange={(value) =>
            table
              .getColumn("invoiceType")
              ?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Invoice Type" />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
                    <FileText className="h-8 w-8" />
                    <span>No invoices found</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {data.length} invoices
        </div>
        <div className="space-x-2">
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
