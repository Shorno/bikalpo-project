"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Eye,
  Link2,
  Loader2,
  MapPin,
  Package,
  PhoneCall,
  Search,
  ShoppingCart,
  TrendingUp,
  User,
  Warehouse,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import {
  useDisconnectWarehouseSupplier,
  useMyWarehouseSuppliers,
} from "@/hooks/use-warehouse-supplier-connections";

const LocationViewMap = dynamic(
  () =>
    import("@/components/features/onboarding/location-view-map").then(
      (mod) => mod.LocationViewMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[128px] w-full animate-pulse rounded-lg bg-muted" />
    ),
  },
);

function formatDate(dateStr?: string | Date | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SupplierStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-800"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        Active
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-gray-300 bg-gray-50 text-[11px] font-semibold text-gray-700"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Inactive
    </Badge>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
        {label}
      </span>
      <div className="text-sm font-medium text-gray-900">{children}</div>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-700">
        <Icon className="h-3.5 w-3.5 text-gray-500" />
        {title}
      </h4>
      {children}
    </div>
  );
}

function isThisMonth(dateStr?: string | Date | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export default function ConnectedSuppliersPage() {
  const { data: session } = authClient.useSession();
  const warehouseName =
    (session?.user as { warehouseName?: string } | undefined)?.warehouseName ||
    "My Warehouse";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disconnected">("all");
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    clearTimeout((window as any).__connSupplierTimer);
    (window as any).__connSupplierTimer = setTimeout(
      () => setDebouncedSearch(value),
      400,
    );
  }, []);

  const { data, isLoading } = useMyWarehouseSuppliers({
    status: statusFilter,
    search: debouncedSearch.trim() || undefined,
    limit: 100,
  });

  const { mutate: disconnectSupplier, isPending: isDisconnecting } =
    useDisconnectWarehouseSupplier();

  const rawSuppliers = data?.items ?? [];
  const suppliers = useMemo(() => {
    const sorted = [...rawSuppliers];
    if (sortBy === "oldest") sorted.reverse();
    return sorted;
  }, [rawSuppliers, sortBy]);

  const totalCount = data?.pagination?.totalCount ?? suppliers.length;
  const activeCount = suppliers.filter((s: any) => s.status === "active").length;
  const inactiveCount = suppliers.filter(
    (s: any) => s.status === "disconnected",
  ).length;
  const newThisMonth = suppliers.filter((s: any) =>
    isThisMonth(s.connectedAt ?? s.createdAt),
  ).length;

  const handleDisconnect = (connectionId: number, name: string) => {
    if (
      confirm(
        `Disconnect ${name} as a platform supply source? You will no longer be able to place purchase orders through this warehouse.`,
      )
    ) {
      disconnectSupplier(
        { connectionId },
        { onSuccess: () => setSelectedSupplier(null) },
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-950">
            <Warehouse className="h-6 w-6 text-blue-700" />
            Connected Suppliers
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            Platform-registered warehouse supply sources for{" "}
            <span className="font-semibold text-gray-900">{warehouseName}</span>.
            External or offline vendors are managed under{" "}
            <Link
              href="/warehouse/dashboard/suppliers"
              className="font-medium text-blue-700 hover:underline"
            >
              Suppliers
            </Link>
            .
          </p>
        </div>
        <Button
          asChild
          className="h-9 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-600"
        >
          <Link href="/warehouse/dashboard/suppliers">
            <Link2 className="mr-2 h-3.5 w-3.5" />
            Connect New Warehouse
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Warehouse className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                Total Warehouses
              </p>
              <div className="text-xl font-bold tabular-nums text-blue-950">
                {isLoading ? <Skeleton className="h-7 w-10" /> : totalCount}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                Active Sources
              </p>
              <div className="text-xl font-bold tabular-nums text-emerald-800">
                {isLoading ? <Skeleton className="h-7 w-10" /> : activeCount}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
              <TrendingUp className="h-5 w-5 text-violet-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                New This Month
              </p>
              <div className="text-xl font-bold tabular-nums text-violet-800">
                {isLoading ? <Skeleton className="h-7 w-10" /> : newThisMonth}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                Inactive
              </p>
              <div className="text-xl font-bold tabular-nums text-amber-800">
                {isLoading ? <Skeleton className="h-7 w-10" /> : inactiveCount}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Warehouse name, owner, phone..."
              className="h-9 border-gray-300 bg-white pl-9 text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as "all" | "active" | "disconnected")
              }
            >
              <SelectTrigger className="h-9 w-[140px] border-gray-300 bg-white font-medium text-gray-900">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disconnected">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-9 w-[190px] border-gray-300 bg-white font-medium text-gray-900">
                <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Connected</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Warehouse className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-lg font-semibold text-gray-950">
              No platform warehouses connected
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-600">
              {debouncedSearch
                ? "Try adjusting your search filters."
                : "Connect a registered Bikalpo warehouse to use it as a platform supply source."}
            </p>
            {!debouncedSearch && (
              <Button asChild className="mt-4 h-9" variant="outline">
                <Link href="/warehouse/dashboard/suppliers">
                  <Link2 className="mr-2 h-3.5 w-3.5" />
                  Connect New Warehouse
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gray-50 hover:bg-gray-50">
                  {[
                    "#",
                    "Warehouse Name",
                    "Owner",
                    "Area / Address",
                    "Catalog",
                    "Connected Date",
                    "Status",
                    "Action",
                  ].map((head) => (
                    <TableHead
                      key={head}
                      className={`text-xs font-semibold uppercase tracking-wider text-gray-700 ${
                        head === "Action" ? "text-right" : ""
                      }`}
                    >
                      {head}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier: any, idx: number) => (
                  <TableRow
                    key={supplier.connectionId}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => setSelectedSupplier(supplier)}
                  >
                    <TableCell className="text-xs font-semibold tabular-nums text-gray-500">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-gray-200">
                          <AvatarImage src={supplier.image || undefined} />
                          <AvatarFallback className="bg-blue-50 text-blue-700">
                            <Warehouse className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-950">
                            {supplier.warehouseName || "Unnamed Warehouse"}
                          </p>
                          <p className="truncate font-mono text-xs text-gray-500">
                            {supplier.warehouseSlug || supplier.warehouseId}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <User className="h-3.5 w-3.5 text-gray-500" />
                        {supplier.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="block max-w-[200px] truncate text-sm text-gray-700"
                        title={supplier.warehouseAddress}
                      >
                        {supplier.warehouseAddress || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-gray-800">
                        {supplier.status === "active"
                          ? `${supplier.productCount ?? 0} products`
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium tabular-nums text-gray-700">
                        {formatDate(supplier.connectedAt ?? supplier.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SupplierStatusBadge status={supplier.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-semibold text-gray-700 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSupplier(supplier);
                        }}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!isLoading && suppliers.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-3 text-xs font-medium text-gray-600">
            Showing {suppliers.length} of {totalCount} platform warehouses
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog
        open={!!selectedSupplier}
        onOpenChange={(open) => !open && setSelectedSupplier(null)}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-gray-950">
              <Warehouse className="h-5 w-5 text-blue-700" />
              Warehouse Details
            </DialogTitle>
          </DialogHeader>

          {selectedSupplier && (
            <>
              <div className="space-y-3 px-5 py-4">
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                    <AvatarImage src={selectedSupplier.image || undefined} />
                    <AvatarFallback className="bg-blue-50 text-blue-700">
                      <Warehouse className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-gray-950">
                      {selectedSupplier.warehouseName || "Unnamed Warehouse"}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <SupplierStatusBadge status={selectedSupplier.status} />
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-800"
                      >
                        Platform Warehouse
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
                    <DetailField label="Owner">
                      {selectedSupplier.name || "N/A"}
                    </DetailField>
                    <DetailField label="Phone">
                      <span className="font-mono tabular-nums">
                        {selectedSupplier.phone || "N/A"}
                      </span>
                    </DetailField>
                    <DetailField label="Slug">
                      <span className="font-mono text-xs">
                        {selectedSupplier.warehouseSlug || "—"}
                      </span>
                    </DetailField>
                    <DetailField label="Connected">
                      <span className="font-mono tabular-nums">
                        {formatDate(
                          selectedSupplier.connectedAt ??
                            selectedSupplier.createdAt,
                        )}
                      </span>
                    </DetailField>
                    <DetailField label="Last Ordered">
                      <span className="font-mono tabular-nums">
                        {selectedSupplier.lastOrderedAt
                          ? formatDate(selectedSupplier.lastOrderedAt)
                          : "Never"}
                      </span>
                    </DetailField>
                    <DetailField label="Catalog">
                      {selectedSupplier.status === "active"
                        ? `${selectedSupplier.productCount ?? 0} products`
                        : "Unavailable"}
                    </DetailField>
                  </div>
                </div>

                <DetailSection title="Supply Capability" icon={Package}>
                  <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm text-gray-800">
                    <p>
                      Registered on Bikalpo as a verified platform wholesaler /
                      distributor.
                    </p>
                    {selectedSupplier.status === "active" &&
                    selectedSupplier.productCount > 0 ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {selectedSupplier.productCount} products available to
                        order
                      </p>
                    ) : (
                      <p className="mt-1.5 flex items-center gap-1.5 text-amber-800">
                        <Clock className="h-3.5 w-3.5" />
                        Catalog not currently available
                      </p>
                    )}
                  </div>
                </DetailSection>

                <DetailSection title="Location" icon={MapPin}>
                  {selectedSupplier.warehouseLat &&
                  selectedSupplier.warehouseLng ? (
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <LocationViewMap
                          latitude={parseFloat(selectedSupplier.warehouseLat)}
                          longitude={parseFloat(selectedSupplier.warehouseLng)}
                          className="h-[128px]"
                        />
                      </div>
                      {selectedSupplier.warehouseAddress ? (
                        <div className="flex min-h-[2.75rem] items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm leading-snug text-gray-800">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                          <span>{selectedSupplier.warehouseAddress}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex min-h-[2.75rem] items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm text-gray-800">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                      <span>
                        {selectedSupplier.warehouseAddress ||
                          "No address provided"}
                      </span>
                    </div>
                  )}
                </DetailSection>
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50/80 px-5 py-3 sm:flex-row">
                {selectedSupplier.status === "active" &&
                selectedSupplier.warehouseSlug ? (
                  <Button
                    asChild
                    size="sm"
                    className="h-9 flex-1 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-600"
                  >
                    <Link
                      href={`/w/${selectedSupplier.warehouseSlug}`}
                      target="_blank"
                    >
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                      Create Purchase Order
                    </Link>
                  </Button>
                ) : null}
                {selectedSupplier.phone ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 border-gray-300 text-xs font-semibold text-gray-900"
                    asChild
                  >
                    <a href={`tel:${selectedSupplier.phone}`}>
                      <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
                      Call Warehouse
                    </a>
                  </Button>
                ) : null}
                {selectedSupplier.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50"
                    onClick={() =>
                      handleDisconnect(
                        selectedSupplier.connectionId,
                        selectedSupplier.warehouseName,
                      )
                    }
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Disconnect Source
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
