"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  X,
  XCircle,
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
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

type RewardFilters = {
  search?: string;
  status?: string;
  userType?: string;
  page: number;
  limit: number;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const FRAUD_COLORS: Record<string, string> = {
  clear: "text-green-600",
  flagged: "text-red-600",
  pending: "text-yellow-600",
};

export function RewardsClient() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<RewardFilters>({
    page: 1,
    limit: 20,
  });
  const [searchInput, setSearchInput] = useState("");
  const [selectedRewardId, setSelectedRewardId] = useState<number | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Fetch reward list
  const { data: listResult, isLoading: listLoading } = useQuery({
    ...orpc.adminReward.list.queryOptions({
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
    ...orpc.adminReward.stats.queryOptions(),
  });

  // Fetch selected reward details
  const { data: rewardDetail, isLoading: detailLoading } = useQuery({
    ...orpc.adminReward.getById.queryOptions({
      input: { id: selectedRewardId! },
    }),
    enabled: selectedRewardId !== null,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: number) => client.adminReward.approve({ id }),
    onSuccess: () => {
      toast.success("Reward approved");
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message || "Failed to approve"),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (params: { id: number; reason?: string }) =>
      client.adminReward.reject(params),
    onSuccess: () => {
      toast.success("Reward rejected");
      queryClient.invalidateQueries();
      setShowRejectDialog(null);
      setRejectReason("");
    },
    onError: (error) => toast.error(error.message || "Failed to reject"),
  });

  // Mark paid mutation
  const markPaidMutation = useMutation({
    mutationFn: (id: number) => client.adminReward.markPaid({ id }),
    onSuccess: () => {
      toast.success("Reward paid & wallet updated");
      queryClient.invalidateQueries();
      setSelectedRewardId(null);
    },
    onError: (error) => toast.error(error.message || "Failed to mark as paid"),
  });

  // Flag fraud mutation
  const flagFraudMutation = useMutation({
    mutationFn: (params: { id: number; reason: string }) =>
      client.adminReward.flagFraud(params),
    onSuccess: () => {
      toast.success("Reward flagged as fraud");
      queryClient.invalidateQueries();
      setSelectedRewardId(null);
    },
    onError: (error) => toast.error(error.message || "Failed to flag"),
  });

  const items = listResult?.items ?? [];
  const total = listResult?.total ?? 0;
  const totalPages = listResult?.totalPages ?? 1;

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput || undefined, page: 1 });
  };

  const formatTaka = (amount: number) => `৳${amount.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reward System</h1>
        <p className="text-muted-foreground">
          Manage referral rewards, approvals, and payouts
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Generated
            </CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                formatTaka(stats?.totalRewards || 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approval
            </CardTitle>
            <Clock className="size-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                formatTaka(stats?.pendingApproval || 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                formatTaka(stats?.approved || 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <Banknote className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                formatTaka(stats?.paid || 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fraud Blocked
            </CardTitle>
            <ShieldAlert className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                formatTaka(stats?.fraudBlocked || 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Search by reward code, phone..."
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
              setFilters({
                ...filters,
                status: val === "all" ? undefined : val,
                page: 1,
              })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.userType || "all"}
            onValueChange={(val) =>
              setFilters({
                ...filters,
                userType: val === "all" ? undefined : val,
                page: 1,
              })
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

      {/* Reward List Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reward ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>User Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fraud</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <div className="h-6 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">
                    {item.rewardCode}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.userName || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.userPhone || ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    ৳{item.amount}
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
                  <TableCell>
                    <span
                      className={`text-xs font-medium capitalize ${FRAUD_COLORS[item.fraudCheck] || ""}`}
                    >
                      {item.fraudCheck === "clear" && (
                        <ShieldCheck className="size-4 inline" />
                      )}
                      {item.fraudCheck === "flagged" && (
                        <AlertTriangle className="size-4 inline" />
                      )}
                      {item.fraudCheck === "pending" && (
                        <Clock className="size-3 inline" />
                      )}{" "}
                      {item.fraudCheck}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {item.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => approveMutation.mutate(item.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setShowRejectDialog(item.id)}
                          >
                            <XCircle className="size-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedRewardId(item.id)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Wallet className="size-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No rewards found</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(filters.page - 1) * filters.limit + 1} to{" "}
            {Math.min(filters.page * filters.limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() =>
                setFilters({ ...filters, page: filters.page - 1 })
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() =>
                setFilters({ ...filters, page: filters.page + 1 })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog
        open={showRejectDialog !== null}
        onOpenChange={(open) => !open && setShowRejectDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Reward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Why is this being rejected?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() =>
                showRejectDialog &&
                rejectMutation.mutate({
                  id: showRejectDialog,
                  reason: rejectReason || undefined,
                })
              }
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <XCircle className="size-4 mr-2" />
              )}
              Reject Reward
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reward Detail Dialog */}
      <Dialog
        open={selectedRewardId !== null}
        onOpenChange={(open) => !open && setSelectedRewardId(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reward Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : rewardDetail ? (
            <div className="space-y-6">
              {/* Reward Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Reward ID</p>
                  <p className="font-mono font-medium">
                    {rewardDetail.rewardCode}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold">৳{rewardDetail.amount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[rewardDetail.status] || ""}`}
                  >
                    {STATUS_LABELS[rewardDetail.status] || rewardDetail.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">User Type</p>
                  <p className="font-medium capitalize">
                    {rewardDetail.userType}
                  </p>
                </div>
              </div>

              {/* User Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">User Info</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {rewardDetail.userName || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">
                      {rewardDetail.userPhone || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Role</p>
                    <p className="font-medium capitalize">
                      {rewardDetail.userRole || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fraud Check */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Fraud Check</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p
                      className={`font-medium capitalize ${FRAUD_COLORS[rewardDetail.fraudCheck] || ""}`}
                    >
                      {rewardDetail.fraudCheck}
                    </p>
                  </div>
                  {rewardDetail.fraudReason && (
                    <div>
                      <p className="text-muted-foreground">Reason</p>
                      <p className="font-medium text-red-600">
                        {rewardDetail.fraudReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Invite */}
              {rewardDetail.invite && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Linked Invite</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Invite Code</p>
                      <p className="font-mono font-medium">
                        {rewardDetail.invite.inviteCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Invited Phone</p>
                      <p className="font-medium">
                        {rewardDetail.invite.invitedPhone}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>
                      {format(
                        new Date(rewardDetail.createdAt),
                        "MMM d, yyyy HH:mm",
                      )}
                    </span>
                  </div>
                  {rewardDetail.approvedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved</span>
                      <span>
                        {format(
                          new Date(rewardDetail.approvedAt),
                          "MMM d, yyyy HH:mm",
                        )}
                      </span>
                    </div>
                  )}
                  {rewardDetail.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid</span>
                      <span>
                        {format(
                          new Date(rewardDetail.paidAt),
                          "MMM d, yyyy HH:mm",
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2 flex-wrap">
                {rewardDetail.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(rewardDetail.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle2 className="size-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowRejectDialog(rewardDetail.id)}
                    >
                      <XCircle className="size-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                {rewardDetail.status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() => markPaidMutation.mutate(rewardDetail.id)}
                    disabled={markPaidMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Banknote className="size-4 mr-1" />
                    Mark as Paid
                  </Button>
                )}
                {rewardDetail.fraudCheck !== "flagged" &&
                  rewardDetail.status !== "paid" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() =>
                        flagFraudMutation.mutate({
                          id: rewardDetail.id,
                          reason: "Flagged by admin",
                        })
                      }
                      disabled={flagFraudMutation.isPending}
                    >
                      <ShieldAlert className="size-4 mr-1" />
                      Flag Fraud
                    </Button>
                  )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
