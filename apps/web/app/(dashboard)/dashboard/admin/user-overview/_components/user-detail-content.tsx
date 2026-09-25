"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, FileText } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useId, useState } from "react";
import type { ApplicationDetailData } from "@/components/features/admin/application-detail-sections";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BUSINESS_NATURES } from "@/constants/seller-registration";
import { cn } from "@/lib/utils";
import { type client, orpc } from "@/utils/orpc";

export type UserDetailData = Awaited<
  ReturnType<typeof client.adminUserManagement.getById>
>;

export function detailDate(value?: Date | string | null, missing = "—") {
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? missing
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dhaka",
      }).format(date);
}

export function businessNatureLabel(value?: string | null) {
  return BUSINESS_NATURES.find((nature) => nature.id === value)?.label ?? value;
}

export function externalUrl(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const input = value.trim();
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`,
    );
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function MissingValue() {
  return (
    <span title="Not recorded">
      <span aria-hidden>—</span>
      <span className="sr-only">Not recorded</span>
    </span>
  );
}

export function DetailFields({
  fields,
  className,
}: {
  fields: { label: string; value?: ReactNode; hint?: string }[];
  className?: string;
}) {
  return (
    <dl className={cn("space-y-4", className)}>
      {fields.map(({ label, value, hint }) => (
        <div
          key={label}
          title={hint}
          className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-baseline gap-x-4 gap-y-1 text-sm"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
            {value === null || value === undefined || value === "" ? (
              <MissingValue />
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailSection({
  title,
  children,
  busy,
}: {
  title: string;
  children: ReactNode;
  busy?: boolean;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      aria-busy={busy}
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <div className="border-b bg-muted/20 px-4 py-4 sm:px-6">
        <h2 id={id} className="text-sm font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function SocialLink({ value }: { value?: string | null }) {
  const href = externalUrl(value);
  if (!value) return <MissingValue />;
  if (!href) return <>{value}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {value.replace(/^https?:\/\//i, "")}
    </a>
  );
}

export function BusinessInformation({
  detail,
  businessName,
}: {
  detail: ApplicationDetailData;
  businessName: string;
}) {
  return (
    <section
      aria-labelledby="business-information-heading"
      className="space-y-3"
    >
      <h2
        id="business-information-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Business Information
      </h2>
      <div className="grid min-w-0 overflow-hidden rounded-xl border bg-card md:grid-cols-2">
        <div className="min-w-0 border-b md:border-r md:border-b-0">
          <h3 className="border-b bg-muted/20 px-4 py-4 text-sm font-semibold sm:px-6">
            Business Info
          </h3>
          <div className="p-4 sm:p-6">
            <p className="mb-5 break-words font-semibold">{businessName}</p>
            <DetailFields
              fields={[
                {
                  label: "Business Type",
                  value: detail.productTypeName || detail.businessCategory,
                },
                {
                  label: "Coverage",
                  value: [detail.area, detail.district, detail.division]
                    .filter(Boolean)
                    .join(", "),
                  hint: "Location recorded in the business application.",
                },
                { label: "Address", value: detail.businessAddress },
                {
                  label: "Nature",
                  value: businessNatureLabel(detail.businessNature),
                },
                { label: "Experience", value: detail.yearsInBusiness },
                { label: "Sales Volume", value: detail.monthlyRevenue },
              ]}
            />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="border-b bg-muted/20 px-4 py-4 text-sm font-semibold sm:px-6">
            Social Network
          </h3>
          <div className="p-4 sm:p-6">
            <DetailFields
              fields={[
                {
                  label: "Facebook",
                  value: <SocialLink value={detail.facebookUrl} />,
                },
                { label: "WhatsApp", value: detail.whatsappNumber },
                {
                  label: "Instagram",
                  value: <SocialLink value={detail.instagramUrl} />,
                },
                {
                  label: "Website",
                  value: <SocialLink value={detail.websiteUrl} />,
                },
                {
                  label: "TikTok",
                  value: <SocialLink value={detail.tiktokUrl} />,
                },
              ]}
            />
            <DetailFields
              className="mt-5 border-t pt-5"
              fields={[
                { label: "Referral ID", value: detail.referralId },
                { label: "Relation" },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function DocumentCard({ title, url }: { title: string; url?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const href = externalUrl(url);
  const showImage = href && !/\.pdf(?:[?#]|$)/i.test(href) && !imageFailed;
  return (
    <section
      aria-label={title}
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <h3 className="border-b bg-muted/20 px-4 py-4 text-sm font-semibold sm:px-6">
        {title}
      </h3>
      <div className="p-4 sm:p-6">
        <div className="relative flex aspect-[4/3] items-center justify-center rounded-lg bg-muted/20">
          {showImage ? (
            <Image
              src={href}
              alt={title}
              fill
              unoptimized
              className="object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : href ? (
            <FileText
              className="size-9 text-muted-foreground"
              aria-label="Document available"
            />
          ) : (
            <MissingValue />
          )}
        </div>
        <div className="mt-4">
          {href ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${title}`}
              >
                View <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              aria-label={`${title} not provided`}
            >
              View
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export function DocumentsContent({
  detail,
}: {
  detail: ApplicationDetailData;
}) {
  const fields = [
    ["Trade License", detail.documentUrls?.tradeLicense],
    ["National ID", detail.documentUrls?.nid],
    ["Shop Photo", detail.documentUrls?.shopPhoto],
    ["Store Front", detail.documentUrls?.storeFront],
  ] as const;
  return (
    <section aria-labelledby="user-documents-heading" className="space-y-3">
      <h2
        id="user-documents-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Documents
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([title, url]) => (
          <DocumentCard key={`${title}-${url}`} title={title} url={url} />
        ))}
      </div>
    </section>
  );
}

function deviceName(ua?: string | null) {
  if (!ua) return null;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return null;
}

export function PlanContent({ data }: { data: UserDetailData }) {
  const current = data.subscription;
  const lastActive = data.loginActivity?.lastActiveAt;
  return (
    <div className="space-y-5">
      <DetailSection title="User Plan">
        <DetailFields
          className="max-w-2xl"
          fields={[
            { label: "Current Plan", value: data.planName },
            { label: "Subscription Status", value: current?.status },
            { label: "Plan Start Date", value: detailDate(current?.startsAt) },
            {
              label: "Expiry Date",
              value: current
                ? detailDate(current.expiresAt, "No expiry")
                : null,
            },
            {
              label: "Auto Renewal",
              value: current ? (current.autoRenew ? "On" : "Off") : null,
            },
            {
              label: "Next Billing Date",
              value: current
                ? detailDate(current.nextBillingAt, "Not scheduled")
                : null,
            },
            { label: "Payment Status", value: current?.paymentStatus },
          ]}
        />
      </DetailSection>
      <DetailSection title="Login Activity">
        <DetailFields
          className="max-w-2xl"
          fields={[
            {
              label: "Last Active",
              value: lastActive
                ? formatDistanceToNow(new Date(lastActive), { addSuffix: true })
                : null,
              hint: "Latest recorded session update; not a live online indicator.",
            },
            {
              label: "Device",
              value: deviceName(data.loginActivity?.userAgent),
            },
            { label: "IP Address", value: data.loginActivity?.ipAddress },
          ]}
        />
      </DetailSection>
      <DetailSection title="Timeline">
        <DetailFields
          className="max-w-2xl"
          fields={[
            { label: "Registered", value: detailDate(data.user.createdAt) },
            {
              label: "Application Approved",
              value:
                data.applicationStatus?.status === "approved"
                  ? detailDate(data.applicationStatus.reviewedAt)
                  : null,
            },
            {
              label: "KYC Verified",
              value: detailDate(data.accountMeta.kycReviewedAt),
            },
          ]}
        />
      </DetailSection>
    </div>
  );
}

export function PerformanceContent({ userId }: { userId?: string }) {
  const query = useQuery({
    ...orpc.adminUserManagement.getPerformance.queryOptions({
      input: { userId: userId || "" },
    }),
    enabled: Boolean(userId),
  });
  const loading = Boolean(userId) && query.isPending;
  const number = (value?: number | null) =>
    loading ? (
      <Skeleton className="h-5 w-20" />
    ) : value == null ? null : (
      value.toLocaleString("en-US")
    );
  const metrics = query.data;
  return (
    <DetailSection title="Business Performance" busy={loading}>
      {query.isError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4 text-sm"
        >
          <p>Could not load business performance.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      <DetailFields
        className="max-w-2xl"
        fields={[
          { label: "Shop Followers", value: number(metrics?.shopFollowers) },
          {
            label: "Total Orders",
            value: number(metrics?.totalOrders),
            hint: "Sales orders placed with this business, excluding its purchases and POS transactions.",
          },
          {
            label: "Pending Orders",
            value: number(metrics?.pendingOrders),
            hint: "Sales orders with Pending status.",
          },
          {
            label: "Cancelled Orders",
            value: number(metrics?.cancelledOrders),
          },
          {
            label: "Total Sales",
            value: loading ? (
              <Skeleton className="h-5 w-24" />
            ) : metrics ? (
              new Intl.NumberFormat("en-BD", {
                style: "currency",
                currency: "BDT",
                maximumFractionDigits: 2,
              }).format(metrics.totalSales)
            ) : null,
            hint: "Sum of delivered sales-order totals. Excludes procurement and POS sales.",
          },
          {
            label: "Last Month Orders",
            value: number(metrics?.lastMonthOrders),
            hint: metrics
              ? `${detailDate(metrics.lastMonthStart)} to ${detailDate(metrics.lastMonthEnd)} (exclusive), Asia/Dhaka.`
              : undefined,
          },
          { label: "Average Rating" },
          { label: "Success Rate" },
        ]}
      />
      <DetailFields
        className="mt-6 max-w-2xl border-t pt-5"
        fields={[
          { label: "Nature Rank" },
          { label: "Type Rank" },
          { label: "Area Rank" },
        ]}
      />
    </DetailSection>
  );
}

export function AdminNotesContent({ data }: { data: UserDetailData }) {
  const review = data.lastReview;
  return (
    <section aria-labelledby="admin-notes-heading" className="space-y-3">
      <h2
        id="admin-notes-heading"
        className="text-sm font-semibold tracking-tight"
      >
        Admin Notes
      </h2>
      <DetailSection title="Last Verification">
        <p className="mb-6 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {review?.notes || <MissingValue />}
        </p>
        <DetailFields
          className="max-w-2xl"
          fields={[
            { label: "Compliance Status" },
            {
              label: "Last Reviewed By",
              value: review?.reviewerName || review?.reviewedBy,
            },
            {
              label: "Last Reviewed Date",
              value: detailDate(review?.reviewedAt),
            },
          ]}
        />
      </DetailSection>
    </section>
  );
}
