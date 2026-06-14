"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Eye,
  Link2,
  Loader2,
  MapPin,
  PhoneCall,
  Search,
  Store,
  User,
  Users,
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

const LocationViewMap = dynamic(
  () =>
    import("@/components/features/onboarding/location-view-map").then(
      (mod) => mod.LocationViewMap,
    ),
  { ssr: false, loading: () => <div className="h-[140px] w-full animate-pulse rounded-lg bg-muted" /> },
);
import {
  useConnectedStores,
  useRejectStoreRequest,
} from "@/hooks/use-warehouse-connections";

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function ActiveStatusBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-800 ${className ?? ""}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      Active
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────

export default function ConnectedStoresPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest">("recent");
  const [selectedStore, setSelectedStore] = useState<any | null>(null);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__connStoreTimer);
    (window as any).__connStoreTimer = setTimeout(
      () => setDebouncedSearch(v),
      400,
    );
  }, []);

  const { data, isLoading } = useConnectedStores({
    search: debouncedSearch.trim() || undefined,
  });

  const { mutate: disconnectStore, isPending: isDisconnecting } =
    useRejectStoreRequest();

  const handleDisconnect = (connectionId: number, storeName: string) => {
    if (
      confirm(
        `Are you sure you want to disconnect access for ${storeName}? They will no longer be able to browse or order from your catalog.`,
      )
    ) {
      disconnectStore(
        { connectionId, isDisconnection: true },
        { onSuccess: () => setSelectedStore(null) },
      );
    }
  };

  const rawStores = data?.items ?? [];

  // Sort stores
  const stores = useMemo(() => {
    const sorted = [...rawStores];
    if (sortBy === "oldest") sorted.reverse();
    return sorted;
  }, [rawStores, sortBy]);

  // Derived KPIs from the data itself (no separate stats endpoint needed)
  const totalPagination = data?.pagination?.totalCount ?? stores.length;

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-950">
            <Users className="h-6 w-6 text-emerald-700" />
            Connected Stores
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            Manage your network of approved retailer stores. This page shows
            connection data only — sales data is in the Sales module.
          </p>
        </div>
      </div>

      {/* ── KPI Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Stores */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <Store className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
                Total Stores
              </p>
              <div className="text-xl font-bold tabular-nums text-blue-950">
                {isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  totalPagination
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active */}
        <Card className="border-emerald-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                Active
              </p>
              <div className="text-xl font-bold tabular-nums text-emerald-800">
                {isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  totalPagination
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* With Orders */}
        <Card className="border-violet-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
              <Link2 className="h-5 w-5 text-violet-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                With Orders
              </p>
              <div className="text-xl font-bold tabular-nums text-violet-800">
                {isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  stores.filter((s: any) => s.totalOrders > 0).length
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Never Ordered */}
        <Card className="border-amber-100">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                Never Ordered
              </p>
              <div className="text-xl font-bold tabular-nums text-amber-800">
                {isLoading ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  stores.filter((s: any) => s.totalOrders === 0).length
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search & Sort Bar ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-200 bg-gray-50/80 p-4 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search store name, owner, phone..."
              className="h-9 border-gray-300 bg-white pl-9 text-gray-900 placeholder:text-gray-500"
            />
          </div>

          {/* Sort */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as "recent" | "oldest")}
          >
            <SelectTrigger className="h-9 w-[180px] border-gray-300 bg-white font-medium text-gray-900">
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Connected</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Store List Table ── */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : stores.length === 0 ? (
          /* ── Empty State ── */
          <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-lg font-semibold text-gray-950">
              No connected stores
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-600">
              {debouncedSearch
                ? "Try adjusting your search filters."
                : "You haven't approved any store requests yet. Check the Store Requests page to accept new retailers."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-12 text-xs font-semibold uppercase tracking-wider text-gray-700">
                    #
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Store
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Owner
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Phone
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Area / Address
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Connected Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Status
                  </TableHead>
                  <TableHead className="w-[100px] text-right text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store: any, idx: number) => (
                  <TableRow
                    key={store.connectionId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => setSelectedStore(store)}
                  >
                    <TableCell className="text-xs font-semibold tabular-nums text-gray-500">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-gray-200">
                          <AvatarImage src={store.image || undefined} />
                          <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs">
                            <Store className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-[180px] truncate font-semibold text-gray-950">
                          {store.shopName || "Unnamed Store"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <User className="h-3.5 w-3.5 text-gray-500" />
                        {store.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium tabular-nums text-gray-800">
                        {store.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[180px] truncate text-sm text-gray-700">
                        {store.address || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium tabular-nums text-gray-700">
                        {store.connectedAt
                          ? formatDate(store.connectedAt)
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ActiveStatusBadge />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs font-semibold text-gray-700 opacity-100 transition-opacity hover:text-gray-950 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStore(store);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination info */}
        {!isLoading && stores.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-3 text-xs font-medium text-gray-600">
            Showing {stores.length} of{" "}
            {data?.pagination?.totalCount ?? stores.length} stores
          </div>
        )}
      </div>

      {/* ── Detail Dialog ── */}
      <Dialog
        open={!!selectedStore}
        onOpenChange={(v) => !v && setSelectedStore(null)}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-gray-950">
              <Store className="h-5 w-5 text-emerald-700" />
              Store Details
            </DialogTitle>
          </DialogHeader>

          {selectedStore && (
            <>
              <div className="space-y-3 px-5 py-4">
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                  <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                    <AvatarImage src={selectedStore.image || undefined} />
                    <AvatarFallback className="bg-emerald-50 text-emerald-700">
                      <Store className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-gray-950">
                      {selectedStore.shopName || "Unnamed Store"}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <ActiveStatusBadge />
                      {selectedStore.totalOrders > 0 ? (
                        <span className="text-xs font-medium text-emerald-800">
                          {selectedStore.totalOrders} order
                          {selectedStore.totalOrders !== 1 ? "s" : ""} placed
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-800">
                          No orders yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
                    <DetailField label="Owner">
                      {selectedStore.name || "N/A"}
                    </DetailField>
                    <DetailField label="Phone">
                      <span className="font-mono tabular-nums">
                        {selectedStore.phone || "N/A"}
                      </span>
                    </DetailField>
                    <DetailField label="Connected">
                      <span className="font-mono tabular-nums">
                        {selectedStore.connectedAt
                          ? formatDate(selectedStore.connectedAt)
                          : "N/A"}
                      </span>
                    </DetailField>
                    <DetailField label="Last Ordered">
                      <span className="font-mono tabular-nums">
                        {selectedStore.lastOrderedAt
                          ? formatDate(selectedStore.lastOrderedAt)
                          : "Never"}
                      </span>
                    </DetailField>
                    <DetailField label="Total Orders">
                      <span className="font-mono tabular-nums">
                        {selectedStore.totalOrders ?? 0}
                      </span>
                    </DetailField>
                    <DetailField label="Status">
                      <span className="inline-flex items-center gap-1 text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Verified
                      </span>
                    </DetailField>
                  </div>
                </div>

                <DetailSection title="Location" icon={MapPin}>
                  {selectedStore.shopLat && selectedStore.shopLng ? (
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <LocationViewMap
                          latitude={parseFloat(selectedStore.shopLat)}
                          longitude={parseFloat(selectedStore.shopLng)}
                          className="h-[128px]"
                        />
                      </div>
                      {selectedStore.address ? (
                        <div className="flex min-h-[2.75rem] items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm leading-snug text-gray-800">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                          <span>{selectedStore.address}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex min-h-[2.75rem] items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm text-gray-800">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                      <span>
                        {selectedStore.address || "No address provided"}
                      </span>
                    </div>
                  )}
                </DetailSection>
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50/80 px-5 py-3 sm:flex-row">
                {selectedStore.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 flex-1 border-gray-300 text-xs font-semibold text-gray-900"
                    asChild
                  >
                    <a href={`tel:${selectedStore.phone}`}>
                      <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
                      Call Store
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() =>
                    handleDisconnect(
                      selectedStore.connectionId,
                      selectedStore.shopName,
                    )
                  }
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Disconnect Store
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
