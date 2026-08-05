"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import type { ApplicationDetailData } from "@/components/features/admin/application-detail-sections";
import { Button } from "@/components/ui/button";

const ACCOUNT_STATUS_CONFIG = {
  active: {
    label: "Active",
    bg: "bg-green-50",
    color: "text-green-700",
    border: "border-green-200",
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-50",
    color: "text-amber-700",
    border: "border-amber-200",
  },
  suspended: {
    label: "Suspended",
    bg: "bg-red-50",
    color: "text-red-700",
    border: "border-red-200",
  },
} as const;

const KYC_LABELS = {
  verified: "Verified",
  pending: "Pending",
  failed: "Failed",
  unverified: "Unverified",
} as const;

function HeroFieldRow({
  label,
  value,
  children,
  valueClassName,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
  valueClassName?: string;
}) {
  if (!value && !children) return null;
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-baseline gap-x-4 text-sm">
      <span className="text-gray-500">{label}</span>
      {children ?? (
        <span
          className={`min-w-0 font-medium text-gray-900 ${valueClassName ?? "break-words"}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function formatLocationHint(data: ApplicationDetailData): string | null {
  const parts = [data.area, data.district].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : data.businessAddress || null;
}

export function UserProfileHero({
  data,
  pageTitle,
  profileLabel,
  businessName,
  territory,
  displayId,
  accountStatus,
  kycStatus,
  profileCompletion,
  joinedAt,
  lastActiveAt,
  isSuspended,
  isActionPending,
  canVerify,
  isVerifying,
  onEdit,
  onSuspend,
  onActivate,
  onVerify,
}: {
  data: ApplicationDetailData;
  pageTitle: string;
  profileLabel: string;
  businessName: string;
  territory?: string | null;
  displayId: string;
  accountStatus: keyof typeof ACCOUNT_STATUS_CONFIG;
  kycStatus: keyof typeof KYC_LABELS;
  profileCompletion: number;
  joinedAt: Date | string;
  lastActiveAt?: Date | string | null;
  isSuspended: boolean;
  isActionPending: boolean;
  canVerify: boolean;
  isVerifying: boolean;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onVerify: () => void;
}) {
  const statusConfig = ACCOUNT_STATUS_CONFIG[accountStatus];
  const locationHint = formatLocationHint(data);
  const photoUrl = data.profilePhotoUrl;

  return (
    <header className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col lg:flex-row">
        <div className="flex shrink-0 items-start justify-center border-b border-gray-100 bg-gray-50/40 p-5 lg:w-[7.5rem] lg:border-b-0 lg:border-r lg:py-6">
          {photoUrl ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200">
              <Image
                src={photoUrl}
                alt={data.ownerName}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-[#003178]/10 text-2xl font-bold text-[#003178]">
              {data.ownerName?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 border-b border-gray-100 p-5 lg:border-b-0 lg:border-r lg:py-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {profileLabel}
          </p>
          <h1 className="mb-3 text-base font-semibold text-gray-900">
            {pageTitle}
          </h1>
          <div className="space-y-1">
            <HeroFieldRow label="Business" value={businessName} />
            <HeroFieldRow label="Owner" value={data.ownerName} />
            <HeroFieldRow label="Mobile" value={data.phoneNumber} />
            <HeroFieldRow label="Email" value={data.email} />
            {locationHint && <HeroFieldRow label="Area" value={locationHint} />}
            {territory && <HeroFieldRow label="Territory" value={territory} />}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col p-5 lg:w-[22rem] lg:py-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Account Status
          </p>
          <div className="space-y-1">
            <HeroFieldRow
              label="User ID"
              value={displayId}
              valueClassName="text-xs font-mono leading-tight tracking-tight"
            />
            <HeroFieldRow label="Status">
              <span
                className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-tight ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
              >
                {statusConfig.label}
              </span>
            </HeroFieldRow>
            <HeroFieldRow label="Verification" value={KYC_LABELS[kycStatus]} />
            <HeroFieldRow
              label="Profile"
              value={`${profileCompletion}% Complete`}
            />
            <HeroFieldRow
              label="Joined"
              value={format(new Date(joinedAt), "d MMM yyyy")}
            />
            {lastActiveAt && (
              <HeroFieldRow
                label="Last Active"
                value={formatDistanceToNow(new Date(lastActiveAt), {
                  addSuffix: true,
                })}
              />
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {canVerify && (
              <Button
                size="sm"
                onClick={onVerify}
                disabled={isVerifying || isActionPending}
                className="h-8 flex-1 bg-green-600 text-xs hover:bg-green-700"
              >
                {isVerifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Verify KYC"
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="h-8 flex-1 text-xs"
            >
              Edit
            </Button>
            {isSuspended ? (
              <Button
                size="sm"
                onClick={onActivate}
                disabled={isActionPending || isVerifying}
                className="h-8 flex-1 bg-green-600 text-xs hover:bg-green-700"
              >
                {isActionPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Activate"
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={onSuspend}
                disabled={isVerifying}
                className="h-8 flex-1 border-red-200 text-xs text-red-600 hover:bg-red-50"
              >
                Suspend
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
