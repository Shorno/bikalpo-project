"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminReviewSection,
  ApplicationReviewHero,
  APPLICATION_STATUS_CONFIG,
  BankAndTaxSection,
  BusinessInformationSection,
  BusinessLocationSection,
  LabeledDocumentsSection,
  PersonalLocationSection,
  ReferralSection,
  SocialProfilesSection,
  toApplicationDetail,
} from "@/components/features/admin/application-detail-sections";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

const PLAN_LABELS: Record<string, string> = {
  free_trial: "Free Trial (14 days)",
  starter: "Starter — ৳999/mo",
  growth: "Growth — ৳2,499/mo",
};

export default function WarehouseApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const applicationId = params.id as string;

  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const {
    data: application,
    isLoading,
    isError,
    error,
  } = useQuery({
    ...orpc.warehouseApplication.getById.queryOptions({
      input: { applicationId },
    }),
  });

  const approveMutation = useMutation({
    mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
      client.warehouseApplication.approve(params),
    onSuccess: () => {
      toast.success("Application approved — user upgraded to warehouse operator");
      queryClient.invalidateQueries();
      setActionType(null);
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
      client.warehouseApplication.reject(params),
    onSuccess: () => {
      toast.success("Application rejected");
      queryClient.invalidateQueries();
      setActionType(null);
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject");
    },
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
          href="/dashboard/admin/warehouse-applications"
          className="flex items-center gap-2 text-sm font-semibold text-[#003178] hover:underline"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Applications
        </Link>
      </div>
    );
  }

  const status = application.status as keyof typeof APPLICATION_STATUS_CONFIG;
  const config = APPLICATION_STATUS_CONFIG[status];
  const isPending = application.status === "pending";
  const detail = toApplicationDetail(
    application as Record<string, unknown>,
    application.warehouseAddress,
  );

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

      <div className="mx-auto max-w-6xl" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/admin/warehouse-applications")}
          className="mb-5 flex items-center gap-1.5 px-0 text-sm text-gray-500 hover:bg-transparent hover:text-[#003178]"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          All Applications
        </Button>

        <ApplicationReviewHero
          data={detail}
          pageTitle={application.warehouseName}
          createdAt={application.createdAt}
          status={status}
          isPending={isPending}
          onApprove={() => setActionType("approve")}
          onReject={() => setActionType("reject")}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <BusinessInformationSection
              data={detail}
              businessName={application.warehouseName}
              businessNameLabel="Warehouse Name"
            />
            <PersonalLocationSection data={detail} />
            <BusinessLocationSection data={detail} />
            <LabeledDocumentsSection data={detail} />
            <BankAndTaxSection data={detail} />
            <SocialProfilesSection data={detail} />
            <ReferralSection data={detail} />
          </div>

          <div className="space-y-5 self-start lg:sticky lg:top-6">
            {application.selectedPlan && (
              <div className="rounded-xl border border-gray-100 bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-lg text-[#003178]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    workspace_premium
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">Selected Plan</h3>
                </div>
                <div className="rounded-lg bg-[#003178]/5 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-[#003178]">
                    {PLAN_LABELS[application.selectedPlan] || application.selectedPlan}
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
                    {(application.reviewedAt || isPending) && (
                      <div className="mt-1 h-4 w-0.5 bg-gray-200" />
                    )}
                  </div>
                  <div className="-mt-0.5">
                    <p className="text-xs font-semibold text-gray-900">Submitted</p>
                    <p className="text-[10px] text-gray-400">
                      {format(new Date(application.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>

                {application.reviewedAt ? (
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
                        {format(new Date(application.reviewedAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                    </div>
                    <div className="-mt-0.5">
                      <p className="text-xs font-semibold text-gray-900">Awaiting Review</p>
                      <p className="text-[10px] text-gray-400">Pending decision</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <AdminReviewSection
              isPending={isPending}
              adminNotes={adminNotes}
              onAdminNotesChange={setAdminNotes}
              existingNotes={application.adminNotes}
            />
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
                ? `Approving will upgrade "${application.warehouseName}" to a warehouse operator account.`
                : `Rejecting will deny "${application.warehouseName}'s" warehouse application.`}
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
              {isActionPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
