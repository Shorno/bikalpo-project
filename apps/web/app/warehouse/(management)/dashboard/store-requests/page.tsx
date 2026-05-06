"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Inbox,
  Loader2,
  MapPin,
  Phone,
  Search,
  Store,
  XCircle,
  Eye,
  User,
  Calendar,
  ShieldCheck,
  ShieldX,
  ArrowUpDown,
  StickyNote,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useStoreRequests,
  useStoreRequestStats,
  useApproveStoreRequest,
  useRejectStoreRequest,
} from "@/hooks/use-warehouse-connections";
import { toast } from "sonner";

// ────────────────────────────────────────────────────────────────
// Status helpers
// ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  active: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  disconnected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
} as const;

function StatusBadge({ status }: { status: string }) {
  const config =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-medium gap-1.5 ${config.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}

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

export default function StoreRequestsPage() {
  const [statusTab, setStatusTab] = useState<"all" | "pending" | "active" | "disconnected">("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "oldest">("latest");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__storeReqTimer);
    (window as any).__storeReqTimer = setTimeout(
      () => setDebouncedSearch(v),
      400,
    );
  }, []);

  const { data: statsData, isLoading: isLoadingStats } =
    useStoreRequestStats();
  const { data: requestsData, isLoading: isLoadingRequests } =
    useStoreRequests({
      status: statusTab === "all" ? undefined : statusTab,
      search: debouncedSearch.trim() || undefined,
    });

  const { mutate: approveRequest, isPending: isApproving } =
    useApproveStoreRequest();
  const { mutate: rejectRequest, isPending: isRejecting } =
    useRejectStoreRequest();

  const handleApprove = (id: number) => {
    approveRequest(
      { connectionId: id },
      { onSuccess: () => setSelectedRequest(null) },
    );
  };

  const handleReject = (id: number) => {
    if (confirm("Are you sure you want to reject this request?")) {
      rejectRequest(
        { connectionId: id },
        { onSuccess: () => setSelectedRequest(null) },
      );
    }
  };

  const rawRequests = requestsData?.items ?? [];
  const requests =
    sortBy === "oldest" ? [...rawRequests].reverse() : rawRequests;
  const stats = statsData ?? { pending: 0, approved: 0, rejected: 0, total: 0 };

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-blue-600" />
            Store Access Requests
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and manage incoming buyer access requests. Approved stores can
            view your warehouse landing page and place orders.
          </p>
        </div>
      </div>

      {/* ── KPI Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total */}
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600/80 font-medium">
                Total Requests
              </p>
              <div className="text-xl font-bold text-blue-900 tabular-nums">
                {isLoadingStats ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  stats.total
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Pending
              </p>
              <div className="flex items-center gap-2">
                <div className="text-xl font-bold tabular-nums">
                  {isLoadingStats ? (
                    <Skeleton className="h-7 w-10" />
                  ) : (
                    stats.pending
                  )}
                </div>
                {!isLoadingStats && stats.pending > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    Action needed
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approved */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Approved
              </p>
              <div className="text-xl font-bold tabular-nums text-emerald-700">
                {isLoadingStats ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  stats.approved
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rejected */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Rejected
              </p>
              <div className="text-xl font-bold tabular-nums text-red-600">
                {isLoadingStats ? (
                  <Skeleton className="h-7 w-10" />
                ) : (
                  stats.rejected
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search, Filter & Sort Bar ── */}
      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Left: Status Tabs */}
          <Tabs
            value={statusTab}
            onValueChange={(v) => setStatusTab(v as any)}
            className="w-full lg:w-auto"
          >
            <TabsList>
              <TabsTrigger value="all">
                All
                <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                  {stats.total}
                </span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                Pending
                {stats.pending > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 h-4 text-[10px] font-bold text-white bg-amber-500 rounded-full">
                    {stats.pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="active">Approved</TabsTrigger>
              <TabsTrigger value="disconnected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Right: Search + Sort */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search store name, owner, phone..."
                className="pl-9 h-9"
              />
            </div>

            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as "latest" | "oldest")}
            >
              <SelectTrigger className="w-[150px] h-9">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Request List Table ── */}
        {isLoadingRequests ? (
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
        ) : requests.length === 0 ? (
          /* ── Empty State ── */
          <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-900 text-lg">
              {statusTab === "pending"
                ? "No pending access requests 🎉"
                : `No ${statusTab === "all" ? "" : statusTab} requests found`}
            </p>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
              {debouncedSearch
                ? "Try adjusting your search or filter settings."
                : statusTab === "pending"
                  ? "All caught up! When retailers request to connect with your warehouse, they will appear here."
                  : "When retailers request to connect with your warehouse, they will appear here."}
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
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req: any, idx: number) => (
                  <TableRow
                    key={req.connectionId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => setSelectedRequest(req)}
                  >
                    <TableCell className="text-xs text-muted-foreground tabular-nums font-medium">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={req.image || undefined} />
                          <AvatarFallback className="bg-emerald-50 text-emerald-600 text-xs">
                            <Store className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-900 truncate max-w-[180px]">
                          {req.shopName || "Unnamed Store"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {req.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 tabular-nums">
                        {req.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 truncate max-w-[180px] block">
                        {req.address || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 tabular-nums">
                        {req.createdAt ? formatDate(req.createdAt) : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(req);
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
        {!isLoadingRequests && requests.length > 0 && (
          <div className="px-4 py-3 border-t bg-gray-50/50 text-xs text-muted-foreground">
            Showing {requests.length} of{" "}
            {requestsData?.pagination?.totalCount ?? requests.length} requests
          </div>
        )}
      </div>

      {/* ── Insights (only show when we have meaningful pending data) ── */}
      {!isLoadingStats && stats.pending > 0 && (
        <Card className="border-amber-100 bg-amber-50/30">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Quick Insights
            </h3>
            <ul className="space-y-1.5 text-sm text-amber-800">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {stats.pending} store{stats.pending !== 1 ? "s" : ""} waiting
                for access approval
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {stats.approved} store{stats.approved !== 1 ? "s" : ""} currently
                connected
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Detail Dialog ── */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(v) => !v && setSelectedRequest(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Request Details
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-5">
              {/* ── Store Identity ── */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border">
                <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
                  <AvatarImage src={selectedRequest.image || undefined} />
                  <AvatarFallback className="bg-emerald-50 text-emerald-600">
                    <Store className="w-7 h-7" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base truncate">
                    {selectedRequest.shopName || "Unnamed Store"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedRequest.status} />
                  </div>
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
                      {selectedRequest.name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Phone
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {selectedRequest.phone || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Request Details ── */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Request Details
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Request Type
                    </span>
                    <span className="font-medium text-gray-900">
                      Landing Page Access
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Request Date
                    </span>
                    <span className="font-medium text-gray-900 tabular-nums">
                      {selectedRequest.createdAt
                        ? formatDateTime(selectedRequest.createdAt)
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block mb-0.5">
                      Status
                    </span>
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                  {selectedRequest.connectedAt && (
                    <div>
                      <span className="text-gray-400 text-xs block mb-0.5">
                        Connected On
                      </span>
                      <span className="font-medium text-gray-900 tabular-nums">
                        {formatDateTime(selectedRequest.connectedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── Location ── */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </h4>
                {selectedRequest.shopLat && selectedRequest.shopLng ? (
                  <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden border">
                      <LocationViewMap
                        latitude={parseFloat(selectedRequest.shopLat)}
                        longitude={parseFloat(selectedRequest.shopLng)}
                      />
                    </div>
                    {selectedRequest.address && (
                      <div className="text-sm text-gray-700 flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <span>{selectedRequest.address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <span>
                      {selectedRequest.address || "No address provided"}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Actions ── */}
              <div className="space-y-2 pt-1">
                {selectedRequest.status === "pending" && (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() =>
                        handleReject(selectedRequest.connectionId)
                      }
                      disabled={isRejecting || isApproving}
                    >
                      <ShieldX className="w-4 h-4 mr-2" />
                      Reject Request
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() =>
                        handleApprove(selectedRequest.connectionId)
                      }
                      disabled={isApproving || isRejecting}
                    >
                      {isApproving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 mr-2" />
                      )}
                      Approve Access
                    </Button>
                  </div>
                )}

                {selectedRequest.status === "disconnected" && (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={() =>
                      handleApprove(selectedRequest.connectionId)
                    }
                    disabled={isApproving || isRejecting}
                  >
                    {isApproving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Re-Approve Store
                  </Button>
                )}

                {/* Secondary actions */}
                <div className="flex gap-2">
                  {selectedRequest.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      asChild
                    >
                      <a href={`tel:${selectedRequest.phone}`}>
                        <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                        Call Store
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
