"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  ShieldCheck,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";

type SubscriptionStatus =
  | "trial"
  | "pending_payment"
  | "pending_approval"
  | "active"
  | "expired"
  | "cancelled";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Trial",
  pending_payment: "Pending Payment",
  pending_approval: "Pending Approval",
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  trial: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending_payment: "bg-gray-100 text-gray-700 border-gray-200",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
  active: "bg-blue-100 text-blue-700 border-blue-200",
  expired: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionDialog, setActionDialog] = useState<{
    type: "approve" | "reject" | "extend" | "view";
    subscriptionId: string;
    shopName?: string;
    paymentProof?: string;
  } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [extendDays, setExtendDays] = useState(7);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", statusFilter],
    queryFn: () =>
      client.adminSubscription.list({
        status:
          statusFilter === "all"
            ? undefined
            : (statusFilter as SubscriptionStatus),
        page: 1,
        limit: 50,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (data: { subscriptionId: string; adminNotes?: string }) =>
      client.adminSubscription.approve(data),
    onSuccess: () => {
      toast.success("Subscription approved!");
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setActionDialog(null);
      setAdminNotes("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { subscriptionId: string; adminNotes: string }) =>
      client.adminSubscription.reject(data),
    onSuccess: () => {
      toast.success("Subscription rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setActionDialog(null);
      setAdminNotes("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const extendMutation = useMutation({
    mutationFn: (data: { subscriptionId: string; days: number }) =>
      client.adminSubscription.extendTrial(data),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setActionDialog(null);
      setExtendDays(7);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const subscriptions = data?.subscriptions || [];
  const pendingCount = subscriptions.filter(
    (s) => s.status === "pending_approval",
  ).length;
  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const trialCount = subscriptions.filter((s) => s.status === "trial").length;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Subscriptions
        </h1>
        <p className="text-muted-foreground">
          Manage shop owner subscriptions and payment approvals.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {pendingCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Trial</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {trialCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Shop</TableHead>
              <TableHead className="font-semibold">Owner</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Plan</TableHead>
              <TableHead className="font-semibold">Cycle</TableHead>
              <TableHead className="font-semibold">Ends</TableHead>
              <TableHead className="font-semibold w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-6 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : subscriptions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No subscriptions found.
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((sub) => {
                const endDate =
                  sub.status === "trial"
                    ? sub.trialEnd
                    : sub.currentPeriodEnd;

                return (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.user?.shopName || "—"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{sub.user?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.user?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          STATUS_STYLES[sub.status as SubscriptionStatus] || ""
                        }
                      >
                        {STATUS_LABELS[sub.status as SubscriptionStatus] ||
                          sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sub.plan?.name || (sub.status === "trial" ? "Trial" : "—")}
                    </TableCell>
                    <TableCell className="capitalize">
                      {sub.billingCycle || "—"}
                    </TableCell>
                    <TableCell>
                      {endDate
                        ? new Date(endDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {sub.paymentProof && (
                            <DropdownMenuItem
                              onClick={() =>
                                setActionDialog({
                                  type: "view",
                                  subscriptionId: sub.id,
                                  shopName: sub.user?.shopName || "Shop",
                                  paymentProof: sub.paymentProof || "",
                                })
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Payment
                            </DropdownMenuItem>
                          )}
                          {sub.status === "pending_approval" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  setActionDialog({
                                    type: "approve",
                                    subscriptionId: sub.id,
                                    shopName: sub.user?.shopName || "Shop",
                                  })
                                }
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setActionDialog({
                                    type: "reject",
                                    subscriptionId: sub.id,
                                    shopName: sub.user?.shopName || "Shop",
                                  })
                                }
                              >
                                <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {(sub.status === "trial" ||
                            sub.status === "expired") && (
                            <DropdownMenuItem
                              onClick={() =>
                                setActionDialog({
                                  type: "extend",
                                  subscriptionId: sub.id,
                                  shopName: sub.user?.shopName || "Shop",
                                })
                              }
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Extend Trial
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Action Dialogs */}
      <Dialog
        open={!!actionDialog}
        onOpenChange={() => {
          setActionDialog(null);
          setAdminNotes("");
          setExtendDays(7);
        }}
      >
        <DialogContent>
          {actionDialog?.type === "view" && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Proof — {actionDialog.shopName}</DialogTitle>
                <DialogDescription>
                  Review the payment receipt submitted by the shop owner.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm break-all">{actionDialog.paymentProof}</p>
              </div>
              {actionDialog.paymentProof?.startsWith("http") && (
                <a
                  href={actionDialog.paymentProof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  Open in new tab
                </a>
              )}
            </>
          )}

          {actionDialog?.type === "approve" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Approve Subscription — {actionDialog.shopName}
                </DialogTitle>
                <DialogDescription>
                  This will activate the subscription and set the billing period.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Admin notes (optional)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setActionDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    approveMutation.mutate({
                      subscriptionId: actionDialog.subscriptionId,
                      adminNotes: adminNotes || undefined,
                    })
                  }
                  disabled={approveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {approveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}

          {actionDialog?.type === "reject" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Reject Subscription — {actionDialog.shopName}
                </DialogTitle>
                <DialogDescription>
                  The shop owner will need to re-submit payment.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Reason for rejection (required)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setActionDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    rejectMutation.mutate({
                      subscriptionId: actionDialog.subscriptionId,
                      adminNotes,
                    })
                  }
                  disabled={rejectMutation.isPending || !adminNotes.trim()}
                >
                  {rejectMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Reject
                </Button>
              </DialogFooter>
            </>
          )}

          {actionDialog?.type === "extend" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Extend Trial — {actionDialog.shopName}
                </DialogTitle>
                <DialogDescription>
                  Add more days to the trial period.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setActionDialog(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    extendMutation.mutate({
                      subscriptionId: actionDialog.subscriptionId,
                      days: extendDays,
                    })
                  }
                  disabled={extendMutation.isPending}
                >
                  {extendMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Extend by {extendDays} days
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
