"use client";

import dynamic from "next/dynamic";
import { format, isValid, parse } from "date-fns";
import Image from "next/image";
import {
  BUSINESS_NATURES,
  GENDERS,
  type DocumentUrls,
} from "@/constants/seller-registration";
import { Button } from "@/components/ui/button";

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
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function ApplicantProfileSection({ data }: { data: ApplicationDetailData }) {
  const hasProfile =
    data.profilePhotoUrl ||
    data.email ||
    data.dateOfBirth ||
    data.gender;

  if (!hasProfile && !data.ownerName) return null;

  return (
    <DetailSection title="Applicant Profile" icon="person">
      {data.profilePhotoUrl && (
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
            <Image
              src={data.profilePhotoUrl}
              alt={data.ownerName}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
          <p className="text-sm text-gray-500">Profile photo</p>
        </div>
      )}
      <DetailField label="Full Name" value={data.ownerName} />
      <DetailField label="Phone" value={data.phoneNumber} />
      <DetailField label="Email" value={data.email} />
      <DetailField label="Date of Birth" value={formatDateOfBirth(data.dateOfBirth)} />
      <DetailField label="Gender" value={formatGender(data.gender)} />
    </DetailSection>
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

export function BusinessDetailsSection({
  data,
  businessName,
  businessNameLabel,
  businessType,
  businessTypeLabel,
  sellingModeBadge,
}: {
  data: ApplicationDetailData;
  businessName: string;
  businessNameLabel: string;
  businessType?: string | null;
  businessTypeLabel?: string;
  sellingModeBadge?: React.ReactNode;
}) {
  const typeName = data.productTypeName || data.businessCategory;

  return (
    <DetailSection title="Business Details" icon="storefront">
      <DetailField label={businessNameLabel} value={businessName} />
      <DetailField
        label="Business Nature"
        value={formatBusinessNature(data.businessNature)}
      />
      <DetailField label="Business Type" value={typeName} />
      {businessType && businessTypeLabel && (
        <DetailField label={businessTypeLabel} value={businessType} />
      )}
      {sellingModeBadge}
      <DetailField label="Years in Business" value={data.yearsInBusiness} />
      <DetailField label="Monthly Revenue" value={data.monthlyRevenue} />
      <DetailField
        label="Trade License"
        value={data.tradeLicenseNumber || "Not provided"}
      />
      <DetailField label="BIN Number" value={data.binNumber} />
      <DetailField label="TIN Number" value={data.tinNumber} />
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

function DocumentCard({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-xl border border-gray-200 transition-all hover:border-[#003178]/30"
    >
      <div className="relative aspect-[4/3]">
        <Image
          src={url}
          alt={label}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
          <span className="material-symbols-outlined text-2xl text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100">
            open_in_new
          </span>
        </div>
      </div>
      <div className="bg-gray-50/80 px-3 py-2">
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
    </a>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {labeledEntries.map(([key, label]) => (
            <DocumentCard key={key} label={label} url={documentUrls[key]!} />
          ))}
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

export function BankDetailsSection({ data }: { data: ApplicationDetailData }) {
  if (!data.bankName && !data.bankAccountName && !data.bankAccountNumber) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="material-symbols-outlined text-lg text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          account_balance
        </span>
        <h3 className="text-sm font-bold text-gray-900">Bank Information</h3>
      </div>
      <div className="space-y-2">
        <DetailField label="Bank" value={data.bankName} />
        <DetailField label="Account Name" value={data.bankAccountName} />
        <DetailField label="Account Number" value={data.bankAccountNumber} />
      </div>
    </div>
  );
}

export function ReferralSection({ data }: { data: ApplicationDetailData }) {
  if (!data.referralId && !data.referralName && !data.referralPhone) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="material-symbols-outlined text-lg text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          group_add
        </span>
        <h3 className="text-sm font-bold text-gray-900">Referral</h3>
      </div>
      <div className="space-y-2">
        <DetailField label="Referral ID" value={data.referralId} />
        <DetailField label="Referral Name" value={data.referralName} />
        <DetailField label="Referral Phone" value={data.referralPhone} />
      </div>
    </div>
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
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="material-symbols-outlined text-lg text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          share
        </span>
        <h3 className="text-sm font-bold text-gray-900">Social Profiles</h3>
      </div>
      <div className="space-y-2">
        {links.map((link) => (
          <div key={link.label} className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500">{link.label}</span>
            <a
              href={link.value!.startsWith("http") ? link.value! : undefined}
              className="max-w-[60%] truncate text-right font-medium text-[#003178] hover:underline"
            >
              {link.value}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApplicationStatsTiles({ data }: { data: ApplicationDetailData }) {
  const natureLabel = formatBusinessNature(data.businessNature) || "—";
  const typeName = data.productTypeName || data.businessCategory || "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
        <span
          className="material-symbols-outlined mb-1 block text-2xl text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          storefront
        </span>
        <p className="mb-0.5 text-xs text-gray-400">Business Nature</p>
        <p className="text-sm font-bold text-gray-900">{natureLabel}</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
        <span
          className="material-symbols-outlined mb-1 block text-2xl text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          category
        </span>
        <p className="mb-0.5 text-xs text-gray-400">Business Type</p>
        <p className="text-sm font-bold text-gray-900">{typeName}</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
        <span
          className="material-symbols-outlined mb-1 block text-2xl text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          schedule
        </span>
        <p className="mb-0.5 text-xs text-gray-400">Experience</p>
        <p className="text-sm font-bold text-gray-900">
          {data.yearsInBusiness || "—"}
        </p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
        <span
          className="material-symbols-outlined mb-1 block text-2xl text-[#003178]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          payments
        </span>
        <p className="mb-0.5 text-xs text-gray-400">Revenue</p>
        <p className="text-sm font-bold text-gray-900">
          {data.monthlyRevenue || "—"}
        </p>
      </div>
    </div>
  );
}

export function ApplicantSummaryCard({
  data,
  subtitle,
  gradientClass,
}: {
  data: ApplicationDetailData;
  subtitle: string;
  gradientClass: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className={`px-5 py-6 text-center ${gradientClass}`}>
        {data.profilePhotoUrl ? (
          <div className="relative mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full border-2 border-white/30">
            <Image
              src={data.profilePhotoUrl}
              alt={data.ownerName}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
        ) : (
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white">
            {data.ownerName?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <p className="text-sm font-bold text-white">{data.ownerName}</p>
        <p className="mt-0.5 text-xs text-white/70">{subtitle}</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center gap-3 text-sm">
          <span
            className="material-symbols-outlined text-lg text-gray-400"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            call
          </span>
          <span className="font-medium text-gray-700">{data.phoneNumber}</span>
        </div>
        {data.email && (
          <div className="flex items-center gap-3 text-sm">
            <span
              className="material-symbols-outlined text-lg text-gray-400"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              mail
            </span>
            <span className="font-medium text-gray-700">{data.email}</span>
          </div>
        )}
        {data.personalAddress && (
          <div className="flex items-start gap-3 text-sm">
            <span
              className="material-symbols-outlined text-lg text-gray-400"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              home
            </span>
            <span className="text-gray-700">{data.personalAddress}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ApplicationDetailHeader({
  title,
  ownerName,
  createdAt,
  applicationNumber,
  status,
  avatarInitial,
  avatarClassName,
  isPending,
  onApprove,
  onReject,
}: {
  title: string;
  ownerName: string;
  createdAt: Date | string;
  applicationNumber?: string | null;
  status: ApplicationStatus;
  avatarInitial: string;
  avatarClassName: string;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const config = APPLICATION_STATUS_CONFIG[status];

  return (
    <header className="mb-6 border-b border-gray-100 pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white ${avatarClassName}`}
          >
            {avatarInitial}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                {title}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.bg} ${config.color} ${config.border}`}
              >
                <span
                  className="material-symbols-outlined text-[12px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {config.icon}
                </span>
                {config.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {ownerName} · {format(new Date(createdAt), "MMM d, yyyy")}
              {applicationNumber && <> · {applicationNumber}</>}
            </p>
          </div>
        </div>

        {isPending && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={onApprove}
              className="h-8 bg-green-600 px-3 text-xs font-medium hover:bg-green-700"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              className="h-8 border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </header>
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
