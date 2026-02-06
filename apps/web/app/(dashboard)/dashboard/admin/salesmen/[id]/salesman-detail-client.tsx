"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Loader2,
  Mail,
  Phone,
  Store,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type AssignedCustomer,
  getSalesmanById,
  type SalesmanDetail,
  unassignCustomer,
} from "@/actions/admin/salesman-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { ADMIN_BASE } from "@/lib/routes";
import { AssignCustomersDialog } from "./assign-customers-dialog";

interface SalesmanDetailClientProps {
  salesmanId: string;
  initialData: SalesmanDetail;
}

export function SalesmanDetailClient({
  salesmanId,
  initialData,
}: SalesmanDetailClientProps) {
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();

  // Use TanStack Query for data fetching
  const { data: result, isLoading } = useQuery({
    queryKey: ["salesman-detail", salesmanId],
    queryFn: () => getSalesmanById(salesmanId),
    initialData: { success: true, salesman: initialData },
  });

  const salesman = result?.salesman ?? initialData;

  // TanStack Table columns for desktop
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
    data: salesman.assignedCustomers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  const handleUnassign = (customerId: string, customerName: string) => {
    setRemovingId(customerId);
    startTransition(async () => {
      const res = await unassignCustomer(salesman.id, customerId);
      if (res.success) {
        toast.success(`${customerName} unassigned`);
        queryClient.invalidateQueries({
          queryKey: ["salesman-detail", salesmanId],
        });
      } else {
        toast.error(res.error || "Failed to unassign customer");
      }
      setRemovingId(null);
    });
  };

  const handleAssigned = () => {
    queryClient.invalidateQueries({
      queryKey: ["salesman-detail", salesmanId],
    });
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`${ADMIN_BASE}/salesmen`}>
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

      {/* Assigned Customers Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Assigned Customers
        </h2>
        <AssignCustomersDialog
          salesmanId={salesman.id}
          salesmanName={salesman.name}
          onAssigned={handleAssigned}
        >
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Assign
          </Button>
        </AssignCustomersDialog>
      </div>

      {/* Assigned Customers List */}
      {salesman.assignedCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No customers assigned yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Click "Assign" to add customers
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={removingId === customer.id}
                      >
                        {removingId === customer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unassign Customer</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove {customer.name} from {salesman.name}'s assigned
                          customers?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            handleUnassign(customer.id, customer.name)
                          }
                        >
                          Unassign
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                    <TableHead className="w-10"></TableHead>
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
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            disabled={removingId === row.original.id}
                          >
                            {removingId === row.original.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Unassign Customer
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove {row.original.name} from {salesman.name}'s
                              assigned customers?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleUnassign(
                                  row.original.id,
                                  row.original.name,
                                )
                              }
                            >
                              Unassign
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
    </div>
  );
}
