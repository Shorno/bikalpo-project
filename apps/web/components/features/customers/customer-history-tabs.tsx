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
  FileText,
  Package,
} from "lucide-react";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SALES_BASE } from "@/lib/routes";
import { formatPrice } from "@/utils/currency";

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
    case "delivered":
    case "completed":
      return (
        <Badge
          variant="outline"
          className="text-xs text-green-600 border-green-600"
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="outline"
          className="text-xs text-yellow-600 border-yellow-600"
        >
          Pending
        </Badge>
      );
    case "rejected":
    case "cancelled":
      return (
        <Badge variant="destructive" className="text-xs">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
  }
}

interface CustomerHistoryTabsProps {
  estimates: {
    id: number;
    estimateNumber: string;
    total: string;
    status: string;
    createdAt: Date;
  }[];
  orders: {
    id: number;
    orderNumber: string;
    total: string;
    status: string;
    paymentStatus: string;
    createdAt: Date;
  }[];
}

export function CustomerHistoryTabs({
  estimates,
  orders,
}: CustomerHistoryTabsProps) {
  // Estimate columns
  const estimateColumns: ColumnDef<(typeof estimates)[0]>[] = useMemo(
    () => [
      {
        accessorKey: "estimateNumber",
        header: "Estimate #",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.estimateNumber}</span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => formatPrice(row.original.total),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "MMM d, yyyy"),
      },
    ],
    [],
  );

  // Order columns
  const orderColumns: ColumnDef<(typeof orders)[0]>[] = useMemo(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order #",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.orderNumber}</span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => formatPrice(row.original.total),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "MMM d, yyyy"),
      },
    ],
    [],
  );

  const estimateTable = useReactTable({
    data: estimates,
    columns: estimateColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5 } },
  });

  const orderTable = useReactTable({
    data: orders,
    columns: orderColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5 } },
  });

  return (
    <Tabs defaultValue="estimates" className="w-full">
      <TabsList className="w-full grid grid-cols-2 h-12 p-1 bg-muted rounded-lg">
        <TabsTrigger
          value="estimates"
          className="gap-2 text-sm font-medium rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
        >
          <FileText className="h-4 w-4" />
          <span>Estimates</span>
          <span className="ml-1 rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold">
            {estimates.length}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          className="gap-2 text-sm font-medium rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
        >
          <Package className="h-4 w-4" />
          <span>Orders</span>
          <span className="ml-1 rounded-full bg-background/20 px-2 py-0.5 text-xs font-semibold">
            {orders.length}
          </span>
        </TabsTrigger>
      </TabsList>

      {/* Estimates Tab */}
      <TabsContent value="estimates" className="space-y-4 pt-3">
        {estimates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No estimates found</p>
          </div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="sm:hidden space-y-3">
              {estimateTable.getRowModel().rows.map((row) => {
                const e = row.original;
                return (
                  <Link
                    key={e.id}
                    href={`${SALES_BASE}/estimates/${e.id}`}
                    className="block"
                  >
                    <Card className="p-0 hover:bg-muted/50 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">
                            {e.estimateNumber}
                          </span>
                          {getStatusBadge(e.status)}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {format(new Date(e.createdAt), "MMM d, yyyy")}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatPrice(e.total)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: Table */}
            <div className="hidden sm:block rounded-md border">
              <Table>
                <TableHeader>
                  {estimateTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
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
                  {estimateTable.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          <Link
                            href={`${SALES_BASE}/estimates/${row.original.id}`}
                            className="block"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </Link>
                        </TableCell>
                      ))}
                      <TableCell>
                        <Link
                          href={`${SALES_BASE}/estimates/${row.original.id}`}
                        >
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {estimateTable.getPageCount() > 1 && (
              <div className="flex items-center justify-between px-2">
                <p className="text-xs text-muted-foreground">
                  Page {estimateTable.getState().pagination.pageIndex + 1} of{" "}
                  {estimateTable.getPageCount()}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => estimateTable.previousPage()}
                    disabled={!estimateTable.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => estimateTable.nextPage()}
                    disabled={!estimateTable.getCanNextPage()}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </TabsContent>

      {/* Orders Tab */}
      <TabsContent value="orders" className="space-y-4 pt-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="sm:hidden space-y-3">
              {orderTable.getRowModel().rows.map((row) => {
                const o = row.original;
                return (
                  <Link
                    key={o.id}
                    href={`${SALES_BASE}/orders/${o.id}`}
                    className="block"
                  >
                    <Card className="p-0 hover:bg-muted/50 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">
                            {o.orderNumber}
                          </span>
                          {getStatusBadge(o.status)}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {format(new Date(o.createdAt), "MMM d, yyyy")}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatPrice(o.total)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: Table */}
            <div className="hidden sm:block rounded-md border">
              <Table>
                <TableHeader>
                  {orderTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
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
                  {orderTable.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          <Link
                            href={`${SALES_BASE}/orders/${row.original.id}`}
                            className="block"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </Link>
                        </TableCell>
                      ))}
                      <TableCell>
                        <Link href={`${SALES_BASE}/orders/${row.original.id}`}>
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {orderTable.getPageCount() > 1 && (
              <div className="flex items-center justify-between px-2">
                <p className="text-xs text-muted-foreground">
                  Page {orderTable.getState().pagination.pageIndex + 1} of{" "}
                  {orderTable.getPageCount()}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => orderTable.previousPage()}
                    disabled={!orderTable.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => orderTable.nextPage()}
                    disabled={!orderTable.getCanNextPage()}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
