"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Search,
  ShoppingCart,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMySuppliers } from "@/hooks/use-shop-owner-api";

type SupplierStatusFilter = "all" | "with_due" | "no_due";

type SupplierSummary = {
  totalSuppliers: number;
  payableSuppliers: number;
  totalPayable: number;
};

type SupplierRow = {
  warehouseId: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalOrders: number;
  totalPurchased: number;
  totalPaid: number;
  totalPayable: number;
  payableOrders: number;
  pendingCount: number;
  lastOrderDate: string | Date | null;
  lastPurchaseAmount: number;
  hasDue: boolean;
};

const FILTER_LABELS: Record<SupplierStatusFilter, string> = {
  all: "All suppliers",
  with_due: "With due",
  no_due: "No due",
};

function formatCurrency(value: number) {
  return `Tk ${value.toLocaleString("en-BD")}`;
}

function formatDate(value: string | Date | null) {
  if (!value) return "No purchase yet";

  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
}

function SummaryCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-rose-50 text-rose-600"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-primary/10 text-primary";

  return (
    <Card className="border-border/70">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}
        >
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-full md:w-40" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({
  hasSearch,
  statusFilter,
}: {
  hasSearch: boolean;
  statusFilter: SupplierStatusFilter;
}) {
  const message = hasSearch
    ? "No suppliers match your search."
    : statusFilter === "with_due"
      ? "No suppliers have payable balances right now."
      : statusFilter === "no_due"
        ? "Every supplier currently has a due balance."
        : "Place your first warehouse order to start building your supplier list.";

  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Users className="mx-auto mb-4 h-14 w-14 text-muted-foreground/25" />
        <p className="text-lg font-semibold">No suppliers found</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {!hasSearch && statusFilter === "all" ? (
          <Button asChild className="mt-6">
            <Link href="/dashboard/order-from-warehouse">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Create Order
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("all");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchDebounced(search.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const { data, isLoading, isError } = useMySuppliers({
    search: searchDebounced || undefined,
    status: statusFilter,
  });

  const summary = (data?.summary ?? {
    totalSuppliers: 0,
    payableSuppliers: 0,
    totalPayable: 0,
  }) as SupplierSummary;
  const suppliers = (data?.suppliers ?? []) as SupplierRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track warehouse partners, unpaid balances, and recent purchase
            activity.
          </p>
        </div>

        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href="/dashboard/order-from-warehouse">
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
            New Order
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Total Suppliers"
          value={summary.totalSuppliers}
        />
        <SummaryCard
          icon={<TriangleAlert className="h-5 w-5" />}
          label="Payable Suppliers"
          value={summary.payableSuppliers}
          tone={summary.payableSuppliers > 0 ? "danger" : "success"}
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total Payable"
          value={formatCurrency(summary.totalPayable)}
          tone={summary.totalPayable > 0 ? "danger" : "success"}
        />
      </div>

      <Card className="border-border/70">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search supplier name, phone, or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as SupplierStatusFilter)
              }
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="with_due">With Due</SelectItem>
                <SelectItem value="no_due">No Due</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">{FILTER_LABELS[statusFilter]}</p>
              <p className="text-muted-foreground">
                {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}{" "}
                visible
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Payable suppliers stay on top
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <SupplierListSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-rose-300" />
            <p className="font-medium text-muted-foreground">
              Failed to load suppliers.
            </p>
          </CardContent>
        </Card>
      ) : suppliers.length === 0 ? (
        <EmptyState hasSearch={!!searchDebounced} statusFilter={statusFilter} />
      ) : (
        <div className="space-y-4">
          <Card className="hidden border-border/70 lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5">Supplier</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Payable</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Last Purchase</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="px-5 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.warehouseId}>
                      <TableCell className="px-5 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold">{supplier.name}</p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{supplier.phone || "No phone"}</span>
                            <span>{supplier.email || "No email"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{supplier.totalOrders}</p>
                          <p className="text-xs text-muted-foreground">
                            {supplier.pendingCount} active
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p
                          className={`font-semibold ${
                            supplier.hasDue
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {formatCurrency(supplier.totalPayable)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Paid {formatCurrency(supplier.totalPaid)}
                        </p>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(supplier.totalPurchased)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {formatDate(supplier.lastOrderDate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(supplier.lastPurchaseAmount)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {supplier.hasDue ? (
                            <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
                              <TriangleAlert className="mr-1 h-3 w-3" />
                              Payable
                            </Badge>
                          ) : (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Clear
                            </Badge>
                          )}
                          {supplier.pendingCount > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {supplier.pendingCount} pending
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/dashboard/suppliers/${supplier.warehouseId}`}
                          >
                            View
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:hidden">
            {suppliers.map((supplier) => (
              <Card key={supplier.warehouseId} className="border-border/70">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.phone || supplier.email || "No contact info"}
                      </p>
                    </div>
                    {supplier.hasDue ? (
                      <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
                        Payable
                      </Badge>
                    ) : (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                        Clear
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-muted/35 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Payable
                      </p>
                      <p
                        className={`mt-1 text-sm font-semibold ${
                          supplier.hasDue ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {formatCurrency(supplier.totalPayable)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Orders
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {supplier.totalOrders}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Purchased
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatCurrency(supplier.totalPurchased)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Last purchase
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatDate(supplier.lastOrderDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border/70 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      <span>{supplier.pendingCount} active orders</span>
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={`/dashboard/suppliers/${supplier.warehouseId}`}
                      >
                        View
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
