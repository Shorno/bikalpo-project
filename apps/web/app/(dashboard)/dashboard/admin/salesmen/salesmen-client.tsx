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
  Eye,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Salesman, SalesmenStats } from "@/actions/admin/salesman-actions";
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
import { AssignCustomersDialog } from "./[id]/assign-customers-dialog";

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

interface SalesmenClientProps {
  salesmen: Salesman[];
  stats: SalesmenStats;
}

export function SalesmenClient({ salesmen, stats }: SalesmenClientProps) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<Salesman>[] = useMemo(
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
        accessorKey: "assignedCustomersCount",
        header: "Customers",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {row.original.assignedCustomersCount}
          </Badge>
        ),
      },
      {
        accessorKey: "estimatesCount",
        header: "Estimates",
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs">
            {row.original.estimatesCount}
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
          <div className="flex items-center gap-1">
            <AssignCustomersDialog
              salesmanId={row.original.id}
              salesmanName={row.original.name}
              onAssigned={() => router.refresh()}
            >
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <UserPlus className="h-4 w-4" />
              </Button>
            </AssignCustomersDialog>
            <Link href={`${ADMIN_BASE}/salesmen/${row.original.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    [router],
  );

  const filteredData = useMemo(() => {
    if (!globalFilter) return salesmen;
    const search = globalFilter.toLowerCase();
    return salesmen.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search) ||
        (s.phoneNumber?.toLowerCase().includes(search) ?? false),
    );
  }, [salesmen, globalFilter]);

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
            <p className="text-2xl font-bold">{stats.totalEstimates}</p>
            <p className="text-xs text-muted-foreground">Estimates</p>
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
        <CreateEmployeeModal defaultRole="salesman" />
      </div>

      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No salesmen found</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card View */}
          <div className="sm:hidden space-y-3">
            {table.getRowModel().rows.map((row) => {
              const s = row.original;
              return (
                <Card key={s.id} className="p-0">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {s.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.email}
                        </p>
                      </div>
                      {getStatusBadge(s.banned)}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {s.phoneNumber || "No phone"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {s.assignedCustomersCount}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {s.estimatesCount} estimates
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                      <span>
                        Joined {format(new Date(s.createdAt), "MMM d, yyyy")}
                      </span>
                      <div className="flex items-center gap-1">
                        <AssignCustomersDialog
                          salesmanId={s.id}
                          salesmanName={s.name}
                          onAssigned={() => router.refresh()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </AssignCustomersDialog>
                        <Link href={`${ADMIN_BASE}/salesmen/${s.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
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
