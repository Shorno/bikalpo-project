"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Eye,
  Loader2,
  Percent,
  Phone,
  Plus,
  Search,
  TrendingUp,
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
import { client, orpc } from "@/utils/orpc";

type AdminInviteFilters = {
  search?: string;
  status?: string;
  userType?: string;
  page: number;
  limit: number;
};

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-blue-100 text-blue-700",
  joined: "bg-yellow-100 text-yellow-700",
  converted: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  invited: "Invited",
  joined: "Joined",
  converted: "Converted",
};

export function AdminInvitesClient() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AdminInviteFilters>({
    page: 1,
    limit: 20,
  });
  const [searchInput, setSearchInput] = useState("");
  const [selectedInviteId, setSelectedInviteId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Create invite form state
  const [createForm, setCreateForm] = useState({
    invitedPhone: "",
    invitedName: "",
    userType: "pending" as "retailer" | "wholesaler" | "pending",
    inviteMethod: "direct_call" as "direct_call" | "campaign",
  });

  // Fetch invite list
  const { data: listResult, isLoading: listLoading } = useQuery({
    ...orpc.adminAssistedInvite.list.queryOptions({
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
    ...orpc.adminAssistedInvite.stats.queryOptions(),
  });

  // Fetch selected invite details
  const { data: inviteDetail, isLoading: detailLoading } = useQuery({
    ...orpc.adminAssistedInvite.getById.queryOptions({
      input: { id: selectedInviteId! },
    }),
    enabled: selectedInviteId !== null,
  });

  // Create invite mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) =>
      client.adminAssistedInvite.create(data),
    onSuccess: () => {
      toast.success("Invite created successfully");
      queryClient.invalidateQueries();
      setShowCreateDialog(false);
      setCreateForm({
        invitedPhone: "",
        invitedName: "",
        userType: "pending",
        inviteMethod: "direct_call",
      });
    },
    onError: (error) => toast.error(error.message || "Failed to create invite"),
  });

  // Mark converted mutation
  const markConvertedMutation = useMutation({
    mutationFn: (id: number) =>
      client.adminAssistedInvite.markConverted({ id }),
    onSuccess: () => {
      toast.success("Marked as converted");
      queryClient.invalidateQueries();
      setSelectedInviteId(null);
    },
    onError: (error) =>
      toast.error(error.message || "Failed to mark as converted"),
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (params: { id: number; status: string }) =>
      client.adminAssistedInvite.updateStatus({
        id: params.id,
        status: params.status as any,
      }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message || "Failed to update"),
  });

  const items = listResult?.items ?? [];
  const total = listResult?.total ?? 0;
  const totalPages = listResult?.totalPages ?? 1;

  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput || undefined, page: 1 });
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Invites</h1>
          <p className="text-muted-foreground">
            Manage admin-assisted invites and track conversions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="size-4 mr-2" />
          New Invite
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Admin Invites
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">
              Converted (Subscribed)
            </CardTitle>
            <UserCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.convertedUsers?.toLocaleString() || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <Percent className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                `${stats?.conversionRate || 0}%`
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      {stats?.funnel && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="size-4" />
              Conversion Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-2xl font-bold text-blue-700">
                  {stats.funnel.inviteSent.count}
                </p>
                <p className="text-xs text-muted-foreground">Invite Sent</p>
                <p className="text-xs font-medium text-blue-600">
                  {stats.funnel.inviteSent.rate}%
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-50">
                <p className="text-2xl font-bold text-yellow-700">
                  {stats.funnel.joined.count}
                </p>
                <p className="text-xs text-muted-foreground">Joined</p>
                <p className="text-xs font-medium text-yellow-600">
                  {stats.funnel.joined.rate}%
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50">
                <p className="text-2xl font-bold text-green-700">
                  {stats.funnel.subscribed.count}
                </p>
                <p className="text-xs text-muted-foreground">Subscribed</p>
                <p className="text-xs font-medium text-green-600">
                  {stats.funnel.subscribed.rate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Search by name, phone, invite code..."
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
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="joined">Joined</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
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

      {/* Admin Invite List Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invite ID</TableHead>
              <TableHead>Invited User</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Method</TableHead>
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
                  <TableCell colSpan={9}>
                    <div className="h-6 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">
                    {item.inviteCode}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {item.invitedName || item.invitedRegisteredName || "-"}
                      </p>
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
                      <p className="text-sm">{item.adminName || "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.adminPhone || ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {item.inviteMethod?.replace("_", " ")}
                    </Badge>
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
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No admin invite data found
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="size-4 mr-1" />
                      Start Campaign
                    </Button>
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

      {/* Create Invite Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Admin Invite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                placeholder="01XXXXXXXXX"
                value={createForm.invitedPhone}
                onChange={(e) =>
                  setCreateForm({ ...createForm, invitedPhone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                placeholder="User name"
                value={createForm.invitedName}
                onChange={(e) =>
                  setCreateForm({ ...createForm, invitedName: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>User Type</Label>
                <Select
                  value={createForm.userType}
                  onValueChange={(val) =>
                    setCreateForm({
                      ...createForm,
                      userType: val as "retailer" | "wholesaler" | "pending",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Auto-detect</SelectItem>
                    <SelectItem value="retailer">Retailer</SelectItem>
                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invite Method</Label>
                <Select
                  value={createForm.inviteMethod}
                  onValueChange={(val) =>
                    setCreateForm({
                      ...createForm,
                      inviteMethod: val as "direct_call" | "campaign",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct_call">Direct Call</SelectItem>
                    <SelectItem value="campaign">Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate(createForm)}
              disabled={
                createMutation.isPending || !createForm.invitedPhone.trim()
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Plus className="size-4 mr-2" />
              )}
              Create Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Detail Dialog */}
      <Dialog
        open={selectedInviteId !== null}
        onOpenChange={(open) => !open && setSelectedInviteId(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Admin Invite Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : inviteDetail ? (
            <div className="space-y-6">
              {/* Invite Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Invite ID</p>
                  <p className="font-mono font-medium">
                    {inviteDetail.inviteCode}
                  </p>
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
                  <p className="font-medium capitalize">
                    {inviteDetail.userType}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Method</p>
                  <p className="font-medium capitalize">
                    {inviteDetail.inviteMethod?.replace("_", " ")}
                  </p>
                </div>
              </div>

              {/* Invited User */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Invited User</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {inviteDetail.invitedName ||
                        inviteDetail.invitedRegisteredName ||
                        "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{inviteDetail.invitedPhone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium text-xs">
                      {inviteDetail.invitedEmail || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Info */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Admin Info</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Assigned By</p>
                    <p className="font-medium">
                      {inviteDetail.adminName || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">
                      {inviteDetail.adminPhone || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium text-xs">
                      {inviteDetail.adminEmail || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(
                        new Date(inviteDetail.createdAt),
                        "MMM d, yyyy",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Conversion Status */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">
                  Conversion Status
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${inviteDetail.status !== "" ? "bg-green-500" : "bg-gray-300"}`}
                    />
                    <span>Invite Sent</span>
                    <span className="text-green-600 text-xs">✔ Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${inviteDetail.status === "joined" || inviteDetail.status === "converted" ? "bg-green-500" : "bg-gray-300"}`}
                    />
                    <span>User Joined</span>
                    {(inviteDetail.status === "joined" ||
                      inviteDetail.status === "converted") && (
                      <span className="text-green-600 text-xs">
                        ✔ Completed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${inviteDetail.status === "converted" ? "bg-green-500" : "bg-gray-300"}`}
                    />
                    <span>Subscription</span>
                    {inviteDetail.status === "converted" && (
                      <span className="text-green-600 text-xs">
                        ✔ Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2">
                {inviteDetail.status !== "converted" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      markConvertedMutation.mutate(inviteDetail.id)
                    }
                    disabled={markConvertedMutation.isPending}
                  >
                    <UserCheck className="size-4 mr-1" />
                    Mark Converted
                  </Button>
                )}
                {inviteDetail.status === "invited" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: inviteDetail.id,
                        status: "joined",
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                  >
                    Mark Joined
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
