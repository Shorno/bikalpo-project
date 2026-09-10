"use client";

import { computeProfileCompletion } from "@bikalpo-project/api/business-profile";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Clock3,
  ContactRound,
  Edit3,
  Loader2,
  Save,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FinancialSettingsSection } from "@/components/features/settings/financial-settings-section";
import { PasswordSecuritySection } from "@/components/features/settings/password-security-section";
import {
  RetailerSubscriptionSection,
  useRetailerSubscription,
} from "@/components/features/settings/retailer-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateShopProfile } from "@/hooks/use-shop-owner-api";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

function displayValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Not provided";
  return value.trim();
}

function formatLabel(value: unknown) {
  const text = displayValue(value);
  if (text === "Not provided") return text;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return "Not provided";
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return "Not provided";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${getPart("day")}-${getPart("month")}-${getPart("year")}`;
}

export default function ShopSettingsPage() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const user = session?.user;
  const subscription = useRetailerSubscription();
  const {
    data: application,
    isPending: isApplicationPending,
    isError: isApplicationError,
    refetch: refetchApplication,
  } = useQuery({
    ...orpc.sellerApplication.getMyApplication.queryOptions(),
    enabled: Boolean(user?.id),
    retry: false,
  });
  const updateProfileMutation = useUpdateShopProfile();

  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setOpeningTime(user?.shopOpeningTime || "");
    setClosingTime(user?.shopClosingTime || "");
  }, [user?.id, user?.shopClosingTime, user?.shopOpeningTime]);

  const handleSaveProfile = async () => {
    await updateProfileMutation.mutateAsync({
      openingTime: openingTime || null,
      closingTime: closingTime || null,
    });
    await refetch();
  };

  if (isPending || (user?.id && isApplicationPending)) {
    return <BusinessProfileSkeleton />;
  }

  const hasIncompleteHours = Boolean(openingTime) !== Boolean(closingTime);
  const businessName = user?.shopName || application?.shopName;
  const businessNameLabel = displayValue(businessName);
  const businessType = user?.businessType || application?.businessType;
  const businessAddress = user?.shopAddress || application?.shopAddress;
  const email = application?.email || user?.email;
  const phoneNumber = application?.phoneNumber || user?.phoneNumber;
  const memberSince = user?.createdAt;
  const profileCompletion = computeProfileCompletion(application, user);
  const businessId = application?.applicationNumber
    ? application.applicationNumber
    : user?.id
      ? `BUS-${user.id.slice(0, 8).toUpperCase()}`
      : "Not provided";

  return (
    <div className="-m-4 min-h-screen bg-gray-100 p-3 md:mx-auto md:my-0 md:min-h-0 md:max-w-7xl md:space-y-6 md:bg-transparent md:p-0">
      <header className="mb-1 md:mb-0">
        <h1 className="text-base font-bold tracking-tight text-gray-950 uppercase md:text-2xl md:normal-case">
          Business Profile
        </h1>
        <p className="mt-1 hidden text-sm text-gray-500 md:block">
          Review the business information currently connected to your retail
          account.
        </p>
      </header>

      {isApplicationError && (
        <div
          role="alert"
          className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 md:my-0"
        >
          Registration details could not be loaded. Some profile fields are
          unavailable.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchApplication()}
          >
            Retry
          </Button>
        </div>
      )}

      <section
        id="profile"
        className="overflow-hidden rounded-[1.25rem] bg-white md:rounded-lg md:border md:border-gray-200"
        aria-labelledby="business-identity-heading"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:grid-cols-[minmax(15rem,2fr)_minmax(0,3fr)]">
          <div className="flex min-h-44 flex-col border-r p-3 md:min-h-64 md:p-6">
            <p className="text-center text-[11px] font-semibold tracking-tight text-gray-700 uppercase md:text-xs md:tracking-wide md:text-gray-600">
              <span className="md:hidden">Business Logo/(Pic. Front)</span>
              <span className="hidden md:inline">Company Logo</span>
            </p>
            <div className="mt-2 flex flex-1 flex-col justify-between gap-2 md:mt-4 md:gap-4">
              <div className="relative mx-auto flex min-h-16 w-full max-w-56 flex-1 items-center justify-center md:min-h-28">
                {user?.shopLogo ? (
                  <Image
                    src={user.shopLogo}
                    alt={`${businessNameLabel} company logo`}
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                ) : (
                  <Building2
                    className="size-10 text-gray-300 md:size-14"
                    aria-label="No company logo"
                  />
                )}
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mx-auto h-8 min-w-0 max-w-32 px-2 text-[11px] md:min-w-32 md:text-xs"
              >
                <Link href="/dashboard/settings/profile/edit#business-information">
                  Change Logo
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex min-h-44 items-center p-3 md:min-h-64 md:p-8">
            <div className="w-full max-w-xl font-sans text-xs leading-4 text-gray-950 md:text-sm md:leading-6">
              <p className="mb-1 text-center text-[11px] font-semibold tracking-tight text-gray-700 uppercase md:hidden">
                Business Profile
              </p>
              <p className="font-mono text-[9px] font-semibold tracking-wide text-gray-500 tabular-nums md:text-xs">
                {businessId}
              </p>
              <h2
                id="business-identity-heading"
                className="mt-0.5 truncate text-sm font-semibold tracking-tight text-gray-950 md:mt-1 md:text-xl"
              >
                {businessNameLabel}
              </h2>
              <dl className="mt-1.5 space-y-0.5 md:mt-3">
                <ProfileRecordRow
                  label="Type"
                  value={formatLabel(application?.businessCategory)}
                />
                <ProfileRecordRow
                  label="Nature"
                  value={formatLabel(application?.businessNature)}
                />
                <div>
                  <dt className="sr-only">Profile completion</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">
                    {profileCompletion}% Complete
                  </dd>
                </div>
                <ProfileRecordRow
                  label="Plan"
                  value={
                    subscription.data?.current?.planName || "Not available"
                  }
                />
                <ProfileRecordRow
                  label="Since"
                  value={formatDate(memberSince)}
                />
              </dl>
              <div className="mt-2 md:mt-3">
                <EditSectionLink href="/dashboard/settings/profile/edit#business-information">
                  Edit Business Profile
                </EditSectionLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav
        aria-label="Business settings sections"
        className="hidden gap-1 overflow-x-auto border-b md:flex"
      >
        <a
          href="#profile-information"
          aria-current="page"
          className="shrink-0 border-b-2 border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          Profile
        </a>
        <a
          href="#storefront-settings"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Settings
        </a>
        <a
          href="#financial-settings"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Financial settings
        </a>
        <a
          href="#password-security"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Password &amp; security
        </a>
        <Link
          href="/dashboard/user-roles"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          User management
        </Link>
        <Link
          href="/dashboard/user-roles#operational-controls"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Operational controls
        </Link>
      </nav>

      <section
        id="profile-information"
        className="grid gap-1 overflow-visible md:grid-cols-2 md:gap-0 md:overflow-hidden md:rounded-xl md:border md:bg-white xl:grid-cols-3"
        aria-label="Profile information"
      >
        <ProfileSection
          title="Business Info"
          icon={Building2}
          action={
            <EditSectionLink href="/dashboard/settings/profile/edit#business-information" />
          }
        >
          <DetailRow label="Business Name" value={businessName} />
          <DetailRow label="Business Type" value={formatLabel(businessType)} />
          <DetailRow
            label="Business Category"
            value={application?.businessCategory}
          />
          <DetailRow label="Business Address" value={businessAddress} />
          <DetailRow label="District" value={application?.district} />
          <DetailRow label="Division" value={application?.division} />
          <DetailRow label="Thana" value={application?.thana} />
        </ProfileSection>

        <ProfileSection
          title="Contact Info"
          mobileTitle="Business Cont."
          icon={ContactRound}
          action={
            <EditSectionLink href="/dashboard/settings/profile/edit#contact-information" />
          }
        >
          <DetailRow label="Mobile Number" value={phoneNumber} />
          <DetailRow label="WhatsApp" value={application?.whatsappNumber} />
          <DetailRow label="Email Address" value={email} />
          <DetailRow label="Facebook Page" value={application?.facebookUrl} />
          <DetailRow label="Messenger" value={application?.messengerUrl} />
          <DetailRow label="Website" value={application?.websiteUrl} />
          <DetailRow
            label="Telegram (Optional)"
            value={application?.telegramUrl}
          />
        </ProfileSection>

        <RetailerSubscriptionSection />
      </section>

      <section
        id="storefront-settings"
        className="relative mt-7 overflow-visible rounded-[1.25rem] bg-white md:mt-0 md:overflow-hidden md:rounded-xl md:border"
        aria-labelledby="storefront-settings-heading"
      >
        <div className="border-b p-4 md:p-6">
          <h2
            id="storefront-settings-heading"
            className="absolute -top-6 left-1 flex items-center gap-2 text-sm font-bold tracking-tight text-gray-950 uppercase md:static md:text-lg md:font-semibold md:normal-case"
          >
            <Clock3
              className="hidden size-5 text-emerald-700 md:block"
              aria-hidden="true"
            />
            Storefront settings
          </h2>
          <p className="mt-1 hidden text-sm text-gray-500 md:block">
            Manage the operating hours shown on your storefront.
          </p>
        </div>

        <div className="space-y-5 p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 sm:max-w-xl sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shop-opening-time">Opening time</Label>
              <Input
                id="shop-opening-time"
                type="time"
                value={openingTime}
                onChange={(event) => setOpeningTime(event.target.value)}
                disabled={updateProfileMutation.isPending}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-closing-time">Closing time</Label>
              <Input
                id="shop-closing-time"
                type="time"
                value={closingTime}
                onChange={(event) => setClosingTime(event.target.value)}
                disabled={updateProfileMutation.isPending}
                className="h-11"
              />
            </div>
          </div>

          {hasIncompleteHours && (
            <p className="text-sm text-red-600" role="alert">
              Set both opening and closing times, or clear both fields.
            </p>
          )}

          <div className="flex justify-end border-t pt-5">
            <Button
              onClick={handleSaveProfile}
              disabled={hasIncompleteHours || updateProfileMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save storefront settings
            </Button>
          </div>
        </div>
      </section>

      <FinancialSettingsSection
        compactMobile
        editorHref="/dashboard/settings/profile/edit#banking-information"
      />
      <PasswordSecuritySection
        phoneNumber={user?.phoneNumberVerified ? user.phoneNumber : null}
      />
    </div>
  );
}

function EditSectionLink({
  children = "Edit",
  href,
}: {
  children?: React.ReactNode;
  href: string;
}) {
  return (
    <Button
      asChild
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 px-2.5 text-xs normal-case tracking-normal"
    >
      <Link href={href}>
        <Edit3 className="size-3.5" aria-hidden="true" />
        {children}
      </Link>
    </Button>
  );
}

function BusinessProfileSkeleton() {
  return (
    <>
      <div className="-m-4 min-h-screen bg-gray-100 p-3 md:hidden">
        <h1 className="mb-1 text-base font-bold tracking-tight text-gray-950 uppercase">
          Business Profile
        </h1>
        <div className="grid min-h-44 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] overflow-hidden rounded-[1.25rem] bg-white">
          <div className="flex flex-col items-center border-r p-3">
            <p className="text-center text-[11px] font-semibold tracking-tight text-gray-700 uppercase">
              Business Logo/(Pic. Front)
            </p>
            <Skeleton className="my-auto size-14 rounded-xl" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="flex flex-col justify-center p-3">
            <p className="mb-3 text-center text-[11px] font-semibold tracking-tight text-gray-700 uppercase">
              Business Profile
            </p>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </div>

        <MobileSettingsSkeleton title="Business Info" height="h-48" />
        <MobileSettingsSkeleton title="Business Cont." height="h-48" />
        <MobileSettingsSkeleton title="Business Plan" height="h-44" />

        <section className="relative mt-7 overflow-visible rounded-[1.25rem] bg-white">
          <h2 className="absolute -top-6 left-1 text-sm font-bold tracking-tight text-gray-950 uppercase">
            Finance Info
          </h2>
          <div className="grid min-h-28 grid-cols-2 divide-x">
            <Skeleton className="m-auto h-12 w-24" />
            <Skeleton className="m-auto h-12 w-24" />
          </div>
        </section>

        <MobileSettingsSkeleton title="Password and Security" height="h-32" />
      </div>

      <div className="hidden space-y-6 md:block">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    </>
  );
}

function MobileSettingsSkeleton({
  height,
  title,
}: {
  height: string;
  title: string;
}) {
  return (
    <section className={`relative mt-7 rounded-[1.25rem] bg-white ${height}`}>
      <h2 className="absolute -top-6 left-1 text-sm font-bold tracking-tight text-gray-950 uppercase">
        {title}
      </h2>
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-11/12" />
      </div>
    </section>
  );
}

function ProfileRecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-1 md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-2">
      <dt className="font-medium text-gray-600">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-gray-900">
        : {value}
      </dd>
    </div>
  );
}

function ProfileSection({
  title,
  mobileTitle,
  icon: Icon,
  children,
  className = "",
  action,
  description,
}: {
  title: string;
  mobileTitle?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  action: React.ReactNode;
  description?: string;
}) {
  return (
    <section
      className={`relative mt-7 flex flex-col rounded-[1.25rem] bg-white p-4 md:mt-0 md:rounded-none md:border-r md:border-b md:p-6 md:last:border-b-0 md:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="absolute -top-6 left-1 flex items-center gap-2 text-sm font-bold tracking-tight text-gray-950 uppercase md:static md:font-semibold md:tracking-wide">
          <Icon
            className="hidden size-4 text-emerald-700 md:block"
            aria-hidden="true"
          />
          <span className="md:hidden">{mobileTitle || title}</span>
          <span className="hidden md:inline">{title}</span>
        </h2>
      </div>
      <dl className="mt-5 divide-y">{children}</dl>
      {description && (
        <p className="pt-3 text-xs leading-relaxed text-gray-500">
          {description}
        </p>
      )}
      <div className="mt-auto pt-5">{action}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-4">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-gray-900 sm:text-right">
        {displayValue(value)}
      </dd>
    </div>
  );
}
