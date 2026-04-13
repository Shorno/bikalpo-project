"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Download,
  Eye,
  Gift,
  Loader2,
  Search,
  Send,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from "@/components/ui/checkbox";
import { client, orpc } from "@/utils/orpc";

type InviteFilters = {
  search?: string;
  status?: string;
  userType?: string;
  page: number;
  limit: number;
};

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-blue-100 text-blue-700",
  joined: "bg-yellow-100 text-yellow-700",
  subscribed: "bg-green-100 text-green-700",
  rewarded: "bg-emerald-100 text-emerald-700",
  fraud: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  invited: "Invited",
  joined: "Joined",
  subscribed: "Subscribed",
  rewarded: "Rewarded",
  fraud: "Fraud",
};

export function InviteTrackingClient() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InviteFilters>({
    page: 1,
    limit: 10,
  });
  const [searchInput, setSearchInput] = useState("");
  const [selectedInviteId, setSelectedInviteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Fetch invite list
  const { data: listResult, isLoading: listLoading } = useQuery({
    ...orpc.adminInviteTracking.list.queryOptions({
      input: {
        search: filters.search,
        status: filters.status,
        userType: filters.userType,
        page: filters.page,
        limit: filters.limit,
      },
    }),
  });

  // Fetch KPI stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    ...orpc.adminInviteTracking.stats.queryOptions(),
  });

  // Fetch selected invite details
  const { data: inviteDetail, isLoading: detailLoading } = useQuery({
    ...orpc.adminInviteTracking.getById.queryOptions({
      input: { id: selectedInviteId! },
    }),
    enabled: selectedInviteId !== null,
  });

  // Mark fraud mutation
  const markFraudMutation = useMutation({
    mutationFn: (id: number) => client.adminInviteTracking.markFraud({ id }),
    onSuccess: () => {
      toast.success("Invite marked as fraud");
      queryClient.invalidateQueries();
      setSelectedInviteId(null);
    },
    onError: (error) => toast.error(error.message || "Failed to mark as fraud"),
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (params: { id: number; status: string }) =>
      client.adminInviteTracking.updateStatus({
        id: params.id,
        status: params.status as any,
      }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message || "Failed to update status"),
  });

  const items = listResult?.items ?? [];
  const total = listResult?.total ?? 0;
  const totalPages = listResult?.totalPages ?? 1;

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput || undefined, page: 1 });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  const handleBulkFraud = () => {
    selectedIds.forEach((id) => markFraudMutation.mutate(id));
    setSelectedIds([]);
  };

  const handleBulkApprove = () => {
    selectedIds.forEach((id) =>
      updateStatusMutation.mutate({ id, status: "rewarded" })
    );
    setSelectedIds([]);
  };

  const handleExport = () => {
    const headers = ["Invite ID", "Invited User", "Phone", "Inviter", "User Type", "Status", "Date"];
    const rows = items.map((item) => [
      item.inviteCode,
      item.invitedName || "-",
      item.invitedPhone,
      item.inviterName || "-",
      item.userType,
      item.status,
      format(new Date(item.createdAt), "yyyy-MM-dd"),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invite-tracking-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invite Tracking</h1>
        <p className="text-muted-foreground">
          Track referral invites and their lifecycle
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invites</CardTitle>
            <Send className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.totalInvites?.toLocaleString() || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Joined Users</CardTitle>
            <UserPlus className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.joinedUsers?.toLocaleString() || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribed</CardTitle>
            <UserCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.subscribedUsers?.toLocaleString() || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rewards Issued</CardTitle>
            <Gift className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                `৳${(stats?.rewardsIssued || 0).toLocaleString()}`
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Detected</CardTitle>
            <ShieldAlert className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.fraudDetected?.toLocaleString() || 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Search by invite code, phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-md"
          />
          <Button onClick={handleSearch} variant="secondary">
            <Search className="size-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Select
            value={filters.status || "all"}
            onValueChange={(val) =>
              setFilters({ ...filters, status: val === "all" ? undefined : val, page: 1 })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="joined">Joined</SelectItem>
              <SelectItem value="subscribed">Subscribed</SelectItem>
              <SelectItem value="rewarded">Rewarded</SelectItem>
              <SelectItem value="fraud">Fraud</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.userType || "all"}
            onValueChange={(val) =>
              setFilters({ ...filters, userType: val === "all" ? undefined : val, page: 1 })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="User Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="retailer">Retailer</SelectItem>
              <SelectItem value="wholesaler">Wholesaler</SelectItem>
            </SelectContent>
          </Select>

          {(filters.search || filters.status || filters.userType) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setFilters({ page: 1, limit: 20 });
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <Button size="sm" onClick={handleBulkApprove}>
            <Gift className="size-4 mr-1" />
            Approve Rewards
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkFraud}>
            <ShieldAlert className="size-4 mr-1" />
            Mark Fraud
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="size-4 mr-1" />
            Export List
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Invite List Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={items.length > 0 && selectedIds.length === items.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Invite ID</TableHead>
              <TableHead>Invited User</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Inviter</TableHead>
              <TableHead>User Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10}>
                    <div className="h-6 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id} data-state={selectedIds.includes(item.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.inviteCode}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.invitedName || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.invitedEmail || ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.invitedPhone}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{item.inviterName || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.inviterPhone || ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {item.userType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedInviteId(item.id)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No invite data found</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Rows per page</p>
          <Select
            value={String(filters.limit)}
            onValueChange={(val) =>
              setFilters({ ...filters, limit: Number(val), page: 1 })
            }
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {total > 0
            ? `Showing ${(filters.page - 1) * filters.limit + 1} to ${Math.min(filters.page * filters.limit, total)} of ${total}`
            : "No results"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Invite Detail Dialog */}
      <Dialog
        open={selectedInviteId !== null}
        onOpenChange={(open) => !open && setSelectedInviteId(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto thin-scrollbar">
          <DialogHeader>
            <DialogTitle>Invite Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : inviteDetail ? (
            <div className="space-y-5">
              {/* Invite Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Invite ID</p>
                  <p className="font-mono font-medium">{inviteDetail.inviteCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inviteDetail.status] || ""}`}
                  >
                    {STATUS_LABELS[inviteDetail.status] || inviteDetail.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">User Type</p>
                  <p className="font-medium capitalize">{inviteDetail.userType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(inviteDetail.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              {/* Invited User */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">👤 Invited User</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{inviteDetail.invitedName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{inviteDetail.invitedPhone}</p>
                  </div>
                </div>
              </div>

              {/* Inviter Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">👤 Inviter Info</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Invited By</p>
                    <p className="font-medium">{inviteDetail.inviterName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Inviter Type</p>
                    <p className="font-medium capitalize">{inviteDetail.inviterRole || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{inviteDetail.inviterPhone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium text-xs">{inviteDetail.inviterEmail || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">📞 Contact Info</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Phone Verified</p>
                    <p className="font-medium text-green-600">✔ Yes</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium text-xs">{inviteDetail.invitedEmail || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Invite Status Flow */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">📊 Invite Status Flow</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-green-500" />
                    <span>Invite Sent</span>
                    <span className="text-green-600 text-xs ml-auto">✔ Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        ["joined", "subscribed", "rewarded"].includes(inviteDetail.status)
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <span>User Registered</span>
                    {["joined", "subscribed", "rewarded"].includes(inviteDetail.status) ? (
                      <span className="text-green-600 text-xs ml-auto">✔ Completed</span>
                    ) : (
                      <span className="text-muted-foreground text-xs ml-auto">Pending</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        ["subscribed", "rewarded"].includes(inviteDetail.status)
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    />
                    <span>Subscription Purchased</span>
                    {["subscribed", "rewarded"].includes(inviteDetail.status) ? (
                      <span className="text-green-600 text-xs ml-auto">✔ Completed</span>
                    ) : (
                      <span className="text-muted-foreground text-xs ml-auto">Pending</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        inviteDetail.status === "rewarded" ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    <span>Reward Issued</span>
                    {inviteDetail.status === "rewarded" ? (
                      <span className="text-green-600 text-xs ml-auto">✔ Completed</span>
                    ) : (
                      <span className="text-muted-foreground text-xs ml-auto">Pending</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Reward Info */}
              {inviteDetail.reward && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">🎁 Reward Info</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Reward Type</p>
                      <p className="font-medium">Cash Bonus</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reward Amount</p>
                      <p className="font-medium">৳{inviteDetail.reward.amount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reward Status</p>
                      <p className="font-medium capitalize">{inviteDetail.reward.status}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reward Code</p>
                      <p className="font-mono font-medium">{inviteDetail.reward.rewardCode}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fraud Detection */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">🚨 Fraud Detection</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Multiple Accounts</span>
                    <span className={inviteDetail.status === "fraud" ? "text-red-600" : "text-green-600"}>
                      {inviteDetail.status === "fraud" ? "⚠ Detected" : "❌ No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Same Device</span>
                    <span className="text-green-600">❌ No</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Suspicious Pattern</span>
                    <span className={inviteDetail.status === "fraud" ? "text-red-600" : "text-green-600"}>
                      {inviteDetail.status === "fraud" ? "⚠ Flagged" : "❌ No"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">⚙ Actions</h4>
                <div className="flex gap-2 flex-wrap">
                  {inviteDetail.status !== "fraud" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => markFraudMutation.mutate(inviteDetail.id)}
                      disabled={markFraudMutation.isPending}
                    >
                      <ShieldAlert className="size-4 mr-1" />
                      Mark as Fraud
                    </Button>
                  )}
                  {inviteDetail.status === "subscribed" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: inviteDetail.id,
                          status: "rewarded",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <Gift className="size-4 mr-1" />
                      Approve Reward
                    </Button>
                  )}
                  {inviteDetail.status !== "fraud" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast.info("Investigation started for " + inviteDetail.inviteCode);
                      }}
                    >
                      <Search className="size-4 mr-1" />
                      Investigate
                    </Button>
                  )}
                  {inviteDetail.status === "fraud" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: inviteDetail.id,
                          status: "invited",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
