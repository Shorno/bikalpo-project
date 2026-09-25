"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useState } from "react";
import type { ApplicationDetailData } from "@/components/features/admin/application-detail-sections";
import { Button } from "@/components/ui/button";
import {
  businessNatureLabel,
  detailDate,
  externalUrl,
  MissingValue,
  type UserDetailData,
} from "./user-detail-content";

export function UserProfileHero({
  data,
  detail,
  businessName,
  actions,
  onChangeLogo,
}: {
  data: UserDetailData;
  detail: ApplicationDetailData;
  businessName: string;
  actions: ReactNode;
  onChangeLogo?: () => void;
}) {
  const isRetailer = data.user.role === "shop_owner";
  const logo = isRetailer ? externalUrl(data.user.shopLogo) : null;
  const [failedLogo, setFailedLogo] = useState<string | null>(null);

  return (
    <section
      aria-label="Business profile"
      className="grid min-w-0 overflow-hidden rounded-xl border bg-card md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.8fr)]"
    >
      <div className="flex flex-col items-center justify-center gap-5 border-b bg-muted/10 p-6 md:border-r md:border-b-0">
        <div className="relative flex size-36 items-center justify-center sm:size-44">
          {logo && failedLogo !== logo ? (
            <Image
              src={logo}
              alt={businessName + " company logo"}
              fill
              loading="eager"
              unoptimized
              className="object-contain"
              onError={() => setFailedLogo(logo)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
              <ImageIcon className="size-8" aria-hidden />
              <span className="text-xs">Company Logo</span>
              <MissingValue />
            </div>
          )}
        </div>
        {isRetailer && onChangeLogo && (
          <Button variant="outline" size="sm" onClick={onChangeLogo}>
            Change Logo
          </Button>
        )}
      </div>
      <div className="min-w-0 p-5 sm:p-6">
        <p className="break-all font-mono text-xs text-muted-foreground">
          {detail.applicationNumber || data.user.id}
        </p>
        <h2 className="mt-2 break-words text-xl font-semibold tracking-tight sm:text-2xl">
          {businessName}
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-baseline gap-3">
            <dt className="w-14 shrink-0 text-muted-foreground">Type</dt>
            <dd className="min-w-0 break-words font-medium">
              {detail.productTypeName || detail.businessCategory || (
                <MissingValue />
              )}
            </dd>
          </div>
          <div className="flex items-baseline gap-3">
            <dt className="w-14 shrink-0 text-muted-foreground">Nature</dt>
            <dd className="min-w-0 break-words font-medium">
              {businessNatureLabel(detail.businessNature) || <MissingValue />}
            </dd>
          </div>
        </dl>
        <p className="my-4 text-sm">
          <span className="font-mono font-semibold tabular-nums">
            {data.accountMeta.profileCompletion}%
          </span>{" "}
          <span className="text-muted-foreground">Complete</span>
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline gap-3">
            <dt className="w-14 shrink-0 text-muted-foreground">Plan</dt>
            <dd className="min-w-0 break-words font-medium">{data.planName}</dd>
          </div>
          <div className="flex items-baseline gap-3">
            <dt className="w-14 shrink-0 text-muted-foreground">Since</dt>
            <dd className="font-medium">{detailDate(data.user.createdAt)}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">{actions}</div>
      </div>
    </section>
  );
}
