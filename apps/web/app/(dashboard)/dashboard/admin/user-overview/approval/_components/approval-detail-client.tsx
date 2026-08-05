"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminReviewSection,
  APPLICATION_STATUS_CONFIG,
  ApplicationReviewHero,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_BASE } from "@/lib/routes";
import { client, orpc } from "@/utils/orpc";

export type ApprovalType = "seller" | "warehouse";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: "Retail Shop",
  restaurant: "Restaurant",
  warehouse: "Warehouse",
};

const PLAN_LABELS: Record<string, string> = {
  free_trial: "Free Trial (14 days)",
  starter: "Starter — ৳999/mo",
  growth: "Growth — ৳2,499/mo",
};

const APPROVAL_LIST_URL = `${ADMIN_BASE}/user-overview/approval`;

export function ApprovalDetailClient({
  type,
  applicationId,
}: {
  type: ApprovalType;
  applicationId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isWarehouse = type === "warehouse";

  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [verifyKycOpen, setVerifyKycOpen] = useState(false);
  const [verifyKycNotes, setVerifyKycNotes] = useState("");

  // Both queries are declared unconditionally to keep hook order stable; only
  // the one matching the route's type is enabled.
  const sellerQuery = useQuery({
    ...orpc.sellerApplication.getById.queryOptions({
      input: { applicationId },
    }),
    enabled: !isWarehouse,
  });

  const warehouseQuery = useQuery({
    ...orpc.warehouseApplication.getById.queryOptions({
      input: { applicationId },
    }),
    enabled: isWarehouse,
  });

  const {
    data: application,
    isLoading,
    isError,
    error,
  } = isWarehouse ? warehouseQuery : sellerQuery;

  const approveMutation = useMutation({
    mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
      isWarehouse
        ? client.warehouseApplication.approve(params)
        : client.sellerApplication.approve(params),
    onSuccess: () => {
      toast.success(
        isWarehouse
          ? "Application approved — user upgraded to warehouse operator"
          : "Application approved — user upgraded to shop owner",
      );
      queryClient.invalidateQueries();
      setActionType(null);
      setAdminNotes("");
    },
    onError: (err) => toast.error(err.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
      isWarehouse
        ? client.warehouseApplication.reject(params)
        : client.sellerApplication.reject(params),
    onSuccess: () => {
      toast.success("Application rejected");
      queryClient.invalidateQueries();
      setActionType(null);
      setAdminNotes("");
    },
    onError: (err) => toast.error(err.message || "Failed to reject"),
  });

  const verifyKycMutation = useMutation({
    mutationFn: (params: { userId: string; adminNotes?: string }) =>
      client.adminUserManagement.verify(params),
    onSuccess: () => {
      toast.success("KYC verified");
      queryClient.invalidateQueries();
      setVerifyKycOpen(false);
      setVerifyKycNotes("");
    },
    onError: (err) => toast.error(err.message || "Failed to verify KYC"),
  });

  const handleConfirmAction = () => {
    if (!actionType) return;
    const payload = { applicationId, adminNotes: adminNotes || undefined };
    if (actionType === "approve") {
      approveMutation.mutate(payload);
    } else {
      rejectMutation.mutate(payload);
    }
  };

  const isActionPending = approveMutation.isPending || rejectMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-gray-200 border-t-[#003178]" />
          <p className="text-sm text-gray-400">Loading application...</p>
        </div>
      </div>
    );
  }

  if (isError || !application) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <span className="material-symbols-outlined text-3xl text-gray-300">
            search_off
          </span>
        </div>
        <p className="text-gray-500">
          {isError
            ? `Error: ${error?.message || "Failed to load application"}`
            : "Application not found"}
        </p>
        <Link
          href={APPROVAL_LIST_URL}
          className="flex items-center gap-2 text-sm font-semibold text-[#003178] hover:underline"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Approval
        </Link>
      </div>
    );
  }

  // Seller and warehouse applications share every field used below except the
  // business name/address, which are named per table.
  const record = application as unknown as Record<string, unknown>;
  const businessName = (
    isWarehouse ? record.warehouseName : record.shopName
  ) as string;
  const businessAddress = (
    isWarehouse ? record.warehouseAddress : record.shopAddress
  ) as string;
  const businessType = record.businessType as string | undefined;
  const selectedPlan = record.selectedPlan as string | undefined;
  const reviewedAt = record.reviewedAt as string | Date | null;
  const existingNotes = record.adminNotes as string | null;

  const status = application.status as keyof typeof APPLICATION_STATUS_CONFIG;
  const config = APPLICATION_STATUS_CONFIG[status];
  const isPending = application.status === "pending";
  const kycStatus =
    (record.kycStatus as
      | "verified"
      | "pending"
      | "failed"
      | "unverified"
      | undefined) ?? "unverified";
  const canVerifyKyc = kycStatus !== "verified";
  const detail = toApplicationDetail(record, businessAddress);

  const sellingModeBadge =
    !isWarehouse && businessType === "retail" ? (
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Selling Mode</span>
        <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
          B2C Enabled
        </span>
      </div>
    ) : !isWarehouse && businessType === "restaurant" ? (
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Selling Mode</span>
        <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
          Buyer Only
        </span>
      </div>
    ) : null;

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
          onClick={() => router.push(APPROVAL_LIST_URL)}
          className="mb-5 flex items-center gap-1.5 px-0 text-sm text-gray-500 hover:bg-transparent hover:text-[#003178]"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          All Requests
        </Button>

        <ApplicationReviewHero
          data={detail}
          pageTitle={businessName}
          createdAt={application.createdAt}
          status={status}
          isPending={isPending}
          kycStatus={kycStatus}
          canVerifyKyc={canVerifyKyc}
          isVerifyingKyc={verifyKycMutation.isPending}
          onApprove={() => setActionType("approve")}
          onReject={() => setActionType("reject")}
          onVerifyKyc={() => setVerifyKycOpen(true)}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue="basic">
              <TabsList className="mb-4">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="social">Social</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-5">
                <BusinessInformationSection
                  data={detail}
                  businessName={businessName}
                  businessNameLabel={
                    isWarehouse ? "Warehouse Name" : "Shop Name"
                  }
                  businessType={
                    !isWarehouse && businessType
                      ? BUSINESS_TYPE_LABELS[businessType] || businessType
                      : undefined
                  }
                  businessTypeLabel={!isWarehouse ? "Platform Type" : undefined}
                  sellingModeBadge={sellingModeBadge}
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

              <TabsContent value="review" className="space-y-5">
                <AdminReviewSection
                  isPending={isPending}
                  adminNotes={adminNotes}
                  onAdminNotesChange={setAdminNotes}
                  existingNotes={existingNotes}
                />
                {isPending && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setActionType("approve")}
                      disabled={isActionPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve Application
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActionType("reject")}
                      disabled={isActionPending}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Reject Application
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-5 self-start lg:sticky lg:top-6">
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
                <div className="rounded-lg bg-[#003178]/5 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-[#003178]">
                    {PLAN_LABELS[selectedPlan] || selectedPlan}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-100 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-lg text-[#003178]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  timeline
                </span>
                <h3 className="text-sm font-bold text-gray-900">Timeline</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                      <span
                        className="material-symbols-outlined text-xs text-blue-600"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    </div>
                    {(reviewedAt || isPending) && (
                      <div className="mt-1 h-4 w-0.5 bg-gray-200" />
                    )}
                  </div>
                  <div className="-mt-0.5">
                    <p className="text-xs font-semibold text-gray-900">
                      Submitted
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {format(new Date(application.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>

                {reviewedAt ? (
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        status === "approved" ? "bg-green-100" : "bg-red-100"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-xs ${config.color}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {status === "approved" ? "check" : "close"}
                      </span>
                    </div>
                    <div className="-mt-0.5">
                      <p className="text-xs font-semibold capitalize text-gray-900">
                        {application.status}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {format(new Date(reviewedAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                    </div>
                    <div className="-mt-0.5">
                      <p className="text-xs font-semibold text-gray-900">
                        Awaiting Review
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Pending decision
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={!!actionType}
        onOpenChange={(open) => {
          if (!open) setActionType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Application
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `Approving will upgrade "${businessName}" to a ${
                    isWarehouse ? "warehouse operator" : "shop owner"
                  } account.`
                : `Rejecting will deny "${businessName}'s" application.`}
              {actionType === "approve" &&
                !isWarehouse &&
                businessType === "retail" && (
                  <span className="mt-1 block text-green-600">
                    Retail type — will be seller-enabled (can sell B2C)
                  </span>
                )}
              {actionType === "approve" &&
                !isWarehouse &&
                businessType === "restaurant" && (
                  <span className="mt-1 block text-blue-600">
                    Restaurant type — buyer-only (wholesale purchasing)
                  </span>
                )}
            </DialogDescription>
          </DialogHeader>
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
              onClick={() => setActionType(null)}
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

      <KycVerifyDialog
        open={verifyKycOpen}
        onOpenChange={setVerifyKycOpen}
        subjectName={businessName}
        notes={verifyKycNotes}
        onNotesChange={setVerifyKycNotes}
        isPending={verifyKycMutation.isPending}
        onConfirm={() =>
          verifyKycMutation.mutate({
            userId: application.userId,
            adminNotes: verifyKycNotes || undefined,
          })
        }
      />
    </section>
  );
}
