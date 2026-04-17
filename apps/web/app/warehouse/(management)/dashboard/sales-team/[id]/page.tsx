"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

interface AssignedCustomer {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  shopName: string | null;
  assignedAt: Date;
}

export default function SalesmanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery(
    orpc.warehouseEmployee.getSalesmanById.queryOptions({
      input: { id },
    }),
  );

  const salesman = data?.salesman;

  const columns: ColumnDef<AssignedCustomer>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "shopName",
        header: "Shop",
        cell: ({ row }) => row.original.shopName || "-",
      },
      {
        accessorKey: "phoneNumber",
        header: "Phone",
        cell: ({ row }) => row.original.phoneNumber || "-",
      },
      {
        accessorKey: "assignedAt",
        header: "Assigned",
        cell: ({ row }) =>
          format(new Date(row.original.assignedAt), "MMM d, yyyy"),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: salesman?.assignedCustomers ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !salesman) {
    return (
      <div className="space-y-6">
        <Link href={`${WH}/sales-team`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">Salesman not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`${WH}/sales-team`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold">{salesman.name}</h1>
          <p className="text-sm text-muted-foreground">Salesman Details</p>
        </div>
        {salesman.banned && <Badge variant="destructive">Banned</Badge>}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{salesman.estimatesCount}</p>
            <p className="text-xs text-muted-foreground">Estimates</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">
              {salesman.assignedCustomersCount}
            </p>
            <p className="text-xs text-muted-foreground">Customers</p>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm truncate">{salesman.email}</span>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {salesman.phoneNumber || "No phone"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Mobile contact info */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{salesman.email}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>{salesman.phoneNumber || "No phone"}</span>
        </div>
      </div>

      {/* Assigned Customers */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Assigned Customers
        </h2>

        {salesman.assignedCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No customers assigned yet
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Card View */}
            <div className="sm:hidden space-y-3">
              {table.getRowModel().rows.map((row) => {
                const customer = row.original;
                return (
                  <div
                    key={customer.id}
                    className="flex items-start justify-between p-3 border rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {customer.name}
                      </p>
                      {customer.shopName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Store className="h-3 w-3" />
                          {customer.shopName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {customer.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Assigned{" "}
                        {format(new Date(customer.assignedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden sm:block rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
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
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {table.getPageCount() > 1 && (
              <div className="flex items-center justify-between px-2">
                <p className="text-xs text-muted-foreground">
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
          </>
        )}
      </div>
    </div>
  );
}
