"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Building2,
  Check,
  Clock,
  Eye,
  FileText,
  Loader2,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";
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

type Application = {
  id: string;
  userId: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  businessType: string;
  shopAddress: string;
  tradeLicenseNumber: string | null;
  status: string;
  adminNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    role: string;
  };
};

const statusBadge = {
  pending: {
    variant: "outline" as const,
    className: "text-yellow-600 border-yellow-600",
  },
  approved: { variant: "default" as const, className: "bg-green-600" },
  rejected: { variant: "destructive" as const, className: "" },
};

export function SellerApplicationsClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );

  // Fetch applications by status
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    ...orpc.sellerApplication.list.queryOptions({
      input: { status: "pending", page: 1, limit: 50 },
    }),
  });

  const { data: approvedData, isLoading: approvedLoading } = useQuery({
    ...orpc.sellerApplication.list.queryOptions({
      input: { status: "approved", page: 1, limit: 50 },
    }),
  });

  const { data: rejectedData, isLoading: rejectedLoading } = useQuery({
    ...orpc.sellerApplication.list.queryOptions({
      input: { status: "rejected", page: 1, limit: 50 },
    }),
  });

  const pendingApps = (pendingData?.applications ?? []) as Application[];
  const approvedApps = (approvedData?.applications ?? []) as Application[];
  const rejectedApps = (rejectedData?.applications ?? []) as Application[];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
      client.sellerApplication.approve(params),
    onSuccess: () => {
      toast.success("Application approved — user upgraded to shop owner");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
      client.sellerApplication.reject(params),
    onSuccess: () => {
      toast.success("Application rejected");
      queryClient.invalidateQueries();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject");
    },
  });

  const openDialog = (app: Application, action: "approve" | "reject") => {
    setSelectedApp(app);
    setActionType(action);
    setAdminNotes("");
  };

  const closeDialog = () => {
    setSelectedApp(null);
    setActionType(null);
    setAdminNotes("");
  };

  const handleConfirmAction = () => {
    if (!selectedApp || !actionType) return;

    if (actionType === "approve") {
      approveMutation.mutate({
        applicationId: selectedApp.id,
        adminNotes: adminNotes || undefined,
      });
    } else {
      rejectMutation.mutate({
        applicationId: selectedApp.id,
        adminNotes: adminNotes || undefined,
      });
    }
  };

  const isActionPending = approveMutation.isPending || rejectMutation.isPending;

  const renderApplicationRow = (app: Application, showActions: boolean) => (
    <TableRow key={app.id}>
      <TableCell>
        <div>
          <p className="font-medium">{app.shopName}</p>
          <p className="text-xs text-muted-foreground">{app.ownerName}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          {app.businessType === "retail" ? (
            <Store className="size-3.5 text-blue-500" />
          ) : (
            <Building2 className="size-3.5 text-orange-500" />
          )}
          <span className="capitalize text-sm">{app.businessType}</span>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm font-medium">{app.phoneNumber}</p>
      </TableCell>
      <TableCell className="max-w-[200px]">
        <p className="truncate text-sm" title={app.shopAddress}>
          {app.shopAddress}
        </p>
      </TableCell>
      <TableCell>{format(new Date(app.createdAt), "MMM d, yyyy")}</TableCell>
      <TableCell>
        <Badge
          variant={
            statusBadge[app.status as keyof typeof statusBadge]?.variant ||
            "outline"
          }
          className={`capitalize ${statusBadge[app.status as keyof typeof statusBadge]?.className}`}
        >
          {app.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/dashboard/admin/seller-applications/${app.id}`}>
              <Eye className="size-4 mr-1" />
              View
            </Link>
          </Button>
          {showActions && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => openDialog(app, "approve")}
                disabled={isActionPending}
              >
                <Check className="size-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => openDialog(app, "reject")}
                disabled={isActionPending}
              >
                <X className="size-4 mr-1" />
                Reject
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  const renderTable = (
    apps: Application[],
    loading: boolean,
    showActions: boolean,
    emptyMessage: string,
  ) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (apps.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
          <FileText className="size-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop / Owner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => renderApplicationRow(app, showActions))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Seller Applications
          </h1>
          <p className="text-muted-foreground">
            Review and manage business seller applications
          </p>
        </div>
        {pendingApps.length > 0 && (
          <Badge
            variant="secondary"
            className="text-yellow-600 border-yellow-600"
          >
            <Clock className="mr-1 size-3" />
            {pendingApps.length} pending
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="size-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                pendingApps.length
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Check className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {approvedLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                approvedApps.length
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <X className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rejectedLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                rejectedApps.length
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            <Clock className="mr-2 size-4" />
            Pending
            {pendingApps.length > 0 && (
              <span className="ml-2 rounded-full bg-yellow-500 px-2 py-0.5 text-xs text-white">
                {pendingApps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            <Check className="mr-2 size-4" />
            Approved ({approvedApps.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            <X className="mr-2 size-4" />
            Rejected ({rejectedApps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {renderTable(
            pendingApps,
            pendingLoading,
            true,
            "No pending applications",
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          {renderTable(
            approvedApps,
            approvedLoading,
            false,
            "No approved applications yet",
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          {renderTable(
            rejectedApps,
            rejectedLoading,
            false,
            "No rejected applications",
          )}
        </TabsContent>
      </Tabs>

      {/* Approve / Reject Dialog */}
      <Dialog
        open={!!selectedApp && !!actionType}
        onOpenChange={() => closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Application
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `Approving will upgrade "${selectedApp?.shopName}" to a shop owner account.`
                : `Rejecting will deny "${selectedApp?.shopName}'s" seller application.`}
              {actionType === "approve" &&
                selectedApp?.businessType === "retail" && (
                  <span className="mt-1 block text-green-600">
                    ✓ Retail type — will be seller-enabled (can sell B2C)
                  </span>
                )}
              {actionType === "approve" &&
                selectedApp?.businessType === "restaurant" && (
                  <span className="mt-1 block text-blue-600">
                    ℹ Restaurant type — buyer-only (wholesale purchasing)
                  </span>
                )}
            </DialogDescription>
          </DialogHeader>

          {/* Application details */}
          <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Owner</span>
              <span className="font-medium">{selectedApp?.ownerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium">{selectedApp?.phoneNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Address</span>
              <span className="max-w-[200px] text-right font-medium">
                {selectedApp?.shopAddress}
              </span>
            </div>
            {selectedApp?.tradeLicenseNumber && (
              <div className="flex justify-between">
                <span className="text-gray-500">Trade License</span>
                <span className="font-medium">
                  {selectedApp.tradeLicenseNumber}
                </span>
              </div>
            )}
          </div>

          {/* Admin Notes */}
          <div className="space-y-2">
            <span className="text-sm font-medium">
              Admin Notes {actionType === "reject" && "(recommended)"}
            </span>
            <Textarea
              placeholder={
                actionType === "approve"
                  ? "Optional notes for the applicant..."
                  : "Reason for rejection..."
              }
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
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
                actionType === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {isActionPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
