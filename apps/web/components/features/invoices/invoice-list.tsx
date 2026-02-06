"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, CreditCard, FileText, Split, Truck } from "lucide-react";
import {
  getAllInvoices,
  getInvoiceStats,
} from "@/actions/invoice/invoice-actions";
import { useInvoiceColumns } from "@/components/features/invoices/invoice-columns";
import InvoiceTable from "@/components/features/invoices/invoice-table";
import TableSkeleton from "@/components/table-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatPrice(price: string | number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
}

function StatsCardsSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function InvoiceList() {
  const columns = useInvoiceColumns();

  const { data: invoicesResult, isLoading: invoicesLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: () => getAllInvoices(),
  });

  const { data: statsResult, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-invoice-stats"],
    queryFn: () => getInvoiceStats(),
  });

  const invoices = invoicesResult?.invoices || [];
  const stats = statsResult?.stats;

  // Calculate partial invoices count
  const partialInvoicesCount = invoices.filter(
    (inv: any) => inv.invoiceType === "split",
  ).length;

  if (invoicesLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <StatsCardsSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(stats?.byStatus || {}).reduce(
                (a, b) => a + b,
                0,
              ) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Partial Invoices
            </CardTitle>
            <Split className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partialInvoicesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Payment
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.byPayment?.unpaid || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collected Revenue
            </CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(stats?.totalRevenue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Delivered
            </CardTitle>
            <Truck className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.byStatus?.delivered || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <InvoiceTable columns={columns} data={invoices} />
    </div>
  );
}
