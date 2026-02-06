"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Eye, Search, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateEmployeeModal } from "@/components/features/employees/create-employee-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_BASE } from "@/lib/routes";

// Types matching ORPC response
interface Deliveryman {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  createdAt: Date;
  banned: boolean;
  deliveriesCount: number;
}

interface DeliverymenStats {
  total: number;
  totalDeliveries: number;
  activeCount: number;
}

function getStatusBadge(banned: boolean) {
  if (banned) {
    return (
      <Badge variant="destructive" className="text-xs">
        Banned
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs text-green-600 border-green-600"
    >
      Active
    </Badge>
  );
}

interface DeliverymenClientProps {
  deliverymen: Deliveryman[];
  stats: DeliverymenStats;
}

export function DeliverymenClient({
  deliverymen,
  stats,
}: DeliverymenClientProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<Deliveryman>[] = useMemo(
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
        accessorKey: "phoneNumber",
        header: "Phone",
        cell: ({ row }) => row.original.phoneNumber || "-",
      },
      {
        accessorKey: "deliveriesCount",
        header: "Deliveries",
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs">
            {row.original.deliveriesCount}
          </Badge>
        ),
      },
      {
        accessorKey: "banned",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.banned),
      },
      {
        accessorKey: "createdAt",
        header: "Joined",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "MMM d, yyyy"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link href={`${ADMIN_BASE}/deliverymen/${row.original.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        ),
      },
    ],
    [],
  );

  const filteredData = useMemo(() => {
    if (!globalFilter) return deliverymen;
    const search = globalFilter.toLowerCase();
    return deliverymen.filter(
      (d) =>
        d.name.toLowerCase().includes(search) ||
        d.email.toLowerCase().includes(search) ||
        (d.phoneNumber?.toLowerCase().includes(search) ?? false),
    );
  }, [deliverymen, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalDeliveries}</p>
            <p className="text-xs text-muted-foreground">Deliveries</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Add Button */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <CreateEmployeeModal defaultRole="deliveryman" />
      </div>

      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
          <Truck className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No deliverymen found</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card View */}
          <div className="sm:hidden space-y-3">
            {table.getRowModel().rows.map((row) => {
              const d = row.original;
              return (
                <Card key={d.id} className="p-0">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {d.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.email}
                        </p>
                      </div>
                      {getStatusBadge(d.banned)}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {d.phoneNumber || "No phone"}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {d.deliveriesCount} deliveries
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                      <span>
                        Joined {format(new Date(d.createdAt), "MMM d, yyyy")}
                      </span>
                      <Link href={`${ADMIN_BASE}/deliverymen/${d.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
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
  );
}
