"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  Link2,
  Loader2,
  MapPin,
  Phone,
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
import { Separator } from "@/components/ui/separator";

const LocationViewMap = dynamic(
  () =>
    import("@/components/features/onboarding/location-view-map").then(
      (mod) => mod.LocationViewMap,
    ),
  { ssr: false, loading: () => <div className="w-full h-[200px] bg-gray-100 rounded-lg animate-pulse" /> },
);
import {
  useConnectedStores,
  useRejectStoreRequest,
} from "@/hooks/use-warehouse-connections";

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
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
  const totalStores = stores.length;
  const activeStores = stores.length; // all connected stores are active
  const totalPagination = data?.pagination?.totalCount ?? stores.length;

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Connected Stores
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your network of approved retailer stores. This page shows
            connection data only — sales data is in the Sales module.
          </p>
        </div>
      </div>

      {/* ── KPI Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Stores */}
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600/80 font-medium">
                Total Stores
              </p>
              <div className="text-xl font-bold text-blue-900 tabular-nums">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Active
              </p>
              <div className="text-xl font-bold tabular-nums text-emerald-700">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                With Orders
              </p>
              <div className="text-xl font-bold tabular-nums text-violet-700">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Never Ordered
              </p>
              <div className="text-xl font-bold tabular-nums text-amber-600">
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
      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search store name, owner, phone..."
              className="pl-9 h-9"
            />
          </div>

          {/* Sort */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as "recent" | "oldest")}
          >
            <SelectTrigger className="w-[180px] h-9">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
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
            <p className="font-semibold text-gray-900 text-lg">
              No connected stores
            </p>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
              {debouncedSearch
                ? "Try adjusting your search filters."
                : "You haven't approved any store requests yet. Check the Store Requests page to accept new retailers."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Area / Address</TableHead>
                  <TableHead>Connected Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[100px]">
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
                    <TableCell className="text-xs text-muted-foreground tabular-nums font-medium">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={store.image || undefined} />
                          <AvatarFallback className="bg-emerald-50 text-emerald-600 text-xs">
                            <Store className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-900 truncate max-w-[180px]">
                          {store.shopName || "Unnamed Store"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {store.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 tabular-nums">
                        {store.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 truncate max-w-[180px] block">
                        {store.address || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 tabular-nums">
                        {store.connectedAt
                          ? formatDate(store.connectedAt)
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[11px] font-medium gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="px-4 py-3 border-t bg-gray-50/50 text-xs text-muted-foreground">
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-emerald-600" />
              Store Details
            </DialogTitle>
          </DialogHeader>

          {selectedStore && (
            <div className="space-y-5">
              {/* ── Store Identity ── */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border">
                <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
                  <AvatarImage src={selectedStore.image || undefined} />
                  <AvatarFallback className="bg-emerald-50 text-emerald-600">
                    <Store className="w-7 h-7" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base truncate">
                    {selectedStore.shopName || "Unnamed Store"}
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-medium gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 mt-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </Badge>
                </div>
              </div>

              {/* ── Basic Info ── */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Owner Details
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Name
                    </span>
                    <span className="font-medium text-gray-900">
                      {selectedStore.name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Phone
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {selectedStore.phone || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Connection Info ── */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Connection Info
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Connected Date
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {selectedStore.connectedAt
                        ? formatDateTime(selectedStore.connectedAt)
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Status
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[11px] font-medium gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Last Ordered
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {selectedStore.lastOrderedAt
                        ? formatDateTime(selectedStore.lastOrderedAt)
                        : "Never"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Total Orders
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {selectedStore.totalOrders ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Location ── */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </h4>
                {selectedStore.shopLat && selectedStore.shopLng ? (
                  <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden border">
                      <LocationViewMap
                        latitude={parseFloat(selectedStore.shopLat)}
                        longitude={parseFloat(selectedStore.shopLng)}
                      />
                    </div>
                    {selectedStore.address && (
                      <div className="text-sm text-gray-700 flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <span>{selectedStore.address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <span>
                      {selectedStore.address || "No address provided"}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Connection Status ── */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connection Status
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Verified & Connected
                  </li>
                  {selectedStore.totalOrders > 0 ? (
                    <li className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Has placed {selectedStore.totalOrders} order
                      {selectedStore.totalOrders !== 1 ? "s" : ""}
                    </li>
                  ) : (
                    <li className="flex items-center gap-2 text-amber-700">
                      <Clock className="w-4 h-4 text-amber-500" />
                      No orders yet
                    </li>
                  )}
                </ul>
              </div>

              <Separator />

              {/* ── Actions ── */}
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  {selectedStore.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      asChild
                    >
                      <a href={`tel:${selectedStore.phone}`}>
                        <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                        Call Store
                      </a>
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() =>
                    handleDisconnect(
                      selectedStore.connectionId,
                      selectedStore.shopName,
                    )
                  }
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Disconnect Store
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
