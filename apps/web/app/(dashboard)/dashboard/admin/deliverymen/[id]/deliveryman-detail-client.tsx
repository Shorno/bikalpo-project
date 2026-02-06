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
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  type DeliveryGroupSummary,
  type DeliverymanDetail,
  getDeliverymanById,
} from "@/actions/admin/deliveryman-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function getStatusBadge(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
  > = {
    assigned: "secondary",
    out_for_delivery: "default",
    completed: "outline",
    partial: "destructive",
  };
  const labels: Record<string, string> = {
    assigned: "Assigned",
    out_for_delivery: "Out for Delivery",
    completed: "Completed",
    partial: "Partial",
  };
  return (
    <Badge variant={variants[status] || "secondary"} className="text-xs">
      {labels[status] || status}
    </Badge>
  );
}

interface DeliverymanDetailClientProps {
  deliverymanId: string;
  initialData: DeliverymanDetail;
}

export function DeliverymanDetailClient({
  deliverymanId,
  initialData,
}: DeliverymanDetailClientProps) {
  const { data: result, isLoading } = useQuery({
    queryKey: ["deliveryman-detail", deliverymanId],
    queryFn: () => getDeliverymanById(deliverymanId),
    initialData: { success: true, deliveryman: initialData },
  });

  const deliveryman = result?.deliveryman ?? initialData;

  const columns: ColumnDef<DeliveryGroupSummary>[] = useMemo(
    () => [
      {
        accessorKey: "groupName",
        header: "Group",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.groupName}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(row.original.createdAt), "MMM d, yyyy")}
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
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link href={`${ADMIN_BASE}/delivery/${row.original.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: deliveryman.deliveryHistory,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`${ADMIN_BASE}/deliverymen`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold">{deliveryman.name}</h1>
          <p className="text-sm text-muted-foreground">Deliveryman Details</p>
        </div>
        {deliveryman.banned && <Badge variant="destructive">Banned</Badge>}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{deliveryman.deliveriesCount}</p>
            <p className="text-xs text-muted-foreground">Total Deliveries</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">
              {deliveryman.activeGroup ? 1 : 0}
            </p>
            <p className="text-xs text-muted-foreground">Active Group</p>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm truncate">{deliveryman.email}</span>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {deliveryman.phoneNumber || "No phone"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Mobile contact info */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{deliveryman.email}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>{deliveryman.phoneNumber || "No phone"}</span>
        </div>
        {deliveryman.serviceArea && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{deliveryman.serviceArea}</span>
          </div>
        )}
      </div>

      {/* Service Area (Desktop) */}
      {deliveryman.serviceArea && (
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>Service Area: {deliveryman.serviceArea}</span>
        </div>
      )}

      {/* Active Delivery Group */}
      {deliveryman.activeGroup && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Active Delivery Group
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg bg-muted/30">
              <div>
                <p className="font-semibold">
                  {deliveryman.activeGroup.groupName}
                </p>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {deliveryman.activeGroup.invoiceCount} invoices
                  </span>
                  <span>
                    ৳{deliveryman.activeGroup.totalValue.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(deliveryman.activeGroup.status)}
                <Link
                  href={`${ADMIN_BASE}/delivery/${deliveryman.activeGroup.id}`}
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery History */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" />
          Delivery History
        </h2>

        {deliveryman.deliveryHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
            <Truck className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No completed deliveries yet
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Card View */}
            <div className="sm:hidden space-y-3">
              {table.getRowModel().rows.map((row) => {
                const group = row.original;
                return (
                  <Card key={group.id} className="p-0">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {group.groupName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(group.createdAt), "MMM d, yyyy")}
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
                        <Link href={`${ADMIN_BASE}/delivery/${group.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                          >
                            <ExternalLink className="h-4 w-4" />
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
    </div>
  );
}
