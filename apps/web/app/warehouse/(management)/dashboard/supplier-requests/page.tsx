"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  ShieldX,
  User,
  Warehouse,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useApproveWarehouseSupplierRequest,
  useRejectWarehouseSupplierRequest,
  useWarehouseSupplierRequests,
  useWarehouseSupplierRequestStats,
} from "@/hooks/use-warehouse-supplier-connections";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    icon: Clock,
  },
  active: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  disconnected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    icon: XCircle,
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

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function SupplierRequestsPage() {
  const [statusTab, setStatusTab] = useState<"all" | "pending" | "active" | "disconnected">("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    clearTimeout((window as any).__warehouseSupplierReqTimer);
    (window as any).__warehouseSupplierReqTimer = setTimeout(
      () => setDebouncedSearch(value),
      400,
    );
  }, []);

  const { data: statsData, isLoading: isLoadingStats } =
    useWarehouseSupplierRequestStats();
  const { data: requestsData, isLoading: isLoadingRequests } =
    useWarehouseSupplierRequests({
      status: statusTab,
      search: debouncedSearch,
    });

  const approveMutation = useApproveWarehouseSupplierRequest();
  const rejectMutation = useRejectWarehouseSupplierRequest();

  const handleApprove = (connectionId: number) => {
    approveMutation.mutate(
      { connectionId },
      { onSuccess: () => setSelectedRequest(null) },
    );
  };

  const handleReject = (connectionId: number) => {
    if (!confirm("Reject this warehouse supplier request?")) return;
    rejectMutation.mutate(
      { connectionId },
      { onSuccess: () => setSelectedRequest(null) },
    );
  };

  const requests = requestsData?.items ?? [];
  const stats = statsData ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-blue-600" />
            Warehouse Supplier Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review warehouses that want to add your warehouse as a supplier.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Total Requests"
          value={stats.total}
          loading={isLoadingStats}
          icon={<Warehouse className="w-5 h-5 text-blue-600" />}
          tone="blue"
        />
        <StatsCard
          label="Pending"
          value={stats.pending}
          loading={isLoadingStats}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          tone="amber"
        />
        <StatsCard
          label="Approved"
          value={stats.approved}
          loading={isLoadingStats}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          tone="emerald"
        />
        <StatsCard
          label="Rejected"
          value={stats.rejected}
          loading={isLoadingStats}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          tone="red"
        />
      </div>

      <div className="bg-white border rounded-xl shadow-sm">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <Tabs
            value={statusTab}
            onValueChange={(value) => setStatusTab(value as any)}
            className="w-full lg:w-auto"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Pending
                {stats.pending > 0 ? (
                  <span className="ml-1.5 inline-flex items-center justify-center px-1.5 h-4 text-[10px] font-bold text-white bg-amber-500 rounded-full">
                    {stats.pending}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="active">Approved</TabsTrigger>
              <TabsTrigger value="disconnected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1 lg:w-80 lg:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Search warehouse name, slug, phone..."
              className="pl-9 h-9"
            />
          </div>
        </div>

        {isLoadingRequests ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-900 text-lg">
              {statusTab === "pending"
                ? "No pending warehouse requests"
                : "No warehouse supplier requests found"}
            </p>
            <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
              {debouncedSearch
                ? "Try adjusting your search."
                : "When another warehouse requests supplier access, it will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester Warehouse</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request: any) => (
                  <TableRow
                    key={request.connectionId}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <TableCell>
                      <div className="font-medium">
                        {request.buyerWarehouseName || request.buyerName || "Unnamed Warehouse"}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">
                        {request.buyerWarehouseSlug || request.buyerWarehouseId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {request.buyerName || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{request.buyerPhone || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 truncate max-w-[220px] block">
                        {request.buyerWarehouseAddress || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500 tabular-nums">
                        {formatDate(request.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedRequest(request);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {!isLoadingStats && stats.pending > 0 ? (
        <Card className="border-amber-100 bg-amber-50/30">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Action Needed
            </h3>
            <p className="text-sm text-amber-800">
              {stats.pending} warehouse{stats.pending === 1 ? "" : "s"} waiting for supplier access approval.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Warehouse Request Details
            </DialogTitle>
          </DialogHeader>

          {selectedRequest ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Warehouse className="w-6 h-6 text-blue-700" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {selectedRequest.buyerWarehouseName || selectedRequest.buyerName || "Unnamed Warehouse"}
                    </h3>
                    <div className="mt-1">
                      <StatusBadge status={selectedRequest.status} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Info label="Owner" value={selectedRequest.buyerName || "-"} />
                <Info label="Phone" value={selectedRequest.buyerPhone || "-"} />
                <Info label="Slug" value={selectedRequest.buyerWarehouseSlug || "-"} />
                <Info label="Requested" value={formatDateTime(selectedRequest.createdAt)} />
                {selectedRequest.connectedAt ? (
                  <Info label="Connected" value={formatDateTime(selectedRequest.connectedAt)} />
                ) : null}
              </div>

              <div className="rounded-lg border p-3 text-sm flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span>{selectedRequest.buyerWarehouseAddress || "No address provided"}</span>
              </div>

              {selectedRequest.status === "pending" ? (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    disabled={isMutating}
                    onClick={() => handleReject(selectedRequest.connectionId)}
                  >
                    <ShieldX className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={isMutating}
                    onClick={() => handleApprove(selectedRequest.connectionId)}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </div>
              ) : null}

              {selectedRequest.status === "disconnected" ? (
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  disabled={isMutating}
                  onClick={() => handleApprove(selectedRequest.connectionId)}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Re-Approve Warehouse
                </Button>
              ) : null}

              {selectedRequest.buyerPhone ? (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href={`tel:${selectedRequest.buyerPhone}`}>
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    Call Warehouse
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsCard({
  label,
  value,
  loading,
  icon,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: ReactNode;
  tone: "blue" | "amber" | "emerald" | "red";
}) {
  const toneClass = {
    blue: "bg-blue-100",
    amber: "bg-amber-100",
    emerald: "bg-emerald-100",
    red: "bg-red-100",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${toneClass} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className="text-xl font-bold tabular-nums">
            {loading ? <Skeleton className="h-7 w-10" /> : value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 text-xs block mb-0.5">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
