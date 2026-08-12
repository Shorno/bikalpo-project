"use client";

import dynamic from "next/dynamic";
import { format, isValid, parse } from "date-fns";
import Image from "next/image";
import {
  BUSINESS_NATURES,
  GENDERS,
  type DocumentUrls,
} from "@/constants/seller-registration";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  KYC_STATUS_CONFIG,
  type KycStatusKey,
} from "@/components/features/admin/kyc-verify-dialog";

export const APPLICATION_STATUS_CONFIG = {
  pending: {
    label: "Pending Review",
    icon: "schedule",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  approved: {
    label: "Approved",
    icon: "check_circle",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  rejected: {
    label: "Rejected",
    icon: "cancel",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
} as const;

export type ApplicationStatus = keyof typeof APPLICATION_STATUS_CONFIG;

const LocationViewMap = dynamic(
  () =>
    import("@/components/features/onboarding/location-view-map").then(
      (mod) => mod.LocationViewMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[250px] w-full items-center justify-center rounded-xl bg-gray-100">
        <span className="text-sm text-gray-400">Loading map...</span>
      </div>
    ),
  },
);

export type ApplicationDetailData = {
  applicationNumber?: string | null;
  ownerName: string;
  phoneNumber: string;
  profilePhotoUrl?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  personalAddress?: string | null;
  personalLatitude?: string | null;
  personalLongitude?: string | null;
  personalArea?: string | null;
  personalDistrict?: string | null;
  personalDivision?: string | null;
  personalPostCode?: string | null;
  businessNature?: string | null;
  businessCategory?: string | null;
  productTypeName?: string | null;
  yearsInBusiness?: string | null;
  monthlyRevenue?: string | null;
  binNumber?: string | null;
  tinNumber?: string | null;
  tradeLicenseNumber?: string | null;
  documentUrls?: DocumentUrls | null;
  documents?: string[] | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  referralId?: string | null;
  referralName?: string | null;
  referralPhone?: string | null;
  facebookUrl?: string | null;
  whatsappNumber?: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  tiktokUrl?: string | null;
  twitterUrl?: string | null;
  businessAddress: string;
  latitude?: string | null;
  longitude?: string | null;
  area?: string | null;
  district?: string | null;
  division?: string | null;
  postCode?: string | null;
};

const DOCUMENT_LABELS: Record<keyof DocumentUrls, string> = {
  tradeLicense: "Trade License",
  nid: "National ID",
  shopPhoto: "Shop Photo",
  storeFront: "Store Front Photo",
  warehouse: "Warehouse Photo",
};

function formatBusinessNature(nature?: string | null) {
  if (!nature) return null;
  return (
    BUSINESS_NATURES.find((n) => n.id === nature)?.label ||
    nature.replace(/_/g, " ")
  );
}

function formatGender(gender?: string | null) {
  if (!gender) return null;
  return GENDERS.find((g) => g.id === gender)?.label || gender;
}

function formatDateOfBirth(dob?: string | null) {
  if (!dob) return null;
  const parsed = parse(dob, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return format(parsed, "PPP");
  const fallback = new Date(dob);
  return isValid(fallback) ? format(fallback, "PPP") : dob;
}

function hasCoords(lat?: string | null, lng?: string | null) {
  return Boolean(lat && lng && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng)));
}

function maskBankAccount(accountNumber?: string | null) {
  if (!accountNumber) return null;
  const digits = accountNumber.replace(/\s/g, "");
  if (digits.length <= 4) return accountNumber;
  return `${"*".repeat(Math.max(digits.length - 4, 8))}${digits.slice(-4)}`;
}

function formatCoverage(data: ApplicationDetailData) {
  return [data.area, data.district, data.division].filter(Boolean).join(", ") || null;
}

function formatPersonalLocationHint(data: ApplicationDetailData) {
  if (data.personalDistrict || data.personalDivision) {
    return [data.personalArea, data.personalDistrict, data.personalDivision]
      .filter(Boolean)
      .join(", ");
  }
  return data.personalAddress;
}

function hasTradeLicenseSubmitted(data: ApplicationDetailData) {
  return Boolean(
    data.tradeLicenseNumber ||
      data.documentUrls?.tradeLicense ||
      data.documents?.length,
  );
}

export function DetailSection({
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
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex items-center justify-between bg-gray-50/80 px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-lg text-[#003178]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="space-y-2.5 px-5 py-4">{children}</div>
    </div>
  );
}

export function DetailField({
  label,
  value,
  alwaysShow,
}: {
  label: string;
  value?: string | null;
  alwaysShow?: boolean;
}) {
  if (!value && !alwaysShow) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value || "—"}</span>
    </div>
  );
}

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

export function ApplicationReviewHero({
  data,
  pageTitle,
  createdAt,
  status,
  isPending,
  kycStatus = "unverified",
  canVerifyKyc = false,
  isVerifyingKyc = false,
  onApprove,
  onReject,
  onVerifyKyc,
}: {
  data: ApplicationDetailData;
  pageTitle: string;
  createdAt: Date | string;
  status: ApplicationStatus;
  isPending: boolean;
  kycStatus?: KycStatusKey;
  canVerifyKyc?: boolean;
  isVerifyingKyc?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onVerifyKyc?: () => void;
}) {
  const config = APPLICATION_STATUS_CONFIG[status];
  const kycConfig = KYC_STATUS_CONFIG[kycStatus];
  const locationHint = formatPersonalLocationHint(data);

  return (
    <header className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col lg:flex-row">
        <div className="flex shrink-0 items-start justify-center border-b border-gray-100 bg-gray-50/40 p-5 lg:w-[7.5rem] lg:border-b-0 lg:border-r lg:py-6">
          {data.profilePhotoUrl ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200">
              <Image
                src={data.profilePhotoUrl}
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
            Applicant Profile
          </p>
          <h1 className="mb-3 text-base font-semibold text-gray-900">{pageTitle}</h1>
          <div className="space-y-1">
            <HeroFieldRow label="Full Name" value={data.ownerName} />
            <HeroFieldRow label="Mobile" value={data.phoneNumber} />
            <HeroFieldRow label="Email" value={data.email} />
            <HeroFieldRow
              label="DOB"
              value={formatDateOfBirth(data.dateOfBirth)}
            />
            <HeroFieldRow label="Gender" value={formatGender(data.gender)} />
          </div>
          {locationHint && (
            <p className="mt-3 flex items-start gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span
                className="material-symbols-outlined mt-px shrink-0 text-sm text-gray-400"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                location_on
              </span>
              <span className="min-w-0 break-words">{locationHint}</span>
            </p>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col p-5 lg:w-[22rem] lg:py-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Application
          </p>
          <div className="space-y-1">
            <HeroFieldRow
              label="App ID"
              value={data.applicationNumber || "—"}
              valueClassName="text-xs font-mono leading-tight tracking-tight"
            />
            <HeroFieldRow label="Status">
              <span
                className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-tight ${config.bg} ${config.color} ${config.border}`}
              >
                {config.label}
              </span>
            </HeroFieldRow>
            <HeroFieldRow
              label="Submitted"
              value={format(new Date(createdAt), "d MMM yyyy")}
            />
            <HeroFieldRow label="KYC">
              <span
                className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-tight ${kycConfig.bg} ${kycConfig.color} ${kycConfig.border}`}
              >
                {kycConfig.label}
              </span>
            </HeroFieldRow>
            {isPending && (
              <HeroFieldRow label="Review" value="Typically 24–72 hrs" />
            )}
          </div>
          {isPending && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={onApprove}
                className="h-8 flex-1 bg-green-600 text-xs hover:bg-green-700"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                className="h-8 flex-1 border-red-200 text-xs text-red-600 hover:bg-red-50"
              >
                Reject
              </Button>
            </div>
          )}
          {canVerifyKyc && onVerifyKyc && (
            <div className={isPending ? "mt-2" : "mt-4"}>
              <Button
                size="sm"
                onClick={onVerifyKyc}
                disabled={isVerifyingKyc}
                className="h-8 w-full bg-green-600 text-xs hover:bg-green-700"
              >
                {isVerifyingKyc ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Verify KYC"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function PersonalLocationSection({ data }: { data: ApplicationDetailData }) {
  const hasPersonal =
    data.personalAddress ||
    hasCoords(data.personalLatitude, data.personalLongitude);

  if (!hasPersonal) return null;

  return (
    <DetailSection title="Personal Location" icon="home">
      {hasCoords(data.personalLatitude, data.personalLongitude) && (
        <div className="-mx-1 mb-2 overflow-hidden rounded-xl border border-gray-200">
          <LocationViewMap
            latitude={parseFloat(data.personalLatitude!)}
            longitude={parseFloat(data.personalLongitude!)}
          />
        </div>
      )}
      <DetailField label="Address" value={data.personalAddress} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <DetailField label="Area" value={data.personalArea} />
        <DetailField label="District" value={data.personalDistrict} />
        <DetailField label="Division" value={data.personalDivision} />
        <DetailField label="Post Code" value={data.personalPostCode} />
      </div>
    </DetailSection>
  );
}

export function BusinessInformationSection({
  data,
  businessName,
  businessNameLabel,
  businessType,
  businessTypeLabel,
  sellingModeBadge,
  applicantStatusLabel = "New Applicant",
}: {
  data: ApplicationDetailData;
  businessName: string;
  businessNameLabel: string;
  businessType?: string | null;
  businessTypeLabel?: string;
  sellingModeBadge?: React.ReactNode;
  applicantStatusLabel?: string;
}) {
  const typeName = data.productTypeName || data.businessCategory;
  const coverage = formatCoverage(data);

  return (
    <DetailSection title="Business Information" icon="storefront">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Business Name
          </p>
          <DetailField label={businessNameLabel} value={businessName} alwaysShow />
          <DetailField label="Product Type" value={typeName} alwaysShow />
          <DetailField label="Coverage" value={coverage} alwaysShow />
          <DetailField label="Address" value={data.businessAddress} alwaysShow />
          {businessType && businessTypeLabel && (
            <DetailField label={businessTypeLabel} value={businessType} alwaysShow />
          )}
          {sellingModeBadge}
        </div>
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Business Overview
          </p>
          <DetailField
            label="Business Nature"
            value={formatBusinessNature(data.businessNature)}
            alwaysShow
          />
          <DetailField label="Experience" value={data.yearsInBusiness} alwaysShow />
          <DetailField label="Sales Volume" value={data.monthlyRevenue} alwaysShow />
          <DetailField label="Status" value={applicantStatusLabel} alwaysShow />
        </div>
      </div>
    </DetailSection>
  );
}

export function BusinessLocationSection({ data }: { data: ApplicationDetailData }) {
  return (
    <DetailSection title="Business Location" icon="location_on">
      {hasCoords(data.latitude, data.longitude) && (
        <div className="-mx-1 mb-2 overflow-hidden rounded-xl border border-gray-200">
          <LocationViewMap
            latitude={parseFloat(data.latitude!)}
            longitude={parseFloat(data.longitude!)}
          />
        </div>
      )}
      <DetailField label="Address" value={data.businessAddress} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <DetailField label="Area" value={data.area} />
        <DetailField label="District" value={data.district} />
        <DetailField label="Division" value={data.division} />
        <DetailField label="Post Code" value={data.postCode} />
      </div>
    </DetailSection>
  );
}

function DocumentCard({
  label,
  url,
  optional,
}: {
  label: string;
  url: string;
  optional?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-3 py-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        {optional && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            Optional
          </span>
        )}
      </div>
      <div className="relative aspect-[4/3] bg-gray-50">
        <Image
          src={url}
          alt={label}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      </div>
      <div className="flex gap-2 border-t border-gray-100 p-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs"
          asChild
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            View
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs"
          asChild
        >
          <a href={url} download target="_blank" rel="noopener noreferrer">
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}

export function LabeledDocumentsSection({ data }: { data: ApplicationDetailData }) {
  const documentUrls = data.documentUrls || {};
  const labeledEntries = (
    Object.entries(DOCUMENT_LABELS) as [keyof DocumentUrls, string][]
  ).filter(([key]) => documentUrls[key]);

  const legacyDocuments = data.documents || [];
  const totalCount = labeledEntries.length || legacyDocuments.length;

  return (
    <DetailSection
      title="Documents"
      icon="description"
      badge={
        totalCount > 0 ? (
          <span className="inline-flex rounded-full bg-[#003178]/10 px-2.5 py-0.5 text-xs font-semibold text-[#003178]">
            {totalCount} file{totalCount > 1 ? "s" : ""}
          </span>
        ) : undefined
      }
    >
      {totalCount === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="material-symbols-outlined mb-2 text-3xl text-gray-300">
            folder_off
          </span>
          <p className="text-sm text-gray-400">No documents uploaded</p>
        </div>
      ) : labeledEntries.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {labeledEntries
              .filter(([key]) => key !== "warehouse")
              .map(([key, label]) => (
                <DocumentCard key={key} label={label} url={documentUrls[key]!} />
              ))}
          </div>
          {documentUrls.warehouse && (
            <DocumentCard
              label={DOCUMENT_LABELS.warehouse}
              url={documentUrls.warehouse}
              optional
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {legacyDocuments.map((doc, index) => (
            <DocumentCard key={index} label={`Document ${index + 1}`} url={doc} />
          ))}
        </div>
      )}
    </DetailSection>
  );
}

export function BankAndTaxSection({ data }: { data: ApplicationDetailData }) {
  const hasBank =
    data.bankName || data.bankAccountName || data.bankAccountNumber;
  const hasTax = data.binNumber || data.tinNumber || hasTradeLicenseSubmitted(data);

  if (!hasBank && !hasTax) return null;

  const tradeLicenseStatus = hasTradeLicenseSubmitted(data)
    ? "Submitted ✓"
    : "Not provided";

  return (
    <DetailSection title="Bank Information" icon="account_balance">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Bank Details
          </p>
          <DetailField label="Bank Name" value={data.bankName} alwaysShow />
          <DetailField label="Account Name" value={data.bankAccountName} alwaysShow />
          <DetailField
            label="Account Number"
            value={maskBankAccount(data.bankAccountNumber)}
            alwaysShow
          />
        </div>
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Tax Information
          </p>
          <DetailField label="BIN Number" value={data.binNumber} alwaysShow />
          <DetailField label="TIN Number" value={data.tinNumber} alwaysShow />
          <DetailField label="Trade License" value={tradeLicenseStatus} alwaysShow />
        </div>
      </div>
    </DetailSection>
  );
}

export function ReferralSection({ data }: { data: ApplicationDetailData }) {
  if (!data.referralId && !data.referralName && !data.referralPhone) {
    return null;
  }

  return (
    <DetailSection title="Referral Information" icon="group_add">
      <DetailField label="Referral ID" value={data.referralId} alwaysShow />
      <DetailField label="Referrer Name" value={data.referralName} alwaysShow />
      <DetailField label="Mobile" value={data.referralPhone} alwaysShow />
    </DetailSection>
  );
}

export function SocialProfilesSection({ data }: { data: ApplicationDetailData }) {
  const links = [
    { label: "Facebook", value: data.facebookUrl },
    { label: "WhatsApp", value: data.whatsappNumber },
    { label: "Instagram", value: data.instagramUrl },
    { label: "Website", value: data.websiteUrl },
    { label: "TikTok", value: data.tiktokUrl },
    { label: "X (Twitter)", value: data.twitterUrl },
  ].filter((item) => item.value);

  if (links.length === 0) return null;

  return (
    <DetailSection title="Social Network" icon="share">
      <div className="space-y-2">
        {links.map((link) => (
          <div key={link.label} className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500">{link.label}</span>
            {link.value!.startsWith("http") ? (
              <a
                href={link.value!}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[60%] truncate text-right font-medium text-[#003178] hover:underline"
              >
                {link.value}
              </a>
            ) : (
              <span className="max-w-[60%] truncate text-right font-medium text-gray-900">
                {link.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </DetailSection>
  );
}

export function AdminReviewSection({
  isPending,
  adminNotes,
  onAdminNotesChange,
  existingNotes,
}: {
  isPending: boolean;
  adminNotes: string;
  onAdminNotesChange: (value: string) => void;
  existingNotes?: string | null;
}) {
  if (!isPending && !existingNotes) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="material-symbols-outlined text-lg text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          sticky_note_2
        </span>
        <h3 className="text-sm font-bold text-gray-900">Admin Review</h3>
      </div>
      {isPending ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Internal note</p>
          <Textarea
            placeholder="Add review notes before approving or rejecting..."
            value={adminNotes}
            onChange={(e) => onAdminNotesChange(e.target.value)}
            rows={4}
            className="resize-none text-sm"
          />
        </div>
      ) : (
        <p className="rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">
          {existingNotes}
        </p>
      )}
    </div>
  );
}

export function toApplicationDetail(
  app: Record<string, unknown>,
  businessAddress: string,
): ApplicationDetailData {
  const productType = app.productType as { name?: string } | null | undefined;
  return {
    applicationNumber: app.applicationNumber as string | null | undefined,
    ownerName: app.ownerName as string,
    phoneNumber: app.phoneNumber as string,
    profilePhotoUrl: app.profilePhotoUrl as string | null | undefined,
    email: app.email as string | null | undefined,
    dateOfBirth: app.dateOfBirth as string | null | undefined,
    gender: app.gender as string | null | undefined,
    personalAddress: app.personalAddress as string | null | undefined,
    personalLatitude: app.personalLatitude as string | null | undefined,
    personalLongitude: app.personalLongitude as string | null | undefined,
    personalArea: app.personalArea as string | null | undefined,
    personalDistrict: app.personalDistrict as string | null | undefined,
    personalDivision: app.personalDivision as string | null | undefined,
    personalPostCode: app.personalPostCode as string | null | undefined,
    businessNature: app.businessNature as string | null | undefined,
    businessCategory: app.businessCategory as string | null | undefined,
    productTypeName: productType?.name ?? null,
    yearsInBusiness: app.yearsInBusiness as string | null | undefined,
    monthlyRevenue: app.monthlyRevenue as string | null | undefined,
    binNumber: app.binNumber as string | null | undefined,
    tinNumber: app.tinNumber as string | null | undefined,
    tradeLicenseNumber: app.tradeLicenseNumber as string | null | undefined,
    documentUrls: app.documentUrls as ApplicationDetailData["documentUrls"],
    documents: app.documents as string[] | null | undefined,
    bankName: app.bankName as string | null | undefined,
    bankAccountName: app.bankAccountName as string | null | undefined,
    bankAccountNumber: app.bankAccountNumber as string | null | undefined,
    referralId: app.referralId as string | null | undefined,
    referralName: app.referralName as string | null | undefined,
    referralPhone: app.referralPhone as string | null | undefined,
    facebookUrl: app.facebookUrl as string | null | undefined,
    whatsappNumber: app.whatsappNumber as string | null | undefined,
    instagramUrl: app.instagramUrl as string | null | undefined,
    websiteUrl: app.websiteUrl as string | null | undefined,
    tiktokUrl: app.tiktokUrl as string | null | undefined,
    twitterUrl: app.twitterUrl as string | null | undefined,
    businessAddress,
    latitude: app.latitude as string | null | undefined,
    longitude: app.longitude as string | null | undefined,
    area: app.area as string | null | undefined,
    district: app.district as string | null | undefined,
    division: app.division as string | null | undefined,
    postCode: app.postCode as string | null | undefined,
  };
}
