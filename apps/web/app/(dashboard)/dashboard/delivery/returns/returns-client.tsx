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
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { DELIVERY_BASE } from "@/lib/routes";

interface ReturnData {
  id: number;
  orderId: number;
  userId: string;
  reason: string;
  returnType: string;
  totalAmount: string;
  refundType: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  order: {
    id: number;
    orderNumber: string;
    total: string;
    status: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  };
}

interface ReturnsClientProps {
  returns: ReturnData[];
}

function getStatusBadge(status: string) {
  const variant =
    status === "processed"
      ? "default"
      : status === "rejected"
        ? "destructive"
        : "secondary";

  return (
    <Badge variant={variant} className="text-[10px] sm:text-xs rounded-full">
      {status.toUpperCase()}
    </Badge>
  );
}

const columns: ColumnDef<ReturnData>[] = [
  {
    accessorKey: "order.orderNumber",
    header: "Order #",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.order.orderNumber}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.createdAt), "MMM d, yyyy"),
  },
  {
    accessorKey: "user.name",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.user.name}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.user.email}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "returnType",
    header: "Type",
    cell: ({ row }) => (
      <span className="capitalize">{row.original.returnType}</span>
    ),
  },
  {
    accessorKey: "totalAmount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-semibold text-primary">
        ৳{Number(row.original.totalAmount).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
];

export function ReturnsClient({ returns }: ReturnsClientProps) {
  const router = useRouter();
  const table = useReactTable({
    data: returns,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-2xl bg-muted/30 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <RotateCcw className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No return requests found
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Create your first return request to get started
        </p>
      </div>
    );
  }

  const paginatedRows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      {/* Mobile: Card View */}
      <div className="sm:hidden flex flex-col gap-4">
        {paginatedRows.map((row) => {
          const ret = row.original;
          return (
            <Link
              key={ret.id}
              href={`${DELIVERY_BASE}/returns/${ret.id}`}
              className="block"
            >
              <Card className="p-0 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer rounded-xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {ret.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {ret.order.orderNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ret.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        {getStatusBadge(ret.status)}
                      </div>

                      {/* Customer Info */}
                      <div className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium text-foreground">
                          {ret.user.name}
                        </span>
                        <span className="mx-1">•</span>
                        <span className="capitalize">{ret.returnType}</span>
                      </div>

                      {/* Details Row */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <Badge
                          variant="outline"
                          className="text-xs rounded-full"
                        >
                          {ret.returnType}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">
                            ৳{Number(ret.totalAmount).toLocaleString()}
                          </span>
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
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
                <TableHead className="w-10"></TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row, index) => (
              <TableRow
                key={row.id}
                className={`cursor-pointer transition-colors hover:bg-primary/5 ${index % 2 === 0 ? "" : "bg-muted/20"}`}
                onClick={() => {
                  router.push(`${DELIVERY_BASE}/returns/${row.original.id}`);
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

      {/* Pagination Controls */}
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
