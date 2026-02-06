"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/actions/customers/customer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderWithItems } from "@/db/schema/order";

interface CustomerDetailsClientProps {
  customerId: string;
}

const statusVariant = (status: string) => {
  switch (status) {
    case "delivered":
      return "default";
    case "cancelled":
      return "destructive";
    case "pending":
      return "outline";
    case "confirmed":
    case "processing":
      return "secondary";
    default:
      return "outline";
  }
};

const orderColumns: ColumnDef<OrderWithItems>[] = [
  {
    accessorKey: "orderNumber",
    header: "Order #",
    cell: ({ row }) => (
      <Link
        href={`/dashboard/admin/orders/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.orderNumber}
      </Link>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.createdAt), "MMM d, yyyy"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.status)}>
        {row.original.status.charAt(0).toUpperCase() +
          row.original.status.slice(1)}
      </Badge>
    ),
  },
  {
    accessorKey: "items",
    header: "Items",
    cell: ({ row }) => row.original.items?.length || 0,
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => `৳${Number(row.original.total).toLocaleString()}`,
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment",
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.paymentStatus === "paid" ? "default" : "secondary"
        }
      >
        {row.original.paymentStatus.charAt(0).toUpperCase() +
          row.original.paymentStatus.slice(1)}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/admin/orders/${row.original.id}`}>View</Link>
      </Button>
    ),
  },
];

export function CustomerDetailsClient({
  customerId,
}: CustomerDetailsClientProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomerById(customerId),
  });

  const table = useReactTable({
    data: (data?.orders as OrderWithItems[]) || [],
    columns: orderColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.success || !data.customer) {
    notFound();
  }

  const { customer } = data;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/customers">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-muted-foreground">
            Customer since {format(new Date(customer.createdAt), "MMMM yyyy")}
          </p>
        </div>
        <Badge variant={customer.role === "customer" ? "default" : "secondary"}>
          {customer.role === "customer" ? "Active" : "Pending"}
        </Badge>
      </div>

      {/* Stats & Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingBag className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customer.ordersCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <span className="text-muted-foreground text-sm">৳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ৳{customer.totalSpent.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              <span>{customer.email}</span>
            </div>
            {customer.phoneNumber && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" />
                <span>{customer.phoneNumber}</span>
              </div>
            )}
            {customer.shopName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Store className="size-4" />
                <span>{customer.shopName}</span>
              </div>
            )}
            {customer.ownerName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="size-4" />
                <span>Owner: {customer.ownerName}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Order History</h2>

        <div className="rounded-md border">
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
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
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={orderColumns.length}
                    className="h-24 text-center"
                  >
                    No orders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
