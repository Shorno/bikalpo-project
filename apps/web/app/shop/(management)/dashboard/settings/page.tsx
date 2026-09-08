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
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">
          Business Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review the business information currently connected to your retail
          account.
        </p>
      </header>

      {isApplicationError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
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
        className="overflow-hidden rounded-lg border border-gray-200 bg-white"
        aria-labelledby="business-identity-heading"
      >
        <div className="grid md:grid-cols-[minmax(15rem,2fr)_minmax(0,3fr)]">
          <div className="flex min-h-64 flex-col border-b p-6 md:border-r md:border-b-0">
            <p className="text-center text-xs font-semibold tracking-wide text-gray-600 uppercase">
              Company Logo
            </p>
            <div className="mt-4 flex flex-1 flex-col justify-between gap-4">
              <div className="relative mx-auto flex min-h-28 w-full max-w-56 flex-1 items-center justify-center">
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
                    className="size-14 text-gray-300"
                    aria-label="No company logo"
                  />
                )}
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mx-auto min-w-32"
              >
                <Link href="/dashboard/settings/profile/edit#business-information">
                  Change Logo
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex min-h-64 items-center p-6 sm:p-8">
            <div className="w-full max-w-xl font-sans text-sm leading-6 text-gray-950">
              <p className="font-mono text-xs font-semibold tracking-wide text-gray-500 tabular-nums">
                {businessId}
              </p>
              <h2
                id="business-identity-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-gray-950"
              >
                {businessNameLabel}
              </h2>
              <dl className="mt-3 space-y-0.5">
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
              <div className="mt-3">
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
        className="flex gap-1 overflow-x-auto border-b"
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
        className="grid overflow-hidden rounded-xl border bg-white md:grid-cols-2 xl:grid-cols-3"
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
        className="overflow-hidden rounded-xl border bg-white"
        aria-labelledby="storefront-settings-heading"
      >
        <div className="border-b p-6">
          <h2
            id="storefront-settings-heading"
            className="flex items-center gap-2 text-lg font-semibold text-gray-950"
          >
            <Clock3 className="size-5 text-emerald-700" aria-hidden="true" />
            Storefront settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage the operating hours shown on your storefront.
          </p>
        </div>

        <div className="space-y-5 p-6">
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

      <FinancialSettingsSection editorHref="/dashboard/settings/profile/edit#banking-information" />
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
    <div className="space-y-6">
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
  );
}

function ProfileRecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="font-medium text-gray-600">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-gray-900">
        : {value}
      </dd>
    </div>
  );
}

function ProfileSection({
  title,
  icon: Icon,
  children,
  className = "",
  action,
  description,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  action: React.ReactNode;
  description?: string;
}) {
  return (
    <section
      className={`flex flex-col border-b p-6 last:border-b-0 md:border-r md:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-950 uppercase">
          <Icon className="size-4 text-emerald-700" aria-hidden="true" />
          {title}
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
