"use client";

import { computeProfileCompletion } from "@bikalpo-project/api/business-profile";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CreditCard,
  Edit3,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import {
  BankAndTaxSection,
  BusinessInformationSection,
  BusinessLocationSection,
  LabeledDocumentsSection,
  PersonalLocationSection,
  ReferralSection,
  SocialProfilesSection,
  toApplicationDetail,
} from "@/components/features/admin/application-detail-sections";
import { FinancialSettingsSection } from "@/components/features/settings/financial-settings-section";
import { useRetailerSubscription } from "@/components/features/settings/retailer-subscription";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { drainProfileDocumentCleanup } from "@/lib/profile-document-cleanup";
import { orpc } from "@/utils/orpc";

const APPLICATION_STATUS = {
  approved: "Approved",
  pending: "Pending review",
  rejected: "Needs attention",
} as const;

const KYC_STATUS = {
  failed: "Needs attention",
  pending: "Pending verification",
  unverified: "Not verified",
  verified: "Verified",
} as const;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(date);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not provided";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-gray-900">
        {value}
      </dd>
    </div>
  );
}

export function RetailerRegistrationProfileView() {
  const query = useQuery({
    ...orpc.shopOwner.getMyRegistrationProfile.queryOptions(),
    retry: false,
  });
  const data = query.data;
  const subscription = useRetailerSubscription();

  useEffect(() => {
    void drainProfileDocumentCleanup();
  }, []);

  if (query.isPending) return <RegistrationProfileSkeleton />;

  if (query.isError || !data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <FileCheck2
          className="mx-auto size-10 text-amber-700"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-xl font-semibold text-amber-950">
          Registration profile unavailable
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-amber-800">
          We could not load the registration record connected to this retail
          account. Try again or return to General Settings.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
          <Button asChild>
            <Link href="/dashboard/settings">General Settings</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { account, application, kycStatus, profileCompletion } = data;
  const businessName = account.shopName || application.shopName;
  const businessAddress = account.shopAddress || application.shopAddress;
  const detail = toApplicationDetail(
    application as unknown as Record<string, unknown>,
    businessAddress,
  );
  const completion =
    profileCompletion ?? computeProfileCompletion(application, account);
  const applicationStatus =
    APPLICATION_STATUS[application.status as keyof typeof APPLICATION_STATUS] ??
    formatLabel(application.status);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-3 mb-2 text-gray-600">
            <Link href="/dashboard/settings">
              <ArrowLeft className="size-4" aria-hidden="true" />
              General Settings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            Registration Profile
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            Review the identity and business information submitted for this
            retail account.
          </p>
        </div>
        <Button asChild className="bg-[#003178] hover:bg-[#00255c]">
          <Link href="/dashboard/settings/profile/edit">
            <Edit3 className="size-4" aria-hidden="true" />
            Edit profile
          </Link>
        </Button>
      </div>

      <header className="overflow-hidden rounded-xl bg-[#003178] text-white">
        <div className="grid gap-6 p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-8">
          <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20">
            {application.profilePhotoUrl || account.image ? (
              <Image
                src={application.profilePhotoUrl || account.image || ""}
                alt={`${application.ownerName} profile photo`}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="text-3xl font-bold">
                {application.ownerName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold tracking-tight">
                {application.ownerName}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                {applicationStatus}
              </span>
            </div>
            <p className="mt-1 text-base font-medium text-blue-100">
              {businessName}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-blue-100">
              <span>{application.phoneNumber}</span>
              <span>{application.email || account.email}</span>
              <span>DOB: {formatDate(application.dateOfBirth)}</span>
              <span>Gender: {formatLabel(application.gender)}</span>
              <span>{formatLabel(application.businessNature)}</span>
            </div>
          </div>
          <div className="min-w-44 rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="whitespace-nowrap text-blue-100">
                Profile completion
              </span>
              <strong className="tabular-nums">{completion}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Tabs defaultValue="basic" className="min-w-0">
          <TabsList className="mb-5 grid w-full grid-cols-2 rounded-none border-b bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-4">
            <TabsTrigger
              value="basic"
              className="min-h-11 whitespace-normal rounded-none px-4 py-3 text-center"
            >
              Basic Information
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="min-h-11 whitespace-normal rounded-none px-4 py-3 text-center"
            >
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="social"
              className="min-h-11 whitespace-normal rounded-none px-4 py-3 text-center"
            >
              Social &amp; Contact
            </TabsTrigger>
            <TabsTrigger
              value="banking"
              className="min-h-11 whitespace-normal rounded-none px-4 py-3 text-center"
            >
              Banking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-5">
            <BusinessInformationSection
              data={detail}
              businessName={businessName}
              businessNameLabel="Shop Name"
              businessType={formatLabel(application.businessType)}
              businessTypeLabel="Platform Type"
              applicantStatusLabel={applicationStatus}
            />
            <PersonalLocationSection data={detail} />
            <BusinessLocationSection data={detail} />
            <ReferralSection data={detail} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-5">
            <LabeledDocumentsSection data={detail} />
          </TabsContent>

          <TabsContent value="social" className="space-y-5">
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b bg-gray-50/80 px-5 py-3">
                <h3 className="text-sm font-bold text-gray-900">
                  Primary contacts
                </h3>
              </div>
              <dl className="px-5 py-2">
                <MetadataRow
                  label="Public phone"
                  value={application.phoneNumber}
                />
                <MetadataRow
                  label="Public email"
                  value={application.email || "Not provided"}
                />
              </dl>
            </section>
            <SocialProfilesSection data={detail} />
          </TabsContent>

          <TabsContent value="banking" className="space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900">
              Registration bank details are kept as the original application
              record. Operational bank and mobile-banking accounts are managed
              separately below.
            </div>
            <BankAndTaxSection data={detail} />
            <FinancialSettingsSection editorHref="/dashboard/settings/profile/edit#banking-information" />
          </TabsContent>
        </Tabs>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="size-5 text-[#003178]"
                aria-hidden="true"
              />
              <h2 className="font-semibold text-gray-950">
                Registration status
              </h2>
            </div>
            <dl className="mt-3">
              <MetadataRow
                label="Application ID"
                value={application.applicationNumber || "Not available"}
              />
              <MetadataRow label="Application" value={applicationStatus} />
              <MetadataRow
                label="KYC"
                value={KYC_STATUS[kycStatus as keyof typeof KYC_STATUS]}
              />
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <CalendarDays
                className="size-5 text-[#003178]"
                aria-hidden="true"
              />
              <h2 className="font-semibold text-gray-950">
                Registration timeline
              </h2>
            </div>
            <dl className="mt-3">
              <MetadataRow
                label="Submitted"
                value={formatDate(application.createdAt)}
              />
              <MetadataRow
                label="Reviewed"
                value={formatDate(application.reviewedAt)}
              />
              <MetadataRow
                label="Member since"
                value={formatDate(account.createdAt)}
              />
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-[#003178]" aria-hidden="true" />
              <h2 className="font-semibold text-gray-950">
                Registration preference
              </h2>
            </div>
            <dl className="mt-3">
              <MetadataRow
                label="Selected plan"
                value={formatLabel(application.selectedPlan)}
              />
              <MetadataRow
                label="Product type"
                value={
                  application.productType?.name ||
                  application.businessCategory ||
                  "Not provided"
                }
              />
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <CreditCard
                className="size-5 text-[#003178]"
                aria-hidden="true"
              />
              <h2 className="font-semibold text-gray-950">
                Current subscription
              </h2>
            </div>
            <dl className="mt-3">
              <MetadataRow
                label="Current plan"
                value={subscription.data?.current?.planName || "No active plan"}
              />
              <MetadataRow
                label="Status"
                value={formatLabel(subscription.data?.current?.status)}
              />
            </dl>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/dashboard/settings#subscription-settings">
                Manage subscription
              </Link>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RegistrationProfileSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
      role="status"
      aria-label="Loading registration profile"
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
