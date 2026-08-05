"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminReviewSection,
  BankAndTaxSection,
  BusinessInformationSection,
  BusinessLocationSection,
  LabeledDocumentsSection,
  PersonalLocationSection,
  ReferralSection,
  SocialProfilesSection,
  toApplicationDetail,
} from "@/components/features/admin/application-detail-sections";
import { KycVerifyDialog } from "@/components/features/admin/kyc-verify-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_BASE } from "@/lib/routes";
import { client, orpc } from "@/utils/orpc";
import { UserProfileHero } from "./user-profile-hero";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: "Retail Shop",
  restaurant: "Restaurant",
  warehouse: "Warehouse",
};

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Desktop";
}

interface UserDetailClientProps {
  userId: string;
}

export function UserDetailClient({ userId }: UserDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    ...orpc.adminUserManagement.getById.queryOptions({
      input: { userId },
    }),
  });

  const suspendMutation = useMutation({
    mutationFn: (params: { userId: string; reason?: string }) =>
      client.adminUserManagement.suspend(params),
    onSuccess: () => {
      toast.success("User suspended");
      queryClient.invalidateQueries();
      setSuspendDialogOpen(false);
      setSuspendReason("");
    },
    onError: (err) => toast.error(err.message || "Failed to suspend"),
  });

  const activateMutation = useMutation({
    mutationFn: (params: { userId: string }) =>
      client.adminUserManagement.activate(params),
    onSuccess: () => {
      toast.success("User activated");
      queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message || "Failed to activate"),
  });

  const updateMutation = useMutation({
    mutationFn: (params: Record<string, string>) =>
      client.adminUserManagement.updateInfo({ userId, ...params }),
    onSuccess: () => {
      toast.success("User info updated");
      queryClient.invalidateQueries();
      setEditDialogOpen(false);
    },
    onError: (err) => toast.error(err.message || "Failed to update"),
  });

  const verifyMutation = useMutation({
    mutationFn: (params: { userId: string; adminNotes?: string }) =>
      client.adminUserManagement.verify(params),
    onSuccess: () => {
      toast.success("KYC verified");
      queryClient.invalidateQueries();
      setVerifyDialogOpen(false);
      setVerifyNotes("");
    },
    onError: (err) => toast.error(err.message || "Failed to verify KYC"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-gray-200 border-t-[#003178]" />
          <p className="text-sm text-gray-400">Loading user...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <span className="material-symbols-outlined text-3xl text-gray-300">
            search_off
          </span>
        </div>
        <p className="text-gray-500">
          {isError
            ? `Error: ${error?.message || "Failed to load user"}`
            : "User not found"}
        </p>
        <Link
          href={`${ADMIN_BASE}/user-overview/wholesalers`}
          className="flex items-center gap-2 text-sm font-semibold text-[#003178] hover:underline"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Users
        </Link>
      </div>
    );
  }

  const {
    user: userData,
    loginActivity,
    application,
    applicationId,
    applicationStatus,
    accountMeta,
  } = data;
  const isWarehouse = userData.role === "warehouse";
  const isSuspended = userData.banned === true;
  const isActionPending =
    suspendMutation.isPending || activateMutation.isPending;
  const canVerify =
    accountMeta.canVerifyKyc ??
    (accountMeta.kycStatus !== "verified" &&
      (userData.role === "shop_owner" || userData.role === "warehouse"));

  const backUrl = `${ADMIN_BASE}/user-overview/${isWarehouse ? "wholesalers" : "retailers"}`;
  const backLabel = isWarehouse ? "All Wholesalers" : "All Retailers";
  const businessName = isWarehouse
    ? userData.warehouseName || userData.name
    : userData.shopName || userData.name;
  const businessAddress = isWarehouse
    ? userData.warehouseAddress || ""
    : userData.shopAddress || "";

  const detail = application
    ? toApplicationDetail(application, businessAddress)
    : toApplicationDetail(
        {
          ownerName: userData.ownerName || userData.name,
          phoneNumber: userData.phoneNumber || "",
          email: userData.email,
        },
        businessAddress,
      );

  const appRecord = application as Record<string, unknown> | null;
  const territory = appRecord?.area as string | undefined;
  const adminNotes = (appRecord?.adminNotes as string | null) ?? "";
  const selectedPlan = appRecord?.selectedPlan as string | undefined;
  const applicationHref = applicationId
    ? `${ADMIN_BASE}/user-overview/approval/${isWarehouse ? "warehouse" : "seller"}/${applicationId}`
    : null;

  const sellingModeBadge =
    !isWarehouse && userData.businessType === "retail" ? (
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Selling Mode</span>
        <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
          B2C Enabled
        </span>
      </div>
    ) : !isWarehouse && userData.businessType === "restaurant" ? (
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Selling Mode</span>
        <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
          Buyer Only
        </span>
      </div>
    ) : null;

  const applicationStatusLabel = applicationStatus
    ? APPLICATION_STATUS_LABELS[applicationStatus.status] ||
      applicationStatus.status
    : undefined;

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <div
        className="mx-auto max-w-6xl"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <Button
          variant="ghost"
          onClick={() => router.push(backUrl)}
          className="mb-5 flex items-center gap-1.5 px-0 text-sm text-gray-500 hover:bg-transparent hover:text-[#003178]"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {backLabel}
        </Button>

        <UserProfileHero
          data={detail}
          pageTitle={businessName}
          profileLabel={isWarehouse ? "Wholesaler Profile" : "Seller Profile"}
          businessName={businessName}
          territory={territory}
          displayId={accountMeta.displayId}
          accountStatus={accountMeta.accountStatus}
          kycStatus={accountMeta.kycStatus}
          profileCompletion={accountMeta.profileCompletion}
          joinedAt={userData.createdAt}
          lastActiveAt={loginActivity?.lastLoginAt}
          isSuspended={isSuspended}
          isActionPending={isActionPending}
          canVerify={canVerify}
          isVerifying={verifyMutation.isPending}
          onEdit={() => setEditDialogOpen(true)}
          onSuspend={() => setSuspendDialogOpen(true)}
          onActivate={() => activateMutation.mutate({ userId })}
          onVerify={() => setVerifyDialogOpen(true)}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {application ? (
              <Tabs defaultValue="basic">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="social">Social</TabsTrigger>
                  <TabsTrigger value="notes">Admin Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-5">
                  <BusinessInformationSection
                    data={detail}
                    businessName={businessName}
                    businessNameLabel={
                      isWarehouse ? "Warehouse Name" : "Shop Name"
                    }
                    businessType={
                      !isWarehouse
                        ? BUSINESS_TYPE_LABELS[userData.businessType || ""] ||
                          userData.businessType
                        : undefined
                    }
                    businessTypeLabel={
                      !isWarehouse ? "Platform Type" : undefined
                    }
                    sellingModeBadge={sellingModeBadge}
                    applicantStatusLabel={applicationStatusLabel}
                  />
                  <PersonalLocationSection data={detail} />
                  <BusinessLocationSection data={detail} />
                  <BankAndTaxSection data={detail} />
                  <ReferralSection data={detail} />
                </TabsContent>

                <TabsContent value="documents" className="space-y-5">
                  <LabeledDocumentsSection data={detail} />
                </TabsContent>

                <TabsContent value="social" className="space-y-5">
                  <SocialProfilesSection data={detail} />
                </TabsContent>

                <TabsContent value="notes" className="space-y-5">
                  <AdminReviewSection
                    isPending={false}
                    adminNotes=""
                    onAdminNotesChange={() => {}}
                    existingNotes={adminNotes}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">
                  No linked application record. Basic account data is shown in
                  the profile header above.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5 self-start lg:sticky lg:top-6">
            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-lg text-[#003178]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  login
                </span>
                <h3 className="text-sm font-bold text-gray-900">
                  Login Activity
                </h3>
              </div>
              {loginActivity ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Last Active</span>
                    <span className="text-right font-medium text-gray-900">
                      {formatDistanceToNow(
                        new Date(loginActivity.lastLoginAt),
                        {
                          addSuffix: true,
                        },
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Device</span>
                    <span className="font-medium text-gray-900">
                      {parseUserAgent(loginActivity.userAgent)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">IP Address</span>
                    <span className="font-mono text-xs text-gray-900">
                      {loginActivity.ipAddress || "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  No login activity recorded
                </p>
              )}
            </div>

            {applicationHref && (
              <Button variant="outline" className="w-full text-sm" asChild>
                <Link href={applicationHref}>View Application Record</Link>
              </Button>
            )}

            {selectedPlan && (
              <div className="rounded-xl border border-gray-100 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-lg text-[#003178]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    workspace_premium
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    Selected Plan
                  </h3>
                </div>
                <p className="text-sm font-medium text-[#003178]">
                  {selectedPlan}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-lg text-[#003178]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  timeline
                </span>
                <h3 className="text-sm font-bold text-gray-900">Timeline</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Registered</span>
                  <span className="text-right text-gray-900">
                    {format(new Date(userData.createdAt), "d MMM yyyy")}
                  </span>
                </div>
                {applicationStatus?.status === "approved" &&
                  applicationStatus.reviewedAt && (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">
                        Application Approved
                      </span>
                      <span className="text-right text-gray-900">
                        {format(
                          new Date(applicationStatus.reviewedAt),
                          "d MMM yyyy",
                        )}
                      </span>
                    </div>
                  )}
                {accountMeta.kycReviewedAt && (
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">KYC Verified</span>
                    <span className="text-right text-gray-900">
                      {format(
                        new Date(accountMeta.kycReviewedAt),
                        "d MMM yyyy",
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <KycVerifyDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        subjectName={businessName}
        notes={verifyNotes}
        onNotesChange={setVerifyNotes}
        isPending={verifyMutation.isPending}
        onConfirm={() =>
          verifyMutation.mutate({
            userId,
            adminNotes: verifyNotes || undefined,
          })
        }
      />

      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              This will immediately block <strong>{businessName}</strong> from
              accessing the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (recommended)</Label>
            <Textarea
              placeholder="Why is this user being suspended?"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendDialogOpen(false);
                setSuspendReason("");
              }}
              disabled={suspendMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                suspendMutation.mutate({
                  userId,
                  reason: suspendReason || undefined,
                })
              }
              disabled={suspendMutation.isPending}
            >
              {suspendMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={userData}
        isWarehouse={isWarehouse}
        onSave={(updates) => updateMutation.mutate(updates)}
        isPending={updateMutation.isPending}
      />
    </section>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  user: userData,
  isWarehouse,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string;
    phoneNumber: string | null;
    ownerName: string | null;
    shopName: string | null;
    shopAddress: string | null;
    warehouseName: string | null;
    warehouseAddress: string | null;
  };
  isWarehouse: boolean;
  onSave: (updates: Record<string, string>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: userData.name,
    phoneNumber: userData.phoneNumber || "",
    ownerName: userData.ownerName || "",
    shopName: userData.shopName || "",
    shopAddress: userData.shopAddress || "",
    warehouseName: userData.warehouseName || "",
    warehouseAddress: userData.warehouseAddress || "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: userData.name,
        phoneNumber: userData.phoneNumber || "",
        ownerName: userData.ownerName || "",
        shopName: userData.shopName || "",
        shopAddress: userData.shopAddress || "",
        warehouseName: userData.warehouseName || "",
        warehouseAddress: userData.warehouseAddress || "",
      });
    }
  }, [open, userData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User Info</DialogTitle>
          <DialogDescription>
            Update basic account and business details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={formData.phoneNumber}
              onChange={(e) =>
                setFormData((f) => ({ ...f, phoneNumber: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Owner Name</Label>
            <Input
              value={formData.ownerName}
              onChange={(e) =>
                setFormData((f) => ({ ...f, ownerName: e.target.value }))
              }
            />
          </div>
          {isWarehouse ? (
            <>
              <div>
                <Label>Warehouse Name</Label>
                <Input
                  value={formData.warehouseName}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      warehouseName: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Warehouse Address</Label>
                <Input
                  value={formData.warehouseAddress}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      warehouseAddress: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Shop Name</Label>
                <Input
                  value={formData.shopName}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, shopName: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Shop Address</Label>
                <Input
                  value={formData.shopAddress}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      shopAddress: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(formData)} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
