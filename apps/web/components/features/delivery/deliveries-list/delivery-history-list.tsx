"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DELIVERY_PORTAL_BASE } from "@/lib/delivery-routing";

export interface DeliveryHistoryItem {
  id: number;
  groupName: string;
  status: string;
  vehicleType: string | null;
  assignedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  invoiceCount: number;
  totalValue: number;
  deliveredCount: number;
  failedCount: number;
}

function getStatusBadge(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
  > = {
    completed: "outline",
    partial: "destructive",
  };
  const labels: Record<string, string> = {
    completed: "Completed",
    partial: "Partial",
  };
  return (
    <Badge variant={variants[status] || "secondary"} className="text-xs">
      {labels[status] || status}
    </Badge>
  );
}

function formatHistoryDate(item: DeliveryHistoryItem) {
  const date = item.completedAt ?? item.assignedAt ?? item.createdAt;
  return format(new Date(date), "MMM d, yyyy");
}

interface DeliveryHistoryListProps {
  groups: DeliveryHistoryItem[];
}

export function DeliveryHistoryList({ groups }: DeliveryHistoryListProps) {
  const router = useRouter();

  const columns: ColumnDef<DeliveryHistoryItem>[] = useMemo(
    () => [
      {
        accessorKey: "groupName",
        header: "Group",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.groupName}</p>
            <p className="text-xs text-muted-foreground">
              {formatHistoryDate(row.original)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "invoiceCount",
        header: "Invoices",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            {row.original.invoiceCount}
          </Badge>
        ),
      },
      {
        id: "outcomes",
        header: "Outcomes",
        cell: ({ row }) => (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              {row.original.deliveredCount}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-3 w-3" />
              {row.original.failedCount}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "totalValue",
        header: "Value",
        cell: ({ row }) => (
          <span className="font-medium">
            ৳{row.original.totalValue.toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const paginatedRows = table.getRowModel().rows;

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-2xl bg-muted/30 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Truck className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No completed deliveries yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Finished routes will appear here after you complete them
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile: Card View */}
      <div className="sm:hidden space-y-3">
        {paginatedRows.map((row) => {
          const group = row.original;
          return (
            <Link
              key={group.id}
              href={`${DELIVERY_PORTAL_BASE}/deliveries/${group.id}`}
            >
              <Card className="p-0 hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {group.groupName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatHistoryDate(group)}
                      </p>
                    </div>
                    {getStatusBadge(group.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {group.invoiceCount} invoices
                      </span>
                      <span className="font-medium">
                        ৳{group.totalValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {group.deliveredCount}
                      </span>
                      <span className="flex items-center gap-0.5 text-red-600">
                        <XCircle className="h-3 w-3" />
                        {group.failedCount}
                      </span>
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Desktop: Table View */}
      <div className="hidden sm:block rounded-xl border shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/50 hover:bg-muted/50"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row, index) => (
              <TableRow
                key={row.id}
                className={`cursor-pointer transition-colors hover:bg-primary/5 ${index % 2 === 0 ? "" : "bg-muted/20"}`}
                onClick={() => {
                  router.push(
                    `${DELIVERY_PORTAL_BASE}/deliveries/${row.original.id}`,
                  );
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                <TableCell>
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
