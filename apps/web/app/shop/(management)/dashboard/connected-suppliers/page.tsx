"use client";

import {
  AlertCircle,
  ArrowRight,
  Building2,
  Link2,
  RotateCcw,
  Search,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
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
import { useConnectedSuppliers } from "@/hooks/use-shop-owner-api";
import { getWarehouseStorefrontUrl } from "@/lib/warehouse-storefront-url";

type ConnectedSupplierStatusFilter = "all" | "active" | "inactive";

type ConnectedSupplierSummary = {
  connectedSuppliers: number;
  activeSuppliers: number;
  totalPurchase: number;
};

type ConnectedSupplierRow = {
  connectionId: number;
  warehouseId: string;
  warehouseSlug: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  primaryCategory: string | null;
  activityStatus: "active" | "inactive";
  totalOrders: number;
  totalPurchase: number;
  totalPaid: number;
  totalDue: number;
  pendingOrders: number;
  lastPurchaseDate: string | Date | null;
  connectedAt: string | Date | null;
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
  tone?: "default" | "success";
}) {
  const toneClass =
    tone === "success"
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

function NetworkListSkeleton() {
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
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px]">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
  hasConnections,
  hasFilters,
  onClearFilters,
}: {
  hasConnections: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Link2 className="mx-auto mb-4 h-14 w-14 text-muted-foreground/25" />
        <p className="text-lg font-semibold">No connected suppliers found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasConnections
            ? hasFilters
              ? "No suppliers match your current filters."
              : "No connected suppliers are available right now."
            : "Connect to platform warehouses to build your supplier network."}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {hasConnections && hasFilters ? (
            <Button onClick={onClearFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/warehouses">
                <Link2 className="mr-2 h-4 w-4" />
                Manage Connections
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, select, textarea"))
  );
}

function openStorefront(
  event: MouseEvent<HTMLElement>,
  storefrontUrl: string | null,
) {
  if (!storefrontUrl || isInteractiveTarget(event.target)) return;
  window.location.assign(storefrontUrl);
}

function openStorefrontFromKeyboard(
  event: KeyboardEvent<HTMLElement>,
  storefrontUrl: string | null,
) {
  if (!storefrontUrl || isInteractiveTarget(event.target)) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  window.location.assign(storefrontUrl);
}

function StatusBadge({
  status,
}: {
  status: ConnectedSupplierRow["activityStatus"];
}) {
  if (status === "active") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        Active
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-amber-700"
    >
      Inactive
    </Badge>
  );
}

export default function ConnectedSuppliersPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ConnectedSupplierStatusFilter>(() => {
      const status = searchParams.get("status");
      return status === "active" || status === "inactive" ? status : "all";
    });
  const [categoryFilter, setCategoryFilter] = useState(
    () => searchParams.get("category") || "all",
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchDebounced(search.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const { data, isLoading, isError } = useConnectedSuppliers({
    search: searchDebounced || undefined,
    status: statusFilter,
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });

  const summary = (data?.summary ?? {
    connectedSuppliers: 0,
    activeSuppliers: 0,
    totalPurchase: 0,
  }) as ConnectedSupplierSummary;
  const categories = (data?.categories ?? []) as string[];
  const suppliers = (data?.suppliers ?? []) as ConnectedSupplierRow[];
  const hasFilters =
    !!searchDebounced || statusFilter !== "all" || categoryFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setSearchDebounced("");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Connected Suppliers
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            View platform-connected suppliers, recent network activity, and
            total purchasing strength from your retailer panel.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/dashboard/warehouses">
            <Link2 className="mr-2 h-4 w-4" />
            Manage Connections
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Connected Suppliers"
          value={summary.connectedSuppliers}
        />
        <SummaryCard
          icon={<Building2 className="h-5 w-5" />}
          label="Active Suppliers"
          value={summary.activeSuppliers}
          tone="success"
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Purchase"
          value={formatCurrency(summary.totalPurchase)}
          tone="success"
        />
      </div>

      <Card className="border-border/70">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search supplier name, phone, or category"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ConnectedSupplierStatusFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">
                {summary.activeSuppliers > 0
                  ? `${summary.activeSuppliers} suppliers are actively supplying products`
                  : "No active supplier activity yet"}
              </p>
              <p className="text-muted-foreground">
                Only platform-registered, connected suppliers are shown here.
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Active suppliers stay on top
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <NetworkListSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-rose-300" />
            <p className="font-medium text-muted-foreground">
              Failed to load connected suppliers.
            </p>
          </CardContent>
        </Card>
      ) : suppliers.length === 0 ? (
        <EmptyState
          hasConnections={summary.connectedSuppliers > 0}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
        />
      ) : (
        <div className="space-y-4">
          <Card className="hidden border-border/70 lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5">Supplier Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Last Purchase</TableHead>
                    <TableHead>Total Buy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="px-5 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => {
                    const storefrontUrl = supplier.warehouseSlug
                      ? getWarehouseStorefrontUrl(supplier.warehouseSlug)
                      : null;

                    return (
                      <TableRow
                        key={supplier.connectionId}
                        role={storefrontUrl ? "link" : undefined}
                        tabIndex={storefrontUrl ? 0 : undefined}
                        aria-label={
                          storefrontUrl
                            ? `Visit ${supplier.name} storefront`
                            : undefined
                        }
                        className={
                          storefrontUrl
                            ? "cursor-pointer transition-colors hover:bg-emerald-50/40 focus-visible:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
                            : undefined
                        }
                        onClick={(event) =>
                          openStorefront(event, storefrontUrl)
                        }
                        onKeyDown={(event) =>
                          openStorefrontFromKeyboard(event, storefrontUrl)
                        }
                      >
                        <TableCell className="px-5">
                          <div className="space-y-1">
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {supplier.phone ||
                                supplier.email ||
                                "No contact info"}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                storefrontUrl
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                              }`}
                            >
                              <Store className="h-3.5 w-3.5" />
                              {storefrontUrl
                                ? "Visit storefront"
                                : "Storefront unavailable"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.primaryCategory || "General"}
                        </TableCell>
                        <TableCell>
                          {formatDate(supplier.lastPurchaseDate)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(supplier.totalPurchase)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={supplier.activityStatus} />
                        </TableCell>
                        <TableCell className="px-5 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/dashboard/connected-suppliers/${supplier.warehouseId}`}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              View Details
                              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:hidden">
            {suppliers.map((supplier) => {
              const storefrontUrl = supplier.warehouseSlug
                ? getWarehouseStorefrontUrl(supplier.warehouseSlug)
                : null;

              return (
                <Card
                  key={supplier.connectionId}
                  role={storefrontUrl ? "link" : undefined}
                  tabIndex={storefrontUrl ? 0 : undefined}
                  aria-label={
                    storefrontUrl
                      ? `Visit ${supplier.name} storefront`
                      : undefined
                  }
                  className={`border-border/70 ${
                    storefrontUrl
                      ? "cursor-pointer transition-all hover:border-emerald-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      : ""
                  }`}
                  onClick={(event) => openStorefront(event, storefrontUrl)}
                  onKeyDown={(event) =>
                    openStorefrontFromKeyboard(event, storefrontUrl)
                  }
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{supplier.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {supplier.phone ||
                            supplier.email ||
                            "No contact info"}
                        </p>
                      </div>
                      <StatusBadge status={supplier.activityStatus} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Category
                        </p>
                        <p className="mt-1 font-medium">
                          {supplier.primaryCategory || "General"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Last Purchase
                        </p>
                        <p className="mt-1 font-medium">
                          {formatDate(supplier.lastPurchaseDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Total Buy
                        </p>
                        <p className="mt-1 font-medium">
                          {formatCurrency(supplier.totalPurchase)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Orders
                        </p>
                        <p className="mt-1 font-medium">
                          {supplier.totalOrders}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          storefrontUrl ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        <Store className="h-3.5 w-3.5" />
                        {storefrontUrl
                          ? "Visit storefront"
                          : "Storefront unavailable"}
                      </span>

                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/dashboard/connected-suppliers/${supplier.warehouseId}`}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          View Details
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
