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
  ChevronLeft,
  ChevronRight,
  ChevronRightIcon,
  Clock,
  Search,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type CustomerListItem,
  getAssignedCustomers,
} from "@/actions/employee/get-assigned-customers";
import { CustomerQuickHistoryModal } from "@/components/features/customers/customer-quick-history-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SALES_BASE } from "@/lib/routes";
import { formatPrice } from "@/utils/currency";

function CustomersListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="space-y-3 sm:hidden">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="hidden sm:block rounded-md border">
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");

  const { data: result, isLoading } = useQuery({
    queryKey: ["salesman-customers"],
    queryFn: () => getAssignedCustomers(),
  });

  const customers = result?.success ? result.customers || [] : [];

  // Filter customers by search
  const filteredData = useMemo(() => {
    if (!globalFilter) return customers;
    const search = globalFilter.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        (c.shopName?.toLowerCase().includes(search) ?? false) ||
        (c.phoneNumber?.toLowerCase().includes(search) ?? false),
    );
  }, [customers, globalFilter]);

  // Columns for desktop table
  const columns: ColumnDef<CustomerListItem>[] = useMemo(
    () => [
      {
        accessorKey: "shopName",
        header: "Shop",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.shopName || "—"}</p>
            <p className="text-xs text-muted-foreground">{row.original.name}</p>
          </div>
        ),
      },
      {
        accessorKey: "phoneNumber",
        header: "Phone",
        cell: ({ row }) => row.original.phoneNumber || "—",
      },
      {
        accessorKey: "totalEstimates",
        header: "Estimates",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.totalEstimates}</Badge>
        ),
      },
      {
        accessorKey: "totalOrders",
        header: "Orders",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.totalOrders}</Badge>
        ),
      },
      {
        accessorKey: "totalSpent",
        header: "Spent",
        cell: ({ row }) => (
          <span className="font-medium">
            {formatPrice(row.original.totalSpent)}
          </span>
        ),
      },
      {
        accessorKey: "lastActivityAt",
        header: "Last Activity",
        cell: ({ row }) => {
          const date = row.original.lastActivityAt;
          return date ? format(new Date(date), "MMM d, yyyy") : "No activity";
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  const handleQuickView = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              My Customers
            </h1>
            <p className="text-sm text-muted-foreground">
              View your assigned customers and their order history
            </p>
          </div>
        </div>

        {isLoading ? (
          <CustomersListSkeleton />
        ) : (
          <>
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, shop, phone..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border rounded-2xl bg-muted/30 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {customers.length === 0
                    ? "No customers assigned"
                    : "No customers match your search"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: Card View */}
                <div className="sm:hidden space-y-3">
                  {table.getRowModel().rows.map((row) => {
                    const c = row.original;
                    return (
                      <Link
                        key={c.id}
                        href={`${SALES_BASE}/customers/${c.id}`}
                        className="block"
                      >
                        <Card className="p-0 hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer rounded-xl overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                {(c.shopName || c.name).charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate">
                                      {c.shopName || c.name}
                                    </p>
                                    {c.shopName && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {c.name}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleQuickView(c.id);
                                    }}
                                  >
                                    <Clock className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full text-xs"
                                  >
                                    {c.totalEstimates} estimates
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-xs"
                                  >
                                    {c.totalOrders} orders
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                  <div className="text-xs text-muted-foreground">
                                    {c.lastActivityAt
                                      ? format(
                                          new Date(c.lastActivityAt),
                                          "MMM d, yyyy",
                                        )
                                      : "No activity"}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-primary">
                                      {formatPrice(c.totalSpent)}
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
                            <TableHead
                              key={header.id}
                              className="font-semibold"
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </TableHead>
                          ))}
                          <TableHead className="w-24 font-semibold">
                            Actions
                          </TableHead>
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.map((row, index) => (
                        <TableRow
                          key={row.id}
                          className={`cursor-pointer transition-colors hover:bg-primary/5 ${index % 2 === 0 ? "" : "bg-muted/20"}`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              <Link
                                href={`${SALES_BASE}/customers/${row.original.id}`}
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
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                onClick={() => handleQuickView(row.original.id)}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              <Link
                                href={`${SALES_BASE}/customers/${row.original.id}`}
                                className="p-2 rounded-md hover:bg-primary/10 transition-colors"
                              >
                                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                              </Link>
                            </div>
                          </TableCell>
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
          </>
        )}
      </div>

      <CustomerQuickHistoryModal
        customerId={selectedCustomerId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
