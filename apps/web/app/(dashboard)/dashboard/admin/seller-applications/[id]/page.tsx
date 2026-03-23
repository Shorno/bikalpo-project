"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const LocationViewMap = dynamic(
  () =>
    import("@/components/features/onboarding/location-view-map").then(
      (mod) => mod.LocationViewMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[250px] bg-gray-100 rounded-xl flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading map...</span>
      </div>
    ),
  }
);

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

const statusConfig = {
  pending: {
    label: "Pending Review",
    icon: "schedule",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    icon: "check_circle",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    dot: "bg-green-500",
  },
  rejected: {
    label: "Rejected",
    icon: "cancel",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
};

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

/* ── Reusable components matching the onboarding design ── */

function DetailSection({
  title,
  icon,
  children,
  badge,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50/80">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[#003178] text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
          <h3 className="font-bold text-sm text-gray-900">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="px-5 py-4 space-y-2.5">{children}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

/* ── Main page ── */

export default function SellerApplicationDetailPage() {
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
    ...orpc.sellerApplication.getById.queryOptions({
      input: { applicationId },
    }),
  });

  const approveMutation = useMutation({
    mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
      client.sellerApplication.approve(params),
    onSuccess: () => {
      toast.success("Application approved — user upgraded to shop owner");
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
      client.sellerApplication.reject(params),
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

  /* ── Loading & Error states ── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-[#003178] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading application...</p>
        </div>
      </div>
    );
  }

  if (isError || !application) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
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
          href="/dashboard/admin/seller-applications"
          className="flex items-center gap-2 text-sm font-semibold text-[#003178] hover:underline"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Applications
        </Link>
      </div>
    );
  }

  const status = application.status as keyof typeof statusConfig;
  const config = statusConfig[status];
  const documents = (application.documents as string[]) || [];
  const isPending = application.status === "pending";
  const user = application as any;

  return (
    <section className="py-6 sm:py-8 px-4 sm:px-6">
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

      <div className="max-w-6xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Back link */}
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/admin/seller-applications")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#003178] hover:bg-transparent mb-5 px-0"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          All Applications
        </Button>

        {/* ─── Header Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                style={{ background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)" }}
              >
                {application.shopName?.[0]?.toUpperCase() || "S"}
              </div>
              <div>
                <h1
                  className="text-lg sm:text-xl font-extrabold text-gray-900"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  {application.shopName}
                </h1>
                <p className="text-xs text-gray-400">
                  by {application.ownerName} • {format(new Date(application.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${config.bg} ${config.color} ${config.border} border`}
              >
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {config.icon}
                </span>
                {config.label}
              </div>
            </div>
          </div>

          {/* Pending Actions */}
          {isPending && (
            <div className="flex gap-3 mt-5 pt-5 border-t border-gray-100">
              <Button
                onClick={() => setActionType("approve")}
                className="flex-1 h-auto py-2.5 rounded-lg text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setActionType("reject")}
                className="h-auto px-5 py-2.5 rounded-lg border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 hover:text-red-700 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">cancel</span>
                Reject
              </Button>
            </div>
          )}
        </div>

        {/* ─── Two-Column Grid ─── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ═══ LEFT COLUMN (2/3) ═══ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Quick Stats Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <span
                  className="material-symbols-outlined text-2xl text-[#003178] mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {application.businessType === "retail" ? "storefront" : application.businessType === "restaurant" ? "restaurant" : "warehouse"}
                </span>
                <p className="text-xs text-gray-400 mb-0.5">Type</p>
                <p className="text-sm font-bold text-gray-900 capitalize">
                  {BUSINESS_TYPE_LABELS[application.businessType] || application.businessType}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <span
                  className="material-symbols-outlined text-2xl text-[#003178] mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  category
                </span>
                <p className="text-xs text-gray-400 mb-0.5">Category</p>
                <p className="text-sm font-bold text-gray-900">
                  {(application as any).businessCategory || "—"}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <span
                  className="material-symbols-outlined text-2xl text-[#003178] mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  schedule
                </span>
                <p className="text-xs text-gray-400 mb-0.5">Experience</p>
                <p className="text-sm font-bold text-gray-900">
                  {(application as any).yearsInBusiness || "—"}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <span
                  className="material-symbols-outlined text-2xl text-[#003178] mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  payments
                </span>
                <p className="text-xs text-gray-400 mb-0.5">Revenue</p>
                <p className="text-sm font-bold text-gray-900">
                  {(application as any).monthlyRevenue || "—"}
                </p>
              </div>
            </div>

            {/* Business Details */}
            <DetailSection title="Business Details" icon="storefront">
              <DetailField label="Shop Name" value={application.shopName} />
              <DetailField
                label="Business Type"
                value={BUSINESS_TYPE_LABELS[application.businessType] || application.businessType}
              />
              {application.businessType === "retail" && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Selling Mode</span>
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-100">
                    B2C Enabled
                  </span>
                </div>
              )}
              {application.businessType === "restaurant" && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Selling Mode</span>
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                    Buyer Only
                  </span>
                </div>
              )}
              <DetailField
                label="Trade License"
                value={application.tradeLicenseNumber || "Not provided"}
              />
            </DetailSection>

            {/* Location */}
            <DetailSection title="Location" icon="location_on">
              {/* Map */}
              {(application as any).latitude && (application as any).longitude && (
                <div className="rounded-xl overflow-hidden border border-gray-200 -mx-1 mb-2">
                  <LocationViewMap
                    latitude={parseFloat((application as any).latitude)}
                    longitude={parseFloat((application as any).longitude)}
                  />
                </div>
              )}
              <DetailField label="Address" value={application.shopAddress} />
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <DetailField label="Area" value={(application as any).area} />
                <DetailField label="District" value={(application as any).district} />
                <DetailField label="Division" value={(application as any).division} />
                <DetailField label="Post Code" value={(application as any).postCode} />
              </div>
            </DetailSection>

            {/* Documents */}
            <DetailSection
              title="Documents"
              icon="description"
              badge={
                documents.length > 0 ? (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#003178]/10 text-[#003178] text-xs font-semibold">
                    {documents.length} file{documents.length > 1 ? "s" : ""}
                  </span>
                ) : undefined
              }
            >
              {documents.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="material-symbols-outlined text-3xl text-gray-300 mb-2">
                    folder_off
                  </span>
                  <p className="text-sm text-gray-400">No documents uploaded</p>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                  {documents.map((doc, index) => (
                    <a
                      key={index}
                      href={doc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-xl border border-gray-200 hover:border-[#003178]/30 transition-all"
                    >
                      <div className="relative aspect-[4/3]">
                        <Image
                          src={doc}
                          alt={`Document ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">
                            open_in_new
                          </span>
                        </div>
                      </div>
                      <div className="px-3 py-2 bg-gray-50/80">
                        <p className="text-xs text-gray-500 font-medium">
                          Document {index + 1}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </DetailSection>
          </div>

          {/* ═══ RIGHT SIDEBAR (1/3) ═══ */}
          <div className="space-y-5 lg:sticky lg:top-6 self-start">

            {/* Applicant Card */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-br from-[#003178] to-[#0d47a1] px-5 py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                  {application.ownerName?.[0]?.toUpperCase() || "?"}
                </div>
                <p className="text-white font-bold text-sm">{application.ownerName}</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className="material-symbols-outlined text-gray-400 text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    call
                  </span>
                  <span className="text-gray-700 font-medium">{application.phoneNumber}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className="material-symbols-outlined text-gray-400 text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    calendar_today
                  </span>
                  <span className="text-gray-700">
                    Applied {format(new Date(application.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>

            {/* Plan */}
            {(application as any).selectedPlan && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-[#003178] text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    workspace_premium
                  </span>
                  <h3 className="font-bold text-sm text-gray-900">Selected Plan</h3>
                </div>
                <div className="bg-[#003178]/5 rounded-lg px-4 py-3 text-center">
                  <p className="text-sm font-bold text-[#003178]">
                    {PLAN_LABELS[(application as any).selectedPlan] || (application as any).selectedPlan}
                  </p>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-[#003178] text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  timeline
                </span>
                <h3 className="font-bold text-sm text-gray-900">Timeline</h3>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-blue-600 text-xs"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check
                      </span>
                    </div>
                    {(application.reviewedAt || isPending) && (
                      <div className="w-0.5 h-4 bg-gray-200 mt-1" />
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
                  <div className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${
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
                    </div>
                    <div className="-mt-0.5">
                      <p className="text-xs font-semibold text-gray-900 capitalize">
                        {application.status}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {format(new Date(application.reviewedAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    </div>
                    <div className="-mt-0.5">
                      <p className="text-xs font-semibold text-gray-900">Awaiting Review</p>
                      <p className="text-[10px] text-gray-400">Pending decision</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Notes */}
            {application.reviewedAt && application.adminNotes && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-[#003178] text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    sticky_note_2
                  </span>
                  <h3 className="font-bold text-sm text-gray-900">Admin Notes</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">
                  {application.adminNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Approve / Reject Dialog ─── */}
      <Dialog
        open={!!actionType}
        onOpenChange={() => {
          setActionType(null);
          setAdminNotes("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Application
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `Approving will upgrade "${application.shopName}" to a shop owner account.`
                : `Rejecting will deny "${application.shopName}'s" seller application.`}
              {actionType === "approve" &&
                application.businessType === "retail" && (
                  <span className="mt-1 block text-green-600">
                    ✓ Retail type — will be seller-enabled (can sell B2C)
                  </span>
                )}
              {actionType === "approve" &&
                application.businessType === "restaurant" && (
                  <span className="mt-1 block text-blue-600">
                    ℹ Restaurant type — buyer-only (wholesale purchasing)
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
              onClick={() => {
                setActionType(null);
                setAdminNotes("");
              }}
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
    </section>
  );
}
