"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_BASE } from "@/lib/routes";
import { client, orpc } from "@/utils/orpc";

interface UserDetailClientProps {
  userId: string;
}

/* ── Reusable components matching the seller-application design ── */

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

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Desktop";
}

/* ── Status config ── */

const statusConfig = {
  active: {
    label: "Active",
    icon: "check_circle",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  suspended: {
    label: "Suspended",
    icon: "block",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

/* ── Main component ── */

export function UserDetailClient({ userId }: UserDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch user
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    ...orpc.adminUserManagement.getById.queryOptions({
      input: { userId },
    }),
  });

  // Suspend mutation
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

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: (params: { userId: string }) =>
      client.adminUserManagement.activate(params),
    onSuccess: () => {
      toast.success("User activated");
      queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message || "Failed to activate"),
  });

  // Update mutation
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

  /* ── Loading & Error states ── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-[#003178] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading user...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
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
          href={`${ADMIN_BASE}/users/wholesalers`}
          className="flex items-center gap-2 text-sm font-semibold text-[#003178] hover:underline"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Users
        </Link>
      </div>
    );
  }

  const { user: userData, loginActivity, applicationStatus } = data;
  const isWarehouse = userData.role === "warehouse";
  const isSuspended = userData.banned === true;
  const isActionPending = suspendMutation.isPending || activateMutation.isPending;

  const accountStatus = isSuspended ? "suspended" : "active";
  const config = statusConfig[accountStatus];

  const backUrl = `${ADMIN_BASE}/users/${isWarehouse ? "wholesalers" : "retailers"}`;
  const businessName = isWarehouse
    ? userData.warehouseName || userData.name
    : userData.shopName || userData.name;

  // KYC derived from application status
  const kycLabel = applicationStatus?.status === "approved"
    ? "Verified"
    : applicationStatus?.status === "pending"
      ? "Pending Verification"
      : applicationStatus?.status === "rejected"
        ? "Rejected"
        : "Unknown";

  const kycConfig = applicationStatus?.status === "approved"
    ? { bg: "bg-green-50", color: "text-green-700", border: "border-green-100" }
    : applicationStatus?.status === "pending"
      ? { bg: "bg-amber-50", color: "text-amber-700", border: "border-amber-100" }
      : { bg: "bg-gray-50", color: "text-gray-700", border: "border-gray-100" };

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
          onClick={() => router.push(backUrl)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#003178] hover:bg-transparent mb-5 px-0"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {isWarehouse ? "All Wholesalers" : "All Retailers"}
        </Button>

        {/* ─── Header Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                style={{ background: isWarehouse
                  ? "linear-gradient(135deg, #e65100 0%, #f57c00 100%)"
                  : "linear-gradient(135deg, #003178 0%, #0d47a1 100%)" }}
              >
                {businessName?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <h1
                  className="text-lg sm:text-xl font-extrabold text-gray-900"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  {businessName}
                </h1>
                <p className="text-xs text-gray-400">
                  by {userData.ownerName || userData.name} • Joined {format(new Date(userData.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Account Status Badge */}
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
              {/* Role Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  isWarehouse
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {isWarehouse ? "warehouse" : "storefront"}
                </span>
                {isWarehouse ? "Wholesaler" : "Retailer"}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-5 pt-5 border-t border-gray-100">
            {isSuspended ? (
              <Button
                onClick={() => activateMutation.mutate({ userId })}
                disabled={isActionPending}
                className="flex-1 h-auto py-2.5 rounded-lg text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {activateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span
                    className="material-symbols-outlined text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                )}
                Activate User
              </Button>
            ) : (
              <Button
                onClick={() => setSuspendDialogOpen(true)}
                className="h-auto px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">block</span>
                Suspend User
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(true)}
              className="h-auto px-5 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              Edit Info
            </Button>
          </div>
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
                  {isWarehouse ? "warehouse" : "storefront"}
                </span>
                <p className="text-xs text-gray-400 mb-0.5">Role</p>
                <p className="text-sm font-bold text-gray-900">
                  {isWarehouse ? "Wholesaler" : "Retailer"}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <span
                  className="material-symbols-outlined text-2xl text-[#003178] mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified_user
                </span>
                <p className="text-xs text-gray-400 mb-0.5">KYC</p>
                <p className="text-sm font-bold text-gray-900">{kycLabel}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <span
                  className="material-symbols-outlined text-2xl text-[#003178] mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  login
                </span>
                <p className="text-xs text-gray-400 mb-0.5">Last Login</p>
                <p className="text-sm font-bold text-gray-900">
                  {loginActivity
                    ? formatDistanceToNow(new Date(loginActivity.lastLoginAt), { addSuffix: true })
                    : "Never"}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <span
                  className="material-symbols-outlined text-2xl text-[#003178] mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  devices
                </span>
                <p className="text-xs text-gray-400 mb-0.5">Device</p>
                <p className="text-sm font-bold text-gray-900">
                  {loginActivity ? parseUserAgent(loginActivity.userAgent) : "—"}
                </p>
              </div>
            </div>

            {/* Business / Warehouse Details */}
            {isWarehouse ? (
              <DetailSection title="Warehouse Details" icon="warehouse">
                <DetailField label="Warehouse Name" value={userData.warehouseName} />
                <DetailField label="Owner Name" value={userData.ownerName} />
                <DetailField label="Address" value={userData.warehouseAddress} />
                {userData.warehouseSlug && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Dashboard</span>
                    <a
                      href={`/warehouse/${userData.warehouseSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#003178] font-medium hover:underline"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      View Dashboard
                    </a>
                  </div>
                )}
              </DetailSection>
            ) : (
              <DetailSection title="Shop Details" icon="storefront">
                <DetailField label="Shop Name" value={userData.shopName} />
                <DetailField label="Owner Name" value={userData.ownerName} />
                <DetailField label="Business Type" value={userData.businessType} />
                <DetailField label="Address" value={userData.shopAddress} />
                {userData.sellerStatus && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Seller Status</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      userData.sellerStatus === "active"
                        ? "bg-green-50 text-green-700 border-green-100"
                        : "bg-gray-50 text-gray-700 border-gray-100"
                    }`}>
                      {userData.sellerStatus}
                    </span>
                  </div>
                )}
                {userData.shopSlug && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Store Page</span>
                    <a
                      href={`/store/${userData.shopSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#003178] font-medium hover:underline"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      View Store
                    </a>
                  </div>
                )}
              </DetailSection>
            )}

            {/* Location */}
            {(() => {
              const lat = isWarehouse ? userData.warehouseLat : userData.shopLat;
              const lng = isWarehouse ? userData.warehouseLng : userData.shopLng;
              const address = isWarehouse ? userData.warehouseAddress : userData.shopAddress;
              return (lat && lng) ? (
                <DetailSection title="Location" icon="location_on">
                  <div className="rounded-xl overflow-hidden border border-gray-200 -mx-1 mb-2">
                    <LocationViewMap
                      latitude={parseFloat(lat)}
                      longitude={parseFloat(lng)}
                    />
                  </div>
                  <DetailField label="Address" value={address} />
                </DetailSection>
              ) : address ? (
                <DetailSection title="Location" icon="location_on">
                  <DetailField label="Address" value={address} />
                </DetailSection>
              ) : null;
            })()}

            {/* Contact Information */}
            <DetailSection title="Contact Information" icon="contact_phone">
              <DetailField label="Full Name" value={userData.name} />
              <DetailField label="Phone Number" value={userData.phoneNumber} />
              <DetailField label="Email" value={userData.email} />
              <DetailField label="Owner Name" value={userData.ownerName} />
            </DetailSection>

            {/* Account Status */}
            <DetailSection
              title="Account Status"
              icon="shield_person"
              badge={
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.color} ${config.border}`}>
                  {config.label}
                </span>
              }
            >
              <DetailField
                label="KYC Status"
                value={kycLabel}
              />
              <DetailField
                label="Account Created"
                value={format(new Date(userData.createdAt), "MMM d, yyyy 'at' h:mm a")}
              />
              {userData.updatedAt && (
                <DetailField
                  label="Last Updated"
                  value={format(new Date(userData.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                />
              )}
              {isSuspended && userData.banReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                  <p className="text-xs font-semibold text-red-700 mb-1">Suspension Reason</p>
                  <p className="text-sm text-red-600">{userData.banReason}</p>
                </div>
              )}
            </DetailSection>

            {/* Login Activity */}
            <DetailSection title="Login Activity" icon="history">
              {loginActivity ? (
                <>
                  <DetailField
                    label="Last Active"
                    value={formatDistanceToNow(new Date(loginActivity.lastLoginAt), { addSuffix: true })}
                  />
                  <DetailField label="Device" value={parseUserAgent(loginActivity.userAgent)} />
                  <DetailField label="IP Address" value={loginActivity.ipAddress} />
                </>
              ) : (
                <div className="flex flex-col items-center py-4 text-center">
                  <span className="material-symbols-outlined text-2xl text-gray-300 mb-1">
                    visibility_off
                  </span>
                  <p className="text-sm text-gray-400">No login activity recorded</p>
                </div>
              )}
            </DetailSection>
          </div>

          {/* ═══ RIGHT SIDEBAR (1/3) ═══ */}
          <div className="space-y-5 lg:sticky lg:top-6 self-start">

            {/* User Card */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div
                className="px-5 py-6 text-center"
                style={{
                  background: isWarehouse
                    ? "linear-gradient(135deg, #e65100 0%, #f57c00 100%)"
                    : "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                }}
              >
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                  {(userData.ownerName || userData.name)?.[0]?.toUpperCase() || "?"}
                </div>
                <p className="text-white font-bold text-sm">{userData.ownerName || userData.name}</p>
                <p className="text-white/70 text-xs mt-0.5">
                  {isWarehouse ? "Warehouse Operator" : "Shop Owner"}
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className="material-symbols-outlined text-gray-400 text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    call
                  </span>
                  <span className="text-gray-700 font-medium">{userData.phoneNumber || "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className="material-symbols-outlined text-gray-400 text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    mail
                  </span>
                  <span className="text-gray-700 font-medium truncate">{userData.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className="material-symbols-outlined text-gray-400 text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    calendar_today
                  </span>
                  <span className="text-gray-700">
                    Joined {format(new Date(userData.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>

            {/* KYC / Application Status */}
            {applicationStatus && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-[#003178] text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified_user
                  </span>
                  <h3 className="font-bold text-sm text-gray-900">KYC Verification</h3>
                </div>
                <div className={`rounded-lg px-4 py-3 text-center ${kycConfig.bg} border ${kycConfig.border}`}>
                  <p className={`text-sm font-bold ${kycConfig.color}`}>
                    {kycLabel}
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
                {/* Registered */}
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
                    <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                  </div>
                  <div className="-mt-0.5">
                    <p className="text-xs font-semibold text-gray-900">Registered</p>
                    <p className="text-[10px] text-gray-400">
                      {format(new Date(userData.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>

                {/* Application */}
                {applicationStatus && (
                  <div className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        applicationStatus.status === "approved" ? "bg-green-100" : "bg-amber-100"
                      }`}>
                        <span
                          className={`material-symbols-outlined text-xs ${
                            applicationStatus.status === "approved" ? "text-green-600" : "text-amber-600"
                          }`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {applicationStatus.status === "approved" ? "check" : "schedule"}
                        </span>
                      </div>
                      {loginActivity && (
                        <div className="w-0.5 h-4 bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="-mt-0.5">
                      <p className="text-xs font-semibold text-gray-900 capitalize">
                        Application {applicationStatus.status}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {applicationStatus.reviewedAt
                          ? format(new Date(applicationStatus.reviewedAt), "MMM d, yyyy 'at' h:mm a")
                          : applicationStatus.appliedAt
                            ? format(new Date(applicationStatus.appliedAt), "MMM d, yyyy 'at' h:mm a")
                            : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Last Login */}
                {loginActivity && (
                  <div className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                        <span
                          className="material-symbols-outlined text-purple-600 text-xs"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          login
                        </span>
                      </div>
                    </div>
                    <div className="-mt-0.5">
                      <p className="text-xs font-semibold text-gray-900">Last Active</p>
                      <p className="text-[10px] text-gray-400">
                        {format(new Date(loginActivity.lastLoginAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="material-symbols-outlined text-[#003178] text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  info
                </span>
                <h3 className="font-bold text-sm text-gray-900">Quick Info</h3>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">User ID</span>
                  <span className="font-mono text-xs text-gray-700">{userData.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Role</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {isWarehouse ? "Warehouse" : "Shop Owner"}
                  </span>
                </div>
                {userData.isSeller !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Seller Enabled</span>
                    <span className="font-medium text-gray-900">
                      {userData.isSeller ? "Yes" : "No"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Suspend Dialog ─── */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              This will immediately block <strong>{businessName}</strong> from accessing the platform.
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

      {/* ─── Edit Dialog ─── */}
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

/* ── Edit Dialog ── */

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

  const handleSubmit = () => {
    const updates: Record<string, string> = {};
    if (formData.name !== userData.name) updates.name = formData.name;
    if (formData.phoneNumber !== (userData.phoneNumber || ""))
      updates.phoneNumber = formData.phoneNumber;
    if (formData.ownerName !== (userData.ownerName || ""))
      updates.ownerName = formData.ownerName;

    if (isWarehouse) {
      if (formData.warehouseName !== (userData.warehouseName || ""))
        updates.warehouseName = formData.warehouseName;
      if (formData.warehouseAddress !== (userData.warehouseAddress || ""))
        updates.warehouseAddress = formData.warehouseAddress;
    } else {
      if (formData.shopName !== (userData.shopName || ""))
        updates.shopName = formData.shopName;
      if (formData.shopAddress !== (userData.shopAddress || ""))
        updates.shopAddress = formData.shopAddress;
    }

    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }

    onSave(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User Info</DialogTitle>
          <DialogDescription>
            Update the user&apos;s profile information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={formData.phoneNumber}
              disabled
              className="bg-muted cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <Label>Owner Name</Label>
            <Input
              value={formData.ownerName}
              onChange={(e) =>
                setFormData({ ...formData, ownerName: e.target.value })
              }
            />
          </div>
          {isWarehouse ? (
            <>
              <div className="space-y-2">
                <Label>Warehouse Name</Label>
                <Input
                  value={formData.warehouseName}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouseName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Warehouse Address</Label>
                <Input
                  value={formData.warehouseAddress}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      warehouseAddress: e.target.value,
                    })
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Shop Name</Label>
                <Input
                  value={formData.shopName}
                  onChange={(e) =>
                    setFormData({ ...formData, shopName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Shop Address</Label>
                <Input
                  value={formData.shopAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, shopAddress: e.target.value })
                  }
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
