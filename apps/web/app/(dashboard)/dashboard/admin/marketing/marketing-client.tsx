"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Check,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  Package,
  Search,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

// ── Types ───────────────────────────────────────────────────────────
type MaterialRequest = {
  id: string;
  requestNumber: string;
  materialId: string;
  requestedByUserId: string;
  userType: string;
  quantity: number;
  deliveryType: string;
  paymentType: string;
  paymentAmount: number | null;
  deliveryAddress: string | null;
  deliveryContact: string | null;
  status: string;
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  material?: {
    id: string;
    title: string;
    type: string;
    category: string | null;
    designFileUrl: string | null;
    sizeFormat: string | null;
  };
  requestedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
    icon: "🟡",
  },
  approved: {
    label: "Approved",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    icon: "🔵",
  },
  dispatched: {
    label: "Dispatched",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-200",
    icon: "🟢",
  },
  delivered: {
    label: "Delivered",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    icon: "✅",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    icon: "🔴",
  },
};

const materialTypeLabels: Record<string, string> = {
  banner: "Banner",
  sticker: "Sticker",
  leaflet: "Leaflet",
  poster: "Poster",
  standee: "Standee",
  qr_sticker: "QR Sticker",
};

// ── Component ───────────────────────────────────────────────────────
export function MarketingClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUserType, setFilterUserType] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialog state
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [actionType, setActionType] = useState<
    "approve" | "reject" | "dispatch" | "deliver" | null
  >(null);
  const [adminNote, setAdminNote] = useState("");

  // ── Data fetching ──────────────────────────────────────────────
  const statusFilter = activeTab === "all" ? undefined : activeTab;

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    ...orpc.adminMarketing.listRequests.queryOptions({
      input: {
        status: statusFilter,
        materialType: filterType === "all" ? undefined : filterType,
        userType: filterUserType === "all" ? undefined : filterUserType,
        search: search || undefined,
      },
    }),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    ...orpc.adminMarketing.stats.queryOptions(),
  });

  const { data: inventoryData } = useQuery({
    ...orpc.adminMarketing.inventorySummary.queryOptions(),
  });

  const requests = (requestsData?.requests ?? []) as MaterialRequest[];
  const stats = statsData;

  // ── Mutations ──────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.approveRequest(params),
    onSuccess: () => {
      toast.success("Request approved");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (e) => toast.error(e.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.rejectRequest(params),
    onSuccess: () => {
      toast.success("Request rejected");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (e) => toast.error(e.message || "Failed to reject"),
  });

  const dispatchMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.markDispatched(params),
    onSuccess: () => {
      toast.success("Marked as dispatched");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (e) => toast.error(e.message || "Failed to dispatch"),
  });

  const deliverMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.markDelivered(params),
    onSuccess: () => {
      toast.success("Marked as delivered");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (e) => toast.error(e.message || "Failed to mark delivered"),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (params: { requestIds: string[] }) =>
      client.adminMarketing.bulkApprove(params),
    onSuccess: (data) => {
      toast.success(`${data.approved} requests approved`);
      queryClient.invalidateQueries();
      setSelectedIds([]);
    },
  });

  const bulkDispatchMutation = useMutation({
    mutationFn: (params: { requestIds: string[] }) =>
      client.adminMarketing.bulkDispatch(params),
    onSuccess: (data) => {
      toast.success(`${data.dispatched} requests dispatched`);
      queryClient.invalidateQueries();
      setSelectedIds([]);
    },
  });

  // ── Dialog handlers ────────────────────────────────────────────
  const openDialog = (
    req: MaterialRequest,
    action: "approve" | "reject" | "dispatch" | "deliver",
  ) => {
    setSelectedRequest(req);
    setActionType(action);
    setAdminNote("");
  };

  const closeDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminNote("");
  };

  const handleConfirmAction = () => {
    if (!selectedRequest || !actionType) return;
    const params = {
      requestId: selectedRequest.id,
      adminNote: adminNote || undefined,
    };

    if (actionType === "approve") approveMutation.mutate(params);
    else if (actionType === "reject") rejectMutation.mutate(params);
    else if (actionType === "dispatch") dispatchMutation.mutate(params);
    else if (actionType === "deliver") deliverMutation.mutate(params);
  };

  const isActionPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    dispatchMutation.isPending ||
    deliverMutation.isPending;

  // ── Selection helpers ──────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === requests.length) setSelectedIds([]);
    else setSelectedIds(requests.map((r) => r.id));
  };

  // ── CSV Export ─────────────────────────────────────────────────
  const handleExport = () => {
    if (requests.length === 0) return;
    const headers = [
      "Request ID",
      "Material",
      "Type",
      "Qty",
      "Seller",
      "User Type",
      "Status",
      "Date",
    ];
    const rows = requests.map((r) => [
      r.requestNumber,
      r.material?.title || "",
      r.material?.type || "",
      r.quantity,
      r.requestedBy?.name || "",
      r.userType,
      r.status,
      format(new Date(r.createdAt), "yyyy-MM-dd"),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marketing-requests-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Marketing Materials
          </h1>
          <p className="text-muted-foreground">
            Manage material requests and fulfillment
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/admin/marketing/materials">
            <Package className="mr-2 size-4" />
            Manage Designs
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {[
          {
            label: "Total Orders",
            value: stats?.totalOrders ?? 0,
            icon: FileText,
            color: "text-slate-600",
          },
          {
            label: "Pending",
            value: stats?.pending ?? 0,
            icon: Clock,
            color: "text-amber-500",
          },
          {
            label: "Approved",
            value: stats?.approved ?? 0,
            icon: Check,
            color: "text-blue-500",
          },
          {
            label: "Dispatched",
            value: stats?.dispatched ?? 0,
            icon: Truck,
            color: "text-emerald-500",
          },
          {
            label: "Delivered",
            value: stats?.delivered ?? 0,
            icon: Package,
            color: "text-green-600",
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.label}
              </CardTitle>
              <kpi.icon className={`size-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  kpi.value
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inventory Summary (compact) */}
      {inventoryData?.inventory && inventoryData.inventory.length > 0 && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Inventory Stock
          </h2>
          <div className="flex flex-wrap gap-3">
            {inventoryData.inventory.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                <span className="font-medium">{item.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {item.stockQuantity} pcs
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by request ID or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Material Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="banner">Banner</SelectItem>
            <SelectItem value="sticker">Sticker</SelectItem>
            <SelectItem value="leaflet">Leaflet</SelectItem>
            <SelectItem value="poster">Poster</SelectItem>
            <SelectItem value="standee">Standee</SelectItem>
            <SelectItem value="qr_sticker">QR Sticker</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterUserType} onValueChange={setFilterUserType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="User Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="retailer">Retailer</SelectItem>
            <SelectItem value="wholesaler">Wholesaler</SelectItem>
            <SelectItem value="warehouse">Warehouse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              bulkApproveMutation.mutate({ requestIds: selectedIds })
            }
            disabled={bulkApproveMutation.isPending}
          >
            <Check className="mr-1 size-3" />
            Approve Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              bulkDispatchMutation.mutate({ requestIds: selectedIds })
            }
            disabled={bulkDispatchMutation.isPending}
          >
            <Truck className="mr-1 size-3" />
            Dispatch Selected
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1 size-3" />
            Export CSV
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            <Clock className="mr-1.5 size-3.5" />
            Pending
            {(stats?.pending ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                {stats!.pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        {/* Shared content for all tabs */}
        {[
          "all",
          "pending",
          "approved",
          "dispatched",
          "delivered",
          "rejected",
        ].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {requestsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
                <FileText className="size-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No material requests found</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            selectedIds.length === requests.length &&
                            requests.length > 0
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req, idx) => {
                      const sc = statusConfig[req.status] ?? statusConfig.pending;
                      return (
                        <TableRow key={req.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(req.id)}
                              onCheckedChange={() => toggleSelect(req.id)}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {req.requestNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {req.requestedBy?.name || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {req.userType}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">
                                {req.material?.title || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {materialTypeLabels[req.material?.type ?? ""] ??
                                  req.material?.type}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{req.quantity} pcs</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`${sc.bgColor} ${sc.color} capitalize`}
                            >
                              {sc.icon} {sc.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(req.createdAt), "MMM d")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" variant="ghost" asChild>
                                <Link
                                  href={`/dashboard/admin/marketing/requests/${req.id}`}
                                >
                                  <Eye className="size-3.5 mr-1" />
                                  View
                                </Link>
                              </Button>
                              {req.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => openDialog(req, "approve")}
                                  >
                                    <Check className="size-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => openDialog(req, "reject")}
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </>
                              )}
                              {req.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => openDialog(req, "dispatch")}
                                >
                                  <Truck className="size-3.5" />
                                </Button>
                              )}
                              {req.status === "dispatched" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => openDialog(req, "deliver")}
                                >
                                  <Package className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Action Dialog */}
      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={() => closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionType === "dispatch"
                ? "Mark as Dispatched"
                : actionType === "deliver"
                  ? "Mark as Delivered"
                  : `${actionType} Request`}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" &&
                `Approve request ${selectedRequest?.requestNumber} for ${selectedRequest?.quantity} pcs of "${selectedRequest?.material?.title}"`}
              {actionType === "reject" &&
                `Reject request ${selectedRequest?.requestNumber}`}
              {actionType === "dispatch" &&
                `Mark ${selectedRequest?.requestNumber} as dispatched. Stock will be deducted.`}
              {actionType === "deliver" &&
                `Mark ${selectedRequest?.requestNumber} as delivered.`}
            </DialogDescription>
          </DialogHeader>

          {/* Request Summary */}
          <div className="rounded-lg bg-gray-50 dark:bg-muted/30 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono font-medium">
                {selectedRequest?.requestNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seller</span>
              <span className="font-medium">
                {selectedRequest?.requestedBy?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Material</span>
              <span className="font-medium">
                {selectedRequest?.material?.title}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">
                {selectedRequest?.quantity} pcs
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Admin Note</span>
            <Textarea
              placeholder="Add a note..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={isActionPending}
              className={
                actionType === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : actionType === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
              }
            >
              {isActionPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {actionType === "approve" && "Approve"}
              {actionType === "reject" && "Reject"}
              {actionType === "dispatch" && "Mark Dispatched"}
              {actionType === "deliver" && "Mark Delivered"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
